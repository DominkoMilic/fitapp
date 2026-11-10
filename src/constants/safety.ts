/**
 * Safety constants (spec section 8). Configurable for development, not by end users in V1.
 */
export const MIN_AGE_YEARS = 18;
export const MAX_AGE_YEARS = 100;
export const MIN_TARGET_BMI = 18.5;

export const WEEKLY_RATE = {
  lose: { min: 0.25, max: 1.0, warnAbove: 0.75, default: 0.5 },
  build: { min: 0.1, max: 0.25, default: 0.15 },
} as const;

export const LIMITS = {
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 350 },
  steps: { min: 0, max: 60000 },
  sessionMinutes: { min: 15, max: 120 },
} as const;
