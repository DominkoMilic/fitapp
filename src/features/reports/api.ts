import { randomUUID } from 'expo-crypto';
import { useCallback, useMemo } from 'react';

import { addDays } from '@/domain/calculations/dates';
import { distanceTrusted } from '@/domain/milestones/evaluate';
import {
  REPORT_VERSION,
  type WeeklyReport,
  weeklyReport,
  weekStartFor,
} from '@/domain/reports/weekly';
import { dailyValues } from '@/domain/weight/trend';
import { useActivities } from '@/features/activity/api';
import { useNutritionRange } from '@/features/coach/api';
import { useToday } from '@/features/dashboard/useToday';
import { useUnlockedMilestones } from '@/features/milestones/api';
import { useProfile } from '@/features/profile/api';
import { useSyncActions } from '@/features/sync/SyncProvider';
import { useSyncedRows } from '@/features/sync/useSyncedRows';
import { useScheduledWorkouts } from '@/features/training/schedule-api';
import { useSessions } from '@/features/training/session-api';
import { useWeightEntries } from '@/features/weight/api';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/database.types';

export type CachedReport = Tables<'weekly_reports'>;

export function useWeekStart() {
  const { today } = useToday();
  const profile = useProfile();
  const weekStartsOn: 1 | 7 = profile.data?.week_start === 7 ? 7 : 1;
  return { today, weekStartsOn, current: weekStartFor(today, weekStartsOn) };
}

/** Snapshots of finished weeks (spec 16), newest first. */
export function useCachedReports() {
  return useSyncedRows<CachedReport>({
    entity: 'weekly_reports',
    keyOf: (r) => r.week_start,
    fetch: async (userId) => {
      const { data, error } = await requireSupabase()
        .from('weekly_reports')
        .select('*')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(104);
      if (error) throw error;
      return data;
    },
  });
}

const isReport = (p: unknown): p is WeeklyReport =>
  !!p && typeof p === 'object' && (p as WeeklyReport).version === REPORT_VERSION;

/**
 * A week's report: the stored snapshot for a finished week if there is one, otherwise computed
 * from current data (and the current week is always live, labelled "In progress").
 */
export function useWeeklyReport(weekStart: string) {
  const { today } = useWeekStart();
  const weekEnd = addDays(weekStart, 6);
  const cached = useCachedReports();
  const snapshot = cached.rows.find((r) => r.week_start === weekStart);
  const weights = useWeightEntries();
  const schedule = useScheduledWorkouts(addDays(today, -120), addDays(today, 120));
  const sessions = useSessions();
  const activities = useActivities();
  const food = useNutritionRange(weekStart, weekEnd);
  const milestones = useUnlockedMilestones();

  const ready =
    weights.isSuccess &&
    schedule.isSuccess &&
    sessions.isSuccess &&
    activities.isSuccess &&
    food.isSuccess &&
    milestones.isSuccess;

  const live = useMemo(() => {
    if (!ready) return null;
    return weeklyReport({
      weekStart,
      today,
      daily: dailyValues(weights.entries),
      scheduled: schedule.rows.map((r) => ({
        date: r.scheduled_date,
        status: r.status,
        category: r.category,
      })),
      sessions: sessions.sessions
        .filter((s) => s.completion_status !== 'abandoned')
        .map((s) => ({
          date: s.local_date,
          rpe: s.perceived_exertion,
          durationS: s.duration_seconds,
          category: s.category,
        })),
      activities: activities.rows.map((a) => ({
        date: a.local_date,
        type: a.activity_type,
        distanceM: a.distance_meters,
        trusted: distanceTrusted({ quality: a.gps_quality, source: a.source }),
      })),
      completeDays: food.data?.completeDays ?? [],
      waterDays: food.data?.waterDays ?? [],
      milestones: milestones.rows.map((m) => ({
        date:
          ((m.metadata as Record<string, unknown> | null)?.achieved_on as string | undefined) ??
          m.unlocked_at.slice(0, 10),
        title: m.title,
      })),
    });
  }, [
    ready,
    weekStart,
    today,
    weights.entries,
    schedule.rows,
    sessions.sessions,
    activities.rows,
    food.data,
    milestones.rows,
  ]);

  const stored = snapshot && isReport(snapshot.payload) ? snapshot.payload : null;
  return {
    report: stored ?? live,
    fromSnapshot: !!stored,
    isPending: !stored && !live,
    isError: !stored && (weights.isError || food.isError || sessions.isError),
    refetch: food.refetch,
  };
}

/** Stores a finished week's report once, so later edits don't rewrite history (spec 16). */
export function useSaveReportSnapshot() {
  const { write } = useSyncActions();
  return useCallback(
    (report: WeeklyReport) =>
      report.inProgress
        ? Promise.resolve()
        : write({
            id: randomUUID(),
            entity: 'weekly_reports',
            recordKey: report.weekStart,
            kind: 'upsert',
            createdOffline: true,
            payload: {
              week_start: report.weekStart,
              payload: report as unknown as Json,
              generated_at: new Date().toISOString(),
            },
          }),
    [write],
  );
}
