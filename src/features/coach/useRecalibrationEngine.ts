import { useEffect, useMemo, useRef } from 'react';

import { addDays } from '@/domain/calculations/dates';
import { checkWindow, isCheckDue, recalibrate } from '@/domain/coach/recalibration';
import { currentWeight, dailyValues, trendLast21Days } from '@/domain/weight/trend';
import { useCheckins } from '@/features/checkin/api';
import { targetFor } from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { useActiveGoal, useTargetHistory } from '@/features/profile/api';
import { useFeatures } from '@/features/profile/features';
import { useWeightEntries } from '@/features/weight/api';

import { useAdjustments, useNutritionRange, useRecordCheck } from './api';

/**
 * Runs the two-weekly check when the app opens (spec 8.9) and records it. Proposals wait for the
 * user on the review screen; nothing changes the target without their confirmation.
 * Only for weight-loss goals (the rules are defined for loss).
 */
export function useRecalibrationEngine() {
  const { today } = useToday();
  const goal = useActiveGoal();
  const targets = useTargetHistory();
  const weights = useWeightEntries();
  const checkins = useCheckins();
  const adjustments = useAdjustments();
  const window = checkWindow(today);
  const nutrition = useNutritionRange(window.start, window.end);
  const record = useRecordCheck();
  const ran = useRef<string | null>(null);
  const features = useFeatures();

  const ready =
    goal.isSuccess &&
    targets.isSuccess &&
    weights.isSuccess &&
    checkins.isSuccess &&
    adjustments.isSuccess &&
    nutrition.isSuccess;

  const plan = useMemo(() => {
    if (!ready) return null;
    const g = goal.data;
    const current = targetFor(targets.data ?? [], today);
    // Calorie target reviews need food logging; none while nutrition is switched off.
    if (!features.nutrition) return null;
    if (!g || g.goal_type !== 'lose_weight' || !g.weekly_rate_pct || !current) return null;
    const history = adjustments.data ?? [];
    const last = history[0] ?? null;
    const recentAccept = history.some(
      (a) => a.status === 'accepted' && a.window_end > addDays(today, -14),
    );
    if (
      recentAccept ||
      !isCheckDue({
        today,
        lastCheckOn: last?.window_end ?? null,
        targetSince: current.effective_from,
      })
    )
      return null;

    const daily = dailyValues(weights.entries);
    const weight = currentWeight(daily);
    const trend = trendLast21Days(daily, today);
    const complete = nutrition.data?.completeDays ?? [];
    const meanIntake = complete.length
      ? complete.reduce((a, d) => a + d.kcal, 0) / complete.length
      : null;
    const fatigue = checkins.rows
      .filter(
        (c) => c.local_date >= window.start && c.local_date <= window.end && c.fatigue !== null,
      )
      .map((c) => c.fatigue as number);
    const weightKg = weight?.kg ?? Number(g.starting_weight_kg);
    const input = {
      currentKcal: current.kcal,
      floorKcal: current.floor_kcal ?? 1200,
      targetRateKgWeek: (Number(g.weekly_rate_pct) / 100) * weightKg,
      currentWeightKg: weightKg,
      slopeKgPerWeek: trend?.slopeKgPerWeek ?? null,
      meanIntakeKcal: meanIntake,
      adherence: complete.length / 21,
      previousSlow: last?.slow ?? false,
      avgFatigue: fatigue.length ? fatigue.reduce((a, b) => a + b, 0) / fatigue.length : null,
    };
    return { input, result: recalibrate(input), complete: complete.length };
  }, [
    ready,
    features.nutrition,
    goal.data,
    targets.data,
    adjustments.data,
    weights.entries,
    checkins.rows,
    nutrition.data,
    today,
    window.start,
    window.end,
  ]);

  useEffect(() => {
    if (!plan || ran.current === today) return;
    ran.current = today;
    const { input, result } = plan;
    record.mutate({
      window_start: window.start,
      window_end: window.end,
      current_kcal: input.currentKcal,
      proposed_kcal: result.proposedKcal,
      observed_tdee: result.observedTdee,
      actual_rate_kg_week:
        result.actualRateKgWeek === null ? null : Math.round(result.actualRateKgWeek * 1000) / 1000,
      adherence: Math.round(input.adherence * 1000) / 1000,
      reason_code: result.reason,
      slow: result.slow,
      status: result.proposedKcal === null ? 'no_change' : 'proposed',
      inputs: {
        ...input,
        completeDays: plan.complete,
        windowDays: 21,
        message: result.message,
      },
    });
  }, [plan, today, record, window.start, window.end]);
}
