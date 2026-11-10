import { useMemo } from 'react';

import {
  averageChange,
  currentWeight,
  dailyValues,
  estimateTargetDates,
  goalProgressPct,
  trendLast21Days,
} from '@/domain/weight/trend';
import { type RangeKey, rangeStart } from '@/domain/weight/ranges';
import { useToday } from '@/features/dashboard/useToday';
import { useActiveGoal, useProfile } from '@/features/profile/api';

import { useWeightEntries } from './api';

export { CHART_RANGES, type RangeKey } from '@/domain/weight/ranges';

/** Everything the weight screens need, derived from entries + goal by domain functions. */
export function useWeightStats(range: RangeKey = '30D') {
  const { today } = useToday();
  const weights = useWeightEntries();
  const goal = useActiveGoal();
  const weekStartsOn = useProfile().data?.week_start === 7 ? 7 : 1;
  return useMemo(() => {
    const daily = dailyValues(weights.entries);
    /** First day of the selected period (null = all history). */
    const rangeFrom = rangeStart(range, today, weekStartsOn);
    const inRange = rangeFrom === null ? daily : daily.filter((d) => d.date >= rangeFrom);
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
      rangeFrom,
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
  }, [weights, goal, range, today, weekStartsOn]);
}
