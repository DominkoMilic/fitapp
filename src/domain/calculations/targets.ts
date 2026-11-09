import {
  FAT_PCT,
  FIBRE_G_PER_1000_KCAL,
  KCAL_PER_KG,
  MACRO_TOLERANCE_KCAL,
  MAX_DEFICIT_FRACTION,
  MAX_DEFICIT_KCAL,
  MAX_SURPLUS_KCAL,
  FREQUENT_TRAINING,
  SPORT_CARBS,
  MIN_CARBS_WARNING_G,
  PROTEIN_G_PER_KG,
  SEX_FLOOR_KCAL,
  WATER,
} from '@/constants/safety';

import { addDays, type IsoDate } from './dates';
import { bmi, type CalcSex, weightAtBmi } from './energy';
import { clamp, roundTo10, roundTo50 } from './rounding';

export type GoalType = 'lose_weight' | 'maintain' | 'build_muscle' | 'general_fitness';

// ------------------------------------------------------------------ calories

/** Safety floor (spec 8.5): max(sex floor, BMR rounded to 10). */
export const safetyFloor = (sex: CalcSex, bmr: number): number =>
  Math.max(SEX_FLOOR_KCAL[sex], roundTo10(bmr));

export interface CalorieTargetResult {
  kcal: number;
  floorKcal: number;
  limitedByFloor: boolean;
  /** Daily deficit (positive) or surplus (negative) actually applied before flooring. */
  requestedAdjustment: number;
  deficitCapped: boolean;
  /** Projected weekly change in kg (positive = loss) at this target, from the estimated TDEE. */
  projectedRateKgPerWeek: number;
  /** The smaller deficit cap for 4+ hard sessions a week was applied (8.4). */
  frequentTrainingCap: boolean;
}

/** Calorie target (spec 8.4). weeklyRatePct is a percentage of body weight, e.g. 0.5. */
export function calorieTarget(input: {
  goalType: GoalType;
  tdee: number;
  bmr: number;
  sex: CalcSex;
  weightKg: number;
  weeklyRatePct: number | null;
  /** Hard sessions a week (games, hard practices). 4+ lowers the maximum deficit to 500 kcal. */
  hardSessionsPerWeek?: number;
}): CalorieTargetResult {
  const floorKcal = safetyFloor(input.sex, input.bmr);
  const ratePct = input.weeklyRatePct ?? 0;
  const weeklyKcal = (ratePct / 100) * input.weightKg * KCAL_PER_KG;
  let raw = input.tdee;
  let requestedAdjustment = 0;
  let deficitCapped = false;
  let frequentTrainingCap = false;

  if (input.goalType === 'lose_weight') {
    const desired = weeklyKcal / 7;
    const frequent = (input.hardSessionsPerWeek ?? 0) >= FREQUENT_TRAINING.hardSessionsPerWeek;
    const maxKcal = frequent ? FREQUENT_TRAINING.maxDeficitKcal : MAX_DEFICIT_KCAL;
    const deficit = Math.min(desired, maxKcal, MAX_DEFICIT_FRACTION * input.tdee);
    frequentTrainingCap =
      frequent && desired > FREQUENT_TRAINING.maxDeficitKcal && deficit === maxKcal;
    deficitCapped = deficit < desired;
    requestedAdjustment = deficit;
    raw = input.tdee - deficit;
  } else if (input.goalType === 'build_muscle') {
    const surplus = Math.min(weeklyKcal / 7, MAX_SURPLUS_KCAL);
    requestedAdjustment = -surplus;
    raw = input.tdee + surplus;
  }

  const rounded = roundTo10(raw);
  const kcal = Math.max(rounded, floorKcal);
  return {
    kcal,
    floorKcal,
    limitedByFloor: kcal > rounded,
    requestedAdjustment,
    deficitCapped,
    projectedRateKgPerWeek: ((input.tdee - kcal) * 7) / KCAL_PER_KG,
    frequentTrainingCap,
  };
}

// ------------------------------------------------------------------- macros

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  referenceWeightKg: number;
  warnings: MacroWarning[];
}

export type MacroWarning = 'low_carbs' | 'high_protein' | 'kcal_mismatch';

/** Reference weight for protein (spec 8.6). */
export function referenceWeight(input: {
  goalType: GoalType;
  weightKg: number;
  heightCm: number;
  targetWeightKg: number | null;
}): number {
  if (
    input.goalType === 'lose_weight' &&
    input.targetWeightKg !== null &&
    input.targetWeightKg < input.weightKg
  ) {
    return input.targetWeightKg;
  }
  if (bmi(input.weightKg, input.heightCm) >= 30) return weightAtBmi(25, input.heightCm);
  return input.weightKg;
}

export const macroKcal = (proteinG: number, carbsG: number, fatG: number): number =>
  proteinG * 4 + carbsG * 4 + fatG * 9;

export function macroWarnings(m: {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  referenceWeightKg: number;
}): MacroWarning[] {
  const warnings: MacroWarning[] = [];
  if (m.carbsG < MIN_CARBS_WARNING_G) warnings.push('low_carbs');
  if (m.proteinG / m.referenceWeightKg > PROTEIN_G_PER_KG.warnAbove) warnings.push('high_protein');
  if (Math.abs(macroKcal(m.proteinG, m.carbsG, m.fatG) - m.kcal) > MACRO_TOLERANCE_KCAL) {
    warnings.push('kcal_mismatch');
  }
  return warnings;
}

export const fibreTarget = (kcal: number): number =>
  Math.round((kcal / 1000) * FIBRE_G_PER_1000_KCAL);

export function macroTargets(input: {
  kcal: number;
  referenceWeightKg: number;
  proteinGPerKg?: number;
  fatPct?: number;
}): MacroTargets {
  const proteinPerKg = clamp(
    input.proteinGPerKg ?? PROTEIN_G_PER_KG.default,
    PROTEIN_G_PER_KG.min,
    PROTEIN_G_PER_KG.max,
  );
  const fatPct = clamp(input.fatPct ?? FAT_PCT.default, FAT_PCT.min, FAT_PCT.max);
  const proteinG = Math.round(proteinPerKg * input.referenceWeightKg);
  const fatG = Math.round((fatPct * input.kcal) / 9);
  const carbsG = Math.max(0, Math.floor((input.kcal - proteinG * 4 - fatG * 9) / 4));
  const base = {
    kcal: input.kcal,
    proteinG,
    carbsG,
    fatG,
    referenceWeightKg: input.referenceWeightKg,
  };
  return { ...base, fibreG: fibreTarget(input.kcal), warnings: macroWarnings(base) };
}

/** Editing macros directly: calories are derived from macros (single source of truth). */
export function targetsFromEditedMacros(m: {
  proteinG: number;
  carbsG: number;
  fatG: number;
  referenceWeightKg: number;
}): MacroTargets {
  const kcal = macroKcal(m.proteinG, m.carbsG, m.fatG);
  const base = { ...m, kcal };
  return { ...base, fibreG: fibreTarget(kcal), warnings: macroWarnings(base) };
}

/** Editing calories: protein and fat stay, carbs absorb the change. */
export function targetsFromEditedCalories(m: {
  kcal: number;
  proteinG: number;
  fatG: number;
  referenceWeightKg: number;
}): MacroTargets {
  const carbsG = Math.max(0, Math.floor((m.kcal - m.proteinG * 4 - m.fatG * 9) / 4));
  const base = { ...m, carbsG };
  return { ...base, fibreG: fibreTarget(m.kcal), warnings: macroWarnings(base) };
}

export type TargetEditCheck =
  { ok: true } | { ok: false; reason: 'below_floor'; floorKcal: number };

/** Manual edits below the safety floor are blocked (spec 3.1 #3). */
export function checkEditedCalories(kcal: number, floorKcal: number): TargetEditCheck {
  return kcal < floorKcal ? { ok: false, reason: 'below_floor', floorKcal } : { ok: true };
}

// -------------------------------------------------------------------- water

export const waterTarget = (weightKg: number): number =>
  clamp(roundTo50(WATER.mlPerKg * weightKg), WATER.min, WATER.max);

// --------------------------------------------------------------- projection

export interface Projection {
  expectedRateKgPerWeek: number;
  weeks: { fast: number; mid: number; slow: number };
  dates: { earliest: IsoDate; mid: IsoDate; latest: IsoDate };
}

/**
 * Goal projection as a range (spec 8.8). Returns null when no date can honestly be shown
 * (no target, wrong direction, or non-positive expected rate).
 */
export function projectGoal(input: {
  currentWeightKg: number;
  targetWeightKg: number | null;
  tdee: number;
  targetKcal: number;
  asOf: IsoDate;
}): Projection | null {
  if (input.targetWeightKg === null) return null;
  const toLose = input.currentWeightKg - input.targetWeightKg;
  const rate = ((input.tdee - input.targetKcal) * 7) / KCAL_PER_KG;
  if (toLose <= 0 || rate <= 0) return null;
  const weeks = {
    fast: toLose / (rate * 1.25),
    mid: toLose / rate,
    slow: toLose / (rate * 0.75),
  };
  const at = (w: number) => addDays(input.asOf, Math.round(w * 7));
  return {
    expectedRateKgPerWeek: rate,
    weeks,
    dates: { earliest: at(weeks.fast), mid: at(weeks.mid), latest: at(weeks.slow) },
  };
}

/**
 * Carbohydrate guidance for people who play a sport and train 3+ times a week (8.6). Information
 * only; the macro split is not changed. Team/court sport guidance starts around 3 g/kg on
 * training days.
 */
export function sportCarbAdvice(input: {
  carbsG: number;
  weightKg: number;
  playsSport: boolean;
  sessionsPerWeek: number;
}): { low: boolean; suggestedMinG: number } {
  const suggestedMinG = Math.round(SPORT_CARBS.minGPerKg * input.weightKg);
  return {
    low:
      input.playsSport &&
      input.sessionsPerWeek >= SPORT_CARBS.sessionsPerWeek &&
      input.carbsG < suggestedMinG,
    suggestedMinG,
  };
}
