/**
 * Manual activity entry (spec 11.8): the user gives duration and optionally distance.
 * No GPS, so quality is 'none'; distance counts for records/milestones (user-entered).
 */
import { paceSecondsPerKm, speedMps } from './geo';
import { activityCalories, type ActivityType } from './met';
import type { ActivitySummary } from './recording';

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
    // Spec 11.8: calories only when a distance is given (the MET depends on speed).
    kcal:
      input.weightKg && distanceM
        ? activityCalories(input.type, avg * 3.6, input.weightKg, movingS)
        : null,
    quality: 'none',
    pointsTotal: 0,
    pointsValid: 0,
    isShort: false,
  };
}

/** Validation per field, so each message can be shown on its own field. Pure. */
export function validateManualFields(
  minutes: number | null,
  distanceKm: number | null,
): { minutes?: string; distance?: string } {
  const e: { minutes?: string; distance?: string } = {};
  if (!minutes || minutes < 1 || minutes > MANUAL_LIMITS.maxMinutes)
    e.minutes = 'Duration must be between 1 minute and 24 hours';
  if (distanceKm !== null && (distanceKm < 0 || distanceKm > MANUAL_LIMITS.maxKm))
    e.distance = 'Distance must be between 0 and 1000 km';
  return e;
}

export function validateManual(minutes: number | null, distanceKm: number | null): string | null {
  const e = validateManualFields(minutes, distanceKm);
  return e.minutes ?? e.distance ?? null;
}
