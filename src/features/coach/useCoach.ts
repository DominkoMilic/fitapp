import { useMemo } from 'react';

import { addDays } from '@/domain/calculations/dates';
import { type CoachContext, evaluateCoach, type PlanItem } from '@/domain/coach/rules';
import { isTrainingItem, weekStartFor } from '@/domain/reports/weekly';
import { EXERCISE_BY_SLUG, TEMPLATE_BY_SLUG } from '@/domain/training/catalogue';
import { buildWorkout } from '@/domain/training/workout-builder';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCheckins } from '@/features/checkin/api';
import { targetFor } from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { useNutritionDay } from '@/features/nutrition/useNutritionDay';
import {
  useActiveGoal,
  useHealthConditions,
  usePreferences,
  useProfile,
  useTargetHistory,
} from '@/features/profile/api';
import { useOwnedEquipment, useRestrictions } from '@/features/training/library';
import { type ScheduledWorkout, useScheduledWorkouts } from '@/features/training/schedule-api';
import { useSessions } from '@/features/training/session-api';
import { useWeightEntries } from '@/features/weight/api';
import { useNow } from '@/hooks/useNow';

import { useAdjustments, useNutritionRange } from './api';
import { dismissedOn, useDismissals } from './dismissals';
import { minuteInTimezone } from './time';

const label = (area: string) => area.replace(/_/g, ' ');

/** Gathers today's coach context from the repositories and evaluates the rules (spec 15). */
export function useCoach() {
  const userId = useAuth().session?.user.id;
  const { today, timezone } = useToday();
  const now = useNow(60_000);
  const profile = useProfile();
  const prefs = usePreferences();
  const goal = useActiveGoal();
  const targets = useTargetHistory();
  const health = useHealthConditions();
  const restrictions = useRestrictions();
  const owned = useOwnedEquipment();
  const schedule = useScheduledWorkouts(addDays(today, -120), addDays(today, 120));
  const sessions = useSessions();
  const checkins = useCheckins();
  const weights = useWeightEntries();
  const day = useNutritionDay(today);
  const range = useNutritionRange(addDays(today, -27), today);
  const adjustments = useAdjustments();
  const dismissState = useDismissals((s) => s.byUser);
  const dismiss = useDismissals((s) => s.dismiss);

  const weekStartsOn: 1 | 7 = profile.data?.week_start === 7 ? 7 : 1;
  const ready =
    profile.isSuccess &&
    targets.isSuccess &&
    health.isSuccess &&
    schedule.isSuccess &&
    sessions.isSuccess &&
    checkins.isSuccess &&
    weights.isSuccess &&
    range.isSuccess;

  // Everything except the time of day: rebuilt only when data changes, not every minute.
  const base = useMemo((): Omit<CoachContext, 'minuteOfDay'> | null => {
    if (!ready) return null;
    const injuries = (health.data ?? [])
      .filter((h) => h.body_area && (h.status === 'active' || h.status === 'recovering'))
      .map((h) => ({ area: label(h.body_area as string), status: h.status }));

    const toItem = (w: ScheduledWorkout): PlanItem => {
      const template = w.template_slug ? TEMPLATE_BY_SLUG[w.template_slug] : undefined;
      const built =
        template && w.status === 'planned'
          ? buildWorkout({
              template,
              exercisesBySlug: EXERCISE_BY_SLUG,
              restrictions: restrictions.tags,
              ownedEquipment: owned,
            })
          : null;
      return {
        id: w.id,
        title: w.title,
        category: w.category,
        intensity: (w.intensity as PlanItem['intensity']) ?? 'moderate',
        time: w.scheduled_time ? w.scheduled_time.slice(0, 5) : null,
        status: w.status,
        adjustedFor: built?.adjustedForInjury ? injuries.map((i) => i.area) : [],
      };
    };
    const on = (d: string) => schedule.rows.filter((r) => r.scheduled_date === d).map(toItem);

    const intensityById = new Map(schedule.rows.map((r) => [r.id, r.intensity]));
    const from28 = addDays(today, -27);
    const done = sessions.sessions
      .filter((s) => s.local_date >= from28 && s.completion_status !== 'abandoned')
      .map((s) => ({
        date: s.local_date,
        rpe: s.perceived_exertion,
        durationS: s.duration_seconds,
        category: s.category,
        plannedIntensity: (s.scheduled_workout_id
          ? (intensityById.get(s.scheduled_workout_id) ?? null)
          : null) as 'easy' | 'moderate' | 'hard' | null,
      }));

    const weekStart = weekStartFor(today, weekStartsOn);
    const thisWeek = schedule.rows.filter(
      (r) =>
        r.scheduled_date >= weekStart &&
        r.scheduled_date <= addDays(weekStart, 6) &&
        r.status !== 'moved' &&
        isTrainingItem(r.category) &&
        r.status !== 'skipped',
    );
    const t = targetFor(targets.data ?? [], today);
    const checkin = checkins.rows.find((c) => c.local_date === today) ?? null;
    const weighIns = weights.entries.map((e) => e.local_date).sort();
    const dataDays = new Set([
      ...weighIns,
      ...checkins.rows.map((c) => c.local_date),
      ...sessions.sessions.map((s) => s.local_date),
      ...(range.data?.loggedDates ?? []),
    ]).size;

    return {
      today,
      dietType: prefs.data?.diet_type ?? null,
      nutritionEnabled: prefs.data?.nutrition_enabled ?? true,
      injuries,
      plan: {
        yesterday: on(addDays(today, -1)),
        today: on(today),
        tomorrow: on(addDays(today, 1)),
      },
      sessions: done,
      checkin: checkin
        ? {
            pain: checkin.pain,
            fatigue: checkin.fatigue,
            sleepHours: checkin.sleep_hours === null ? null : Number(checkin.sleep_hours),
          }
        : null,
      targets: t
        ? {
            kcal: t.kcal,
            proteinG: t.protein_g,
            waterMl: t.water_ml,
            floorKcal: t.floor_kcal ?? 1200,
          }
        : null,
      intake: {
        kcal: day.totals.kcal ?? 0,
        proteinG: day.totals.protein_g ?? 0,
        mealsLogged: day.log.rows.length,
        waterMl: day.waterMl,
      },
      completeDays: (range.data?.completeDays ?? []).filter((d) => d.date < today),
      weightGoalActive:
        goal.data?.goal_type === 'lose_weight' && goal.data.target_weight_kg !== null,
      lastWeighIn: weighIns[weighIns.length - 1] ?? null,
      pendingAdjustment: (adjustments.data ?? []).some((a) => a.status === 'proposed'),
      week: {
        planned: thisWeek.length,
        completed: thisWeek.filter((r) => r.status === 'completed').length,
      },
      dataDays,
      dismissed: dismissedOn(dismissState, userId, today),
    };
  }, [
    ready,
    health.data,
    restrictions.tags,
    owned,
    schedule.rows,
    sessions.sessions,
    prefs.data,
    weekStartsOn,
    today,
    targets.data,
    checkins.rows,
    weights.entries,
    range.data,
    day,
    goal.data,
    adjustments.data,
    dismissState,
    userId,
  ]);

  const minuteOfDay = minuteInTimezone(new Date(now), timezone);
  const cards = useMemo(
    () => (base ? evaluateCoach({ ...base, minuteOfDay }) : []),
    [base, minuteOfDay],
  );
  return {
    cards,
    isPending: !ready,
    dismiss: (ruleId: string) => userId && dismiss(userId, today, ruleId),
  };
}
