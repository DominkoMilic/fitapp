/**
 * Manual activity entry (spec 11.8): the user gives duration and optionally distance.
 * No GPS, so quality is 'none'; distance counts for records/milestones (user-entered).
 */
import { paceSecondsPerKm, speedMps } from './geo';
import { activityCalories, type ActivityType } from './met';
import type { ActivitySummary } from './recording';

/** Typical speeds used for the calorie estimate when no distance is given (decision 2026-11-12). */
export const TYPICAL_KMH: Record<ActivityType, number> = { walk: 5, run: 10, cycle: 18, other: 0 };

export const MANUAL_LIMITS = { maxMinutes: 24 * 60, maxKm: 1000 } as const;

export function manualSummary(input: {
  type: ActivityType;
  endedAt: number;
  minutes: number;
  distanceKm: number | null;
  weightKg: number | null;
}): ActivitySummary {
  const movingS = Math.round(input.minutes * 60);
  const distanceM = input.distanceKm ? Math.round(input.distanceKm * 1000) : 0;
  const avg = speedMps(distanceM, movingS);
  const kmh = distanceM ? avg * 3.6 : TYPICAL_KMH[input.type];
  return {
    type: input.type,
    startedAt: input.endedAt - movingS * 1000,
    endedAt: input.endedAt,
    elapsedS: movingS,
    movingS,
    distanceM,
    avgSpeedMps: avg,
    maxSpeedMps: 0,
    avgPaceSPerKm: distanceM ? paceSecondsPerKm(distanceM, movingS) : null,
    kcal: input.weightKg ? activityCalories(input.type, kmh, input.weightKg, movingS) : null,
    quality: 'none',
    pointsTotal: 0,
    pointsValid: 0,
    isShort: false,
  };
}

export function validateManual(minutes: number | null, distanceKm: number | null): string | null {
  if (!minutes || minutes < 1 || minutes > MANUAL_LIMITS.maxMinutes)
    return 'Duration must be between 1 minute and 24 hours';
  if (distanceKm !== null && (distanceKm < 0 || distanceKm > MANUAL_LIMITS.maxKm))
    return 'Distance must be between 0 and 1000 km';
  return null;
}
