/**
 * Safety constants (spec section 8). Configurable for development, not by end users in V1.
 * Changing any value requires bumping CALCULATION_VERSION.
 */
/** 2.1.0: deficit cap for frequent hard training; sport carbohydrate and hydration guidance. */
export const CALCULATION_VERSION = '2.1.0';

export const KCAL_PER_KG = 7700;
export const MAX_DEFICIT_KCAL = 750;
export const MAX_DEFICIT_FRACTION = 0.25;
export const MAX_SURPLUS_KCAL = 300;
/**
 * People with 4+ hard sessions a week (games, hard practices) get a smaller maximum deficit, to
 * lower the risk of low energy availability (RED-S). Spec 8.4.
 */
export const FREQUENT_TRAINING = { hardSessionsPerWeek: 4, maxDeficitKcal: 500 } as const;
/** Team/court sport players training 3+ times a week: carbohydrate guidance from 3 g/kg. Spec 8.6. */
export const SPORT_CARBS = { minGPerKg: 3, sessionsPerWeek: 3 } as const;
/** Display guidance only (the water target itself is unchanged): extra per hour of training. */
export const HYDRATION_ML_PER_TRAINING_HOUR = 500;

/** Minimum calorie target by metabolic equation. */
export const SEX_FLOOR_KCAL = { male: 1500, female: 1200 } as const;

export const MIN_AGE_YEARS = 18;
export const MAX_AGE_YEARS = 100;
export const MIN_TARGET_BMI = 18.5;

export const WEEKLY_RATE = {
  lose: { min: 0.25, max: 1.0, warnAbove: 0.75, default: 0.5 },
  build: { min: 0.1, max: 0.25, default: 0.15 },
} as const;

export const PROTEIN_G_PER_KG = { min: 1.6, max: 2.2, default: 1.8, warnAbove: 2.5 } as const;
export const FAT_PCT = { min: 0.2, max: 0.35, default: 0.25 } as const;
export const MIN_CARBS_WARNING_G = 50;
export const MACRO_TOLERANCE_KCAL = 10;
export const FIBRE_G_PER_1000_KCAL = 14;

export const WATER = { mlPerKg: 35, min: 1500, max: 4000 } as const;

export const LIMITS = {
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 350 },
  steps: { min: 0, max: 60000 },
  sessionMinutes: { min: 15, max: 120 },
} as const;
