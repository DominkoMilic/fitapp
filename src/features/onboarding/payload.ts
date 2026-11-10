import { AREA_RESTRICTIONS } from '@/domain/training/injury';
import { type WeeklyPattern } from '@/domain/training/weekly-pattern';
import type {
  ActivityValues,
  ConsentValues,
  EquipmentValues,
  GoalsValues,
  HealthValues,
  PersonalValues,
  ScheduleValues,
} from '@/domain/validation/onboarding';

import { SPORT_BY_KEY } from '@/domain/sports/catalogue';

export interface CompleteDraft {
  personal: PersonalValues;
  goals: GoalsValues;
  activity: ActivityValues;
  equipment: EquipmentValues;
  schedule: ScheduleValues;
  health: HealthValues;
  consent: ConsentValues;
}

/** Builds the JSON payload for public.complete_onboarding (see the migration for the contract). */
export function buildOnboardingPayload(input: {
  draft: CompleteDraft;
  pattern: WeeklyPattern;
  legalVersion: string;
  /** Today in the user's time zone; the plan starts on this day. */
  asOf: string;
}) {
  const { draft, pattern, legalVersion, asOf } = input;
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
      training_days_per_week: draft.schedule.trainingDaysPerWeek,
      preferred_training_days: draft.schedule.preferredDays,
      max_session_minutes: draft.schedule.maxSessionMinutes,
      preferred_training_time: draft.schedule.preferredTime,
      training_environment: draft.equipment.environment,
      sports: g.sports,
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
    plan: {
      name: planName(g.goalType, g.focusTags, g.sports),
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

function planName(
  goal: GoalsValues['goalType'],
  focus: readonly string[],
  sports: readonly string[],
): string {
  const base = {
    lose_weight: 'Fat loss',
    maintain: 'Maintenance',
    build_muscle: 'Muscle gain',
    general_fitness: 'General fitness',
  }[goal];
  const sport = sports[0] ? SPORT_BY_KEY[sports[0]] : undefined;
  if (sport && sport.key !== 'other') return `${base} + ${sport.label.toLowerCase()}`;
  if (focus.includes('running')) return `${base} + running`;
  return base;
}
