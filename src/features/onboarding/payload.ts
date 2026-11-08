import { type NutritionPlan } from '@/domain/calculations/plan';
import {
  checkEditedCalories,
  targetsFromEditedCalories,
  targetsFromEditedMacros,
  type MacroTargets,
} from '@/domain/calculations/targets';
import { AREA_RESTRICTIONS } from '@/domain/training/injury';
import { type WeeklyPattern } from '@/domain/training/weekly-pattern';
import type {
  ActivityValues,
  ConsentValues,
  EquipmentValues,
  GoalsValues,
  HealthValues,
  NutritionValues,
  PersonalValues,
  ScheduleValues,
} from '@/domain/validation/onboarding';

import type { TargetOverrides } from './draft-store';

export interface CompleteDraft {
  personal: PersonalValues;
  goals: GoalsValues;
  activity: ActivityValues;
  equipment: EquipmentValues;
  schedule: ScheduleValues;
  nutrition: NutritionValues;
  health: HealthValues;
  consent: ConsentValues;
  overrides: TargetOverrides | null;
}

/** Applies the user's edits to calculated targets (spec 8.6 editing rules). */
export function finalTargets(
  plan: NutritionPlan,
  overrides: TargetOverrides | null,
): MacroTargets & { edited: boolean } {
  const ref = plan.macros.referenceWeightKg;
  if (!overrides) return { ...plan.macros, edited: false };
  if (overrides.proteinG !== null && overrides.carbsG !== null && overrides.fatG !== null) {
    return {
      ...targetsFromEditedMacros({
        proteinG: overrides.proteinG,
        carbsG: overrides.carbsG,
        fatG: overrides.fatG,
        referenceWeightKg: ref,
      }),
      edited: true,
    };
  }
  if (overrides.kcal !== null) {
    return {
      ...targetsFromEditedCalories({
        kcal: overrides.kcal,
        proteinG: plan.macros.proteinG,
        fatG: plan.macros.fatG,
        referenceWeightKg: ref,
      }),
      edited: true,
    };
  }
  return { ...plan.macros, edited: false };
}

export class TargetBelowFloorError extends Error {
  constructor(public readonly floorKcal: number) {
    super(`Calorie target is below the safety minimum of ${floorKcal} kcal`);
  }
}

/** Builds the JSON payload for public.complete_onboarding (see the migration for the contract). */
export function buildOnboardingPayload(input: {
  draft: CompleteDraft;
  plan: NutritionPlan;
  pattern: WeeklyPattern;
  legalVersion: string;
}) {
  const { draft, plan, pattern, legalVersion } = input;
  const targets = finalTargets(plan, draft.overrides);
  const check = checkEditedCalories(targets.kcal, plan.calories.floorKcal);
  if (!check.ok) throw new TargetBelowFloorError(check.floorKcal);

  const asOf = plan.inputs.asOf;
  const hasHealth = draft.health.injuries.length > 0;
  const g = draft.goals;
  const usesTarget = g.goalType === 'lose_weight' || g.goalType === 'build_muscle';

  return {
    profile: {
      display_name: draft.personal.displayName.trim(),
      date_of_birth: draft.personal.dateOfBirth,
      calc_sex: draft.personal.calcSex,
      height_cm: Math.round(draft.personal.heightCm * 10) / 10,
      unit_system: draft.personal.unitSystem,
      timezone: draft.personal.timezone,
      activity_level: draft.activity.activityLevel,
      average_daily_steps: draft.activity.averageDailySteps,
    },
    goal: {
      goal_type: g.goalType,
      focus_tags: g.focusTags,
      starting_weight_kg: Math.round(draft.personal.weightKg * 100) / 100,
      target_weight_kg: usesTarget ? g.targetWeightKg : null,
      secondary_target_weight_kg: g.goalType === 'lose_weight' ? g.secondaryTargetWeightKg : null,
      weekly_rate_pct: usesTarget ? g.weeklyRatePct : null,
      target_date: g.targetDate,
    },
    preferences: {
      diet_type: draft.nutrition.dietType,
      allergies: draft.nutrition.allergies,
      intolerances: draft.nutrition.intolerances,
      disliked_foods: draft.nutrition.dislikedFoods,
      preferred_cuisines: draft.nutrition.preferredCuisines,
      meals_per_day: draft.nutrition.mealsPerDay,
      cooking_time_max_minutes: draft.nutrition.cookingTimeMaxMinutes,
      household_servings: draft.nutrition.householdServings,
      training_days_per_week: draft.schedule.trainingDaysPerWeek,
      preferred_training_days: draft.schedule.preferredDays,
      max_session_minutes: draft.schedule.maxSessionMinutes,
      preferred_training_time: draft.schedule.preferredTime,
      training_environment: draft.equipment.environment,
    },
    equipment: draft.equipment.items.map((i) => ({
      equipment_type: i.type,
      custom_name: i.type === 'custom' ? i.customName : null,
      max_weight_kg: i.maxWeightKg,
    })),
    health_conditions: draft.health.injuries.map((i) => ({
      id: i.id,
      kind: 'injury',
      body_area: i.bodyArea,
      side: i.side,
      description: i.description || null,
      status: i.status,
      pain_level: i.painLevel,
      restriction_tags: [...AREA_RESTRICTIONS[i.bodyArea]],
      professional_clearance: i.professionalClearance,
      onset_date: i.onsetDate,
    })),
    consents: [
      { consent_type: 'terms', document_version: legalVersion, granted: draft.consent.terms },
      { consent_type: 'privacy', document_version: legalVersion, granted: draft.consent.privacy },
      ...(hasHealth || draft.consent.healthData
        ? [
            {
              consent_type: 'health_data',
              document_version: legalVersion,
              granted: draft.consent.healthData,
            },
          ]
        : []),
      {
        consent_type: 'notifications',
        document_version: legalVersion,
        granted: draft.consent.notifications,
      },
    ],
    targets: {
      effective_from: asOf,
      kcal: targets.kcal,
      protein_g: targets.proteinG,
      carbs_g: targets.carbsG,
      fat_g: targets.fatG,
      fibre_g: targets.fibreG,
      water_ml: plan.waterMl,
      bmr: Math.round(plan.bmr * 100) / 100,
      tdee: Math.round(plan.tdee * 100) / 100,
      floor_kcal: plan.calories.floorKcal,
      limited_by_floor: plan.calories.limitedByFloor,
      is_user_edited: targets.edited,
      calculation_version: plan.calculationVersion,
      calculation_inputs: {
        ...plan.inputs,
        activityMultiplier: plan.activityMultiplier,
        age: plan.age,
      },
    },
    plan: {
      name: planName(g.goalType, g.focusTags),
      start_date: asOf,
      generator_version: pattern.version,
      generated_from: {
        trainingDaysPerWeek: draft.schedule.trainingDaysPerWeek,
        preferredDays: draft.schedule.preferredDays,
        maxSessionMinutes: draft.schedule.maxSessionMinutes,
        focusTags: g.focusTags,
        equipment: draft.equipment.items.map((i) => i.type),
      },
      weekly_pattern: pattern.days.map((d) => ({
        weekday: d.weekday,
        kind: d.kind,
        title: d.title,
        intensity: d.intensity,
        minutes: d.minutes,
        template_slug: d.templateSlug,
        notes: d.notes,
      })),
    },
    recurring_events: draft.schedule.commitments.map((c) => ({
      title: c.title.trim(),
      category: c.category,
      weekday: c.weekday,
      local_time: c.localTime,
      timezone: draft.personal.timezone,
      duration_minutes: c.durationMinutes,
      intensity: c.intensity,
    })),
  };
}

export type OnboardingPayload = ReturnType<typeof buildOnboardingPayload>;

function planName(goal: GoalsValues['goalType'], focus: readonly string[]): string {
  const base = {
    lose_weight: 'Fat loss',
    maintain: 'Maintenance',
    build_muscle: 'Muscle gain',
    general_fitness: 'General fitness',
  }[goal];
  if (focus.includes('futsal')) return `${base} + futsal`;
  if (focus.includes('running')) return `${base} + running`;
  return base;
}
