import { useMemo } from 'react';

import { addDays } from '@/domain/calculations/dates';
import {
  averageChange,
  currentWeight,
  dailyValues,
  estimateTargetDates,
  goalProgressPct,
  trendLast21Days,
} from '@/domain/weight/trend';
import { useToday } from '@/features/dashboard/useToday';
import { useActiveGoal } from '@/features/profile/api';

import { useWeightEntries } from './api';

export type RangeKey = '7D' | '30D' | '90D' | '6M' | '1Y' | 'All';
export const RANGE_DAYS: Record<RangeKey, number | null> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '6M': 183,
  '1Y': 365,
  All: null,
};

/** Everything the weight screens need, derived from entries + goal by domain functions. */
export function useWeightStats(range: RangeKey = '30D') {
  const { today } = useToday();
  const weights = useWeightEntries();
  const goal = useActiveGoal();
  return useMemo(() => {
    const daily = dailyValues(weights.entries);
    const days = RANGE_DAYS[range];
    const inRange =
      days === null ? daily : daily.filter((d) => d.date >= addDays(today, -(days - 1)));
    const current = currentWeight(daily);
    const g = goal.data;
    const startKg = g ? Number(g.starting_weight_kg) : null;
    const targetKg = g?.target_weight_kg != null ? Number(g.target_weight_kg) : null;
    const trend = trendLast21Days(daily, today);
    return {
      weights,
      goal,
      daily,
      inRange,
      current,
      startKg,
      targetKg,
      secondaryKg:
        g?.secondary_target_weight_kg != null ? Number(g.secondary_target_weight_kg) : null,
      change7: averageChange(daily, 7),
      change30: averageChange(daily, 30),
      changeSinceStart: current && startKg !== null ? current.kg - startKg : null,
      progressPct:
        current && startKg !== null && targetKg !== null && g?.goal_type === 'lose_weight'
          ? goalProgressPct(startKg, current.kg, targetKg)
          : null,
      estimate:
        current && targetKg !== null && g?.goal_type === 'lose_weight'
          ? estimateTargetDates({ currentKg: current.kg, targetKg, trend, today })
          : null,
      trend,
      today,
    };
  }, [weights, goal, range, today]);
}
