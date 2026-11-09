import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useEffect, useMemo, useRef } from 'react';

import { useToast } from '@/components/feedback/Toast';
import { evaluateMilestones, type GoalLike } from '@/domain/milestones/evaluate';
import { applyPending } from '@/domain/sync/outbox';
import { dailyValues } from '@/domain/weight/trend';
import { addDays } from '@/domain/calculations/dates';
import { weekStartFor } from '@/domain/reports/weekly';
import { useActivities } from '@/features/activity/api';
import { useNutritionRange } from '@/features/coach/api';
import { useToday } from '@/features/dashboard/useToday';
import { useScheduledWorkouts } from '@/features/training/schedule-api';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCheckins } from '@/features/checkin/api';
import { useMeasurements } from '@/features/measurements/api';
import { useActiveGoal, useProfile } from '@/features/profile/api';
import { useSessions } from '@/features/training/session-api';
import { syncKeys, useOutbox, useSyncActions } from '@/features/sync/SyncProvider';
import { useWeightEntries } from '@/features/weight/api';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

export type UnlockedMilestone = Tables<'user_milestones'> & { _pending?: boolean };

export function useUnlockedMilestones() {
  const userId = useAuth().session?.user.id;
  const queue = useOutbox();
  const query = useQuery({
    queryKey: syncKeys.entity(userId ?? 'anonymous', 'user_milestones'),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('user_milestones')
        .select('*')
        .eq('user_id', userId as string)
        .order('unlocked_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const rows = useMemo(
    () =>
      applyPending(
        query.data ?? [],
        queue,
        'user_milestones',
        (r) => r.milestone_key,
      ) as UnlockedMilestone[],
    [query.data, queue],
  );
  return { ...query, rows };
}

export function useGoalLike(): GoalLike | null {
  const { data: g } = useActiveGoal();
  return useMemo(
    () =>
      g
        ? {
            goalType: g.goal_type,
            startKg: Number(g.starting_weight_kg),
            targetKg: g.target_weight_kg === null ? null : Number(g.target_weight_kg),
            secondaryKg:
              g.secondary_target_weight_kg === null ? null : Number(g.secondary_target_weight_kg),
          }
        : null,
    [g],
  );
}

/**
 * Evaluates milestones whenever progress data changes and unlocks new ones through the outbox.
 * Runs only when every input has loaded, so missing data can't cause duplicate celebrations.
 * Mounted once, inside the signed-in tab layout.
 */
export function useMilestoneEngine() {
  const goalQuery = useActiveGoal();
  const goal = useGoalLike();
  const weights = useWeightEntries();
  const measurements = useMeasurements();
  const checkins = useCheckins();
  const unlocked = useUnlockedMilestones();
  const training = useSessions();
  const activities = useActivities();
  const { today } = useToday();
  const profile = useProfile();
  const schedule = useScheduledWorkouts(addDays(today, -120), addDays(today, 120));
  const food = useNutritionRange(addDays(today, -89), today);
  const weekStartsOn: 1 | 7 = profile.data?.week_start === 7 ? 7 : 1;
  const { write } = useSyncActions();
  const showToast = useToast((s) => s.show);
  const written = useRef(new Set<string>());

  const ready =
    goalQuery.isSuccess &&
    weights.isSuccess &&
    measurements.isSuccess &&
    checkins.isSuccess &&
    unlocked.isSuccess &&
    training.isSuccess &&
    activities.isSuccess &&
    schedule.isSuccess &&
    food.isSuccess;

  useEffect(() => {
    if (!ready) return;
    const unlockedKeys = new Set([
      ...unlocked.rows.map((r) => r.milestone_key),
      ...written.current,
    ]);
    const fresh = evaluateMilestones({
      goal,
      daily: dailyValues(weights.entries),
      logDates: [
        ...weights.entries.map((e) => e.local_date),
        ...measurements.rows.map((m) => m.local_date),
        ...checkins.rows.map((c) => c.local_date),
        ...training.sessions.map((t) => t.local_date),
        ...activities.rows.map((a) => a.local_date),
        ...(food.data?.loggedDates ?? []),
      ],
      unlockedKeys,
      sessions: training.sessions
        .filter((t) => t.completion_status !== 'abandoned')
        .map((t) => ({ date: t.local_date, durationS: t.duration_seconds, category: t.category })),
      weeks: finishedWeeks(schedule.rows, today, weekStartsOn),
      activities: activities.rows.map((a) => ({
        date: a.local_date,
        type: a.activity_type,
        distanceM: a.distance_meters,
        movingS: a.moving_seconds,
        quality: a.gps_quality,
        source: a.source,
      })),
    });
    if (!fresh.length) return;
    for (const m of fresh) {
      written.current.add(m.key);
      void write({
        id: randomUUID(),
        entity: 'user_milestones',
        recordKey: m.key,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id: randomUUID(),
          milestone_key: m.key,
          title: m.title,
          description: m.description,
          threshold: m.threshold,
          value: m.value,
          metadata: { category: m.category, achieved_on: m.achievedOn },
        },
      });
    }
    showToast(
      fresh.length === 1
        ? `Milestone unlocked: ${fresh[0]!.title}`
        : `You unlocked ${fresh.length} milestones`,
    );
  }, [
    ready,
    goal,
    weights.entries,
    measurements.rows,
    checkins.rows,
    training.sessions,
    activities.rows,
    schedule.rows,
    food.data,
    today,
    weekStartsOn,
    unlocked.rows,
    write,
    showToast,
  ]);
}

/** Planned vs completed workouts per finished week (spec 25.5 consistent weeks). */
function finishedWeeks(
  rows: readonly { scheduled_date: string; status: string }[],
  today: string,
  weekStartsOn: 1 | 7,
) {
  const weeks = new Map<string, { weekStart: string; planned: number; completed: number }>();
  for (const r of rows) {
    if (r.status === 'moved') continue;
    const ws = weekStartFor(r.scheduled_date, weekStartsOn);
    if (addDays(ws, 6) >= today) continue; // only finished weeks
    const w = weeks.get(ws) ?? { weekStart: ws, planned: 0, completed: 0 };
    if (r.status !== 'skipped') w.planned++;
    if (r.status === 'completed') w.completed++;
    weeks.set(ws, w);
  }
  return [...weeks.values()];
}
