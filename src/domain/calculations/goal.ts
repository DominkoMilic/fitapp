import { addDays, type IsoDate } from './dates';

export interface GoalProjection {
  /** Planned loss per week at the chosen rate. */
  expectedRateKgPerWeek: number;
  weeks: { fast: number; mid: number; slow: number };
  /** An estimate: real progress varies from week to week. */
  dates: { earliest: IsoDate; mid: IsoDate; latest: IsoDate };
}

/**
 * When a weight-loss goal could be reached at the chosen weekly rate (spec 8.8): the planned
 * loss is `weeklyRatePct` % of the current weight per week, shown as a range (±25 %) because
 * real progress varies. Null when there is nothing to lose or no rate.
 */
export function projectGoalDate(input: {
  currentWeightKg: number;
  targetWeightKg: number | null;
  weeklyRatePct: number | null;
  asOf: IsoDate;
}): GoalProjection | null {
  if (input.targetWeightKg === null || !input.weeklyRatePct) return null;
  const toLose = input.currentWeightKg - input.targetWeightKg;
  const rate = (input.weeklyRatePct / 100) * input.currentWeightKg;
  if (toLose <= 0 || rate <= 0) return null;
  const weeks = { fast: toLose / (rate * 1.25), mid: toLose / rate, slow: toLose / (rate * 0.75) };
  const at = (w: number) => addDays(input.asOf, Math.round(w * 7));
  return {
    expectedRateKgPerWeek: rate,
    weeks,
    dates: { earliest: at(weeks.fast), mid: at(weeks.mid), latest: at(weeks.slow) },
  };
}
