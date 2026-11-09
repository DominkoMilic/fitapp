/** MET values by average speed (spec 25.4, Adult Compendium 2024). Brackets are lower-inclusive. */
export type ActivityType = 'walk' | 'run' | 'cycle' | 'other';

const BRACKETS: Record<Exclude<ActivityType, 'other'>, [number, number][]> = {
  // [km/h lower bound, MET]
  walk: [
    [0, 2.0],
    [3.2, 3.0],
    [4.4, 3.5],
    [5.2, 4.3],
    [6.0, 5.0],
  ],
  run: [
    [0, 6.0],
    [7.0, 8.3],
    [8.7, 9.8],
    [10.2, 11.0],
    [11.7, 11.8],
    [13.7, 12.8],
    [15.3, 14.5],
  ],
  cycle: [
    [0, 4.0],
    [16, 6.8],
    [19.3, 8.0],
    [22.5, 10.0],
    [25.7, 12.0],
  ],
};

export function metFor(type: ActivityType, avgSpeedKmh: number): number {
  if (type === 'other') return 4.0;
  let met = BRACKETS[type][0]![1];
  for (const [lo, m] of BRACKETS[type]) if (avgSpeedKmh >= lo) met = m;
  return met;
}

/** kcal ≈ MET × kg × moving hours (spec 8.10; always shown as an estimate). */
export const activityCalories = (
  type: ActivityType,
  avgSpeedKmh: number,
  weightKg: number,
  movingSeconds: number,
) => Math.round(metFor(type, avgSpeedKmh) * weightKg * (movingSeconds / 3600));
