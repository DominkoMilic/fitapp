import { useMemo } from 'react';

import { MEAL_TYPES, type MealType, sumNutrition, type Totals } from '@/domain/nutrition/totals';
import { targetFor } from '@/features/dashboard/today';
import { useTargetHistory } from '@/features/profile/api';

import type { Synced } from '@/features/sync/useSyncedRows';

import { type MealLogItem, useDayLog, useDayStatus, useWater } from './api';

/** Everything the nutrition dashboard and Home need for one local date. */
export function useNutritionDay(date: string) {
  const log = useDayLog(date);
  const water = useWater(date);
  const status = useDayStatus(date);
  const targets = useTargetHistory();
  return useMemo(() => {
    const byMeal = Object.fromEntries(
      MEAL_TYPES.map((m) => [m, log.rows.filter((r) => r.meal_type === m)]),
    ) as Record<MealType, Synced<MealLogItem>[]>;
    const mealTotals = Object.fromEntries(
      MEAL_TYPES.map((m) => [m, sumNutrition(byMeal[m])]),
    ) as Record<MealType, Totals>;
    return {
      log,
      water,
      status,
      target: targetFor(targets.data ?? [], date),
      byMeal,
      mealTotals,
      totals: sumNutrition(log.rows),
      waterMl: water.rows.reduce((a, w) => a + w.amount_ml, 0),
      hasData: log.rows.length > 0,
      isPending: log.isPending || targets.isPending,
    };
  }, [log, water, status, targets.data, targets.isPending, date]);
}
