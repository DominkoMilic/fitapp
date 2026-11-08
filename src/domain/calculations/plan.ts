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
}

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
