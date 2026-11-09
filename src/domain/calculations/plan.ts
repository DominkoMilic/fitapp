import { CALCULATION_VERSION } from '@/constants/safety';

import { ageOn, type IsoDate } from './dates';
import {
  ACTIVITY_MULTIPLIERS,
  type ActivityLevel,
  bmrMifflinStJeor,
  type CalcSex,
  tdee,
} from './energy';
import {
  calorieTarget,
  type CalorieTargetResult,
  type GoalType,
  macroTargets,
  type MacroTargets,
  type Projection,
  projectGoal,
  referenceWeight,
  sportCarbAdvice,
  waterTarget,
} from './targets';

export interface PlanInputs {
  sex: CalcSex;
  dateOfBirth: IsoDate;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  targetWeightKg: number | null;
  weeklyRatePct: number | null;
  asOf: IsoDate;
  /** Weekly training (8.4, 8.6). Absent = no adjustments (same results as version 2.0.0). */
  training?: TrainingSummary;
}

export type TrainingSummary = {
  /** Games and hard practices per week. */
  hardSessionsPerWeek: number;
  /** All planned sessions per week (training days + games + practices). */
  sessionsPerWeek: number;
  playsSport: boolean;
};

export interface NutritionPlan {
  calculationVersion: string;
  inputs: PlanInputs;
  age: number;
  bmr: number;
  activityMultiplier: number;
  tdee: number;
  calories: CalorieTargetResult;
  macros: MacroTargets;
  waterMl: number;
  projection: Projection | null;
  /** Information for sport players (8.6); never changes the macros. */
  sportCarbs: { low: boolean; suggestedMinG: number } | null;
}

/** Computes every onboarding target in one place (spec section 8). Pure. */
export function calculateNutritionPlan(inputs: PlanInputs): NutritionPlan {
  const age = ageOn(inputs.dateOfBirth, inputs.asOf);
  const bmr = bmrMifflinStJeor({
    sex: inputs.sex,
    weightKg: inputs.weightKg,
    heightCm: inputs.heightCm,
    age,
  });
  const dailyTdee = tdee(bmr, inputs.activityLevel);
  const calories = calorieTarget({
    goalType: inputs.goalType,
    tdee: dailyTdee,
    bmr,
    sex: inputs.sex,
    weightKg: inputs.weightKg,
    weeklyRatePct: inputs.weeklyRatePct,
    hardSessionsPerWeek: inputs.training?.hardSessionsPerWeek,
  });
  const macros = macroTargets({
    kcal: calories.kcal,
    referenceWeightKg: referenceWeight({
      goalType: inputs.goalType,
      weightKg: inputs.weightKg,
      heightCm: inputs.heightCm,
      targetWeightKg: inputs.targetWeightKg,
    }),
  });
  return {
    calculationVersion: CALCULATION_VERSION,
    inputs,
    age,
    bmr,
    activityMultiplier: ACTIVITY_MULTIPLIERS[inputs.activityLevel],
    tdee: dailyTdee,
    calories,
    macros,
    waterMl: waterTarget(inputs.weightKg),
    sportCarbs: inputs.training
      ? sportCarbAdvice({
          carbsG: macros.carbsG,
          weightKg: inputs.weightKg,
          playsSport: inputs.training.playsSport,
          sessionsPerWeek: inputs.training.sessionsPerWeek,
        })
      : null,
    projection:
      inputs.goalType === 'lose_weight'
        ? projectGoal({
            currentWeightKg: inputs.weightKg,
            targetWeightKg: inputs.targetWeightKg,
            tdee: dailyTdee,
            targetKcal: calories.kcal,
            asOf: inputs.asOf,
          })
        : null,
  };
}

/** Weekly training summary for the nutrition plan, from the schedule (8.4, 8.6). */
export function trainingSummary(input: {
  commitments: readonly { intensity: string }[];
  trainingDaysPerWeek: number;
  sports: readonly string[];
}): TrainingSummary {
  return {
    hardSessionsPerWeek: input.commitments.filter((c) => c.intensity === 'hard').length,
    sessionsPerWeek: input.trainingDaysPerWeek + input.commitments.length,
    playsSport: input.sports.length > 0,
  };
}
