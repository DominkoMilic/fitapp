import { z } from 'zod';

import {
  LIMITS,
  MAX_AGE_YEARS,
  MIN_AGE_YEARS,
  MIN_TARGET_BMI,
  WEEKLY_RATE,
} from '@/constants/safety';
import { ageOn, isValidIsoDate, type IsoDate } from '@/domain/calculations/dates';
import { bmi } from '@/domain/calculations/energy';
import { isValidCommitmentCategory, SPORT_KEYS } from '@/domain/sports/catalogue';

const isoDate = z.string().refine(isValidIsoDate, 'Enter a valid date');
const weekday = z.number().int().min(1).max(7);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

// ------------------------------------------------------------------ step 1
export const personalSchema = (asOf: IsoDate) =>
  z.object({
    displayName: z.string().trim().min(1, 'Enter a name').max(50, 'Use at most 50 characters'),
    dateOfBirth: isoDate.superRefine((dob, ctx) => {
      if (!isValidIsoDate(dob)) return;
      const age = ageOn(dob, asOf);
      if (age < MIN_AGE_YEARS) {
        ctx.addIssue({ code: 'custom', message: 'PACE is available to people aged 18 and over' });
      } else if (age > MAX_AGE_YEARS) {
        ctx.addIssue({ code: 'custom', message: 'Check your date of birth' });
      }
    }),
    calcSex: z.enum(['male', 'female'], { message: 'Choose one option' }),
    heightCm: z
      .number({ message: 'Enter your height' })
      .min(
        LIMITS.heightCm.min,
        `Height must be between ${LIMITS.heightCm.min} and ${LIMITS.heightCm.max} cm`,
      )
      .max(
        LIMITS.heightCm.max,
        `Height must be between ${LIMITS.heightCm.min} and ${LIMITS.heightCm.max} cm`,
      ),
    weightKg: z
      .number({ message: 'Enter your weight' })
      .min(
        LIMITS.weightKg.min,
        `Weight must be between ${LIMITS.weightKg.min} and ${LIMITS.weightKg.max} kg`,
      )
      .max(
        LIMITS.weightKg.max,
        `Weight must be between ${LIMITS.weightKg.min} and ${LIMITS.weightKg.max} kg`,
      ),
    unitSystem: z.enum(['metric', 'imperial']),
    timezone: z.string().min(1).max(64),
  });
export type PersonalValues = z.infer<ReturnType<typeof personalSchema>>;

// ------------------------------------------------------------------ step 2
export const FOCUS_TAGS = ['strength', 'sport', 'running', 'cardio', 'mobility'] as const;
export const GOAL_TYPES = ['lose_weight', 'maintain', 'build_muscle', 'general_fitness'] as const;

export const goalsSchema = (ctx: { weightKg: number; heightCm: number }) =>
  z
    .object({
      goalType: z.enum(GOAL_TYPES, { message: 'Choose a goal' }),
      targetWeightKg: z.number().min(LIMITS.weightKg.min).max(LIMITS.weightKg.max).nullable(),
      secondaryTargetWeightKg: z
        .number()
        .min(LIMITS.weightKg.min)
        .max(LIMITS.weightKg.max)
        .nullable(),
      weeklyRatePct: z
        .number()
        .min(0)
        .max(WEEKLY_RATE.lose.max, 'At most 1% of body weight per week')
        .nullable(),
      rateWarningAccepted: z.boolean(),
      targetDate: isoDate.nullable(),
      focusTags: z.array(z.enum(FOCUS_TAGS)),
      /** Sports the user plays (sports catalogue keys); empty = no sport. */
      sports: z
        .array(z.string().refine((k) => SPORT_KEYS.includes(k), { message: 'Unknown sport' }))
        .max(8, 'Choose up to 8 sports'),
    })
    .superRefine((v, issue) => {
      if (v.goalType === 'lose_weight') {
        if (v.targetWeightKg === null) {
          issue.addIssue({
            code: 'custom',
            path: ['targetWeightKg'],
            message: 'Enter a target weight',
          });
        } else if (v.targetWeightKg >= ctx.weightKg) {
          issue.addIssue({
            code: 'custom',
            path: ['targetWeightKg'],
            message:
              'Target must be below your current weight. To keep your weight, choose "Maintain".',
          });
        } else if (bmi(v.targetWeightKg, ctx.heightCm) < MIN_TARGET_BMI) {
          issue.addIssue({
            code: 'custom',
            path: ['targetWeightKg'],
            message: 'This target is below a healthy BMI of 18.5. Choose a higher target.',
          });
        }
        if (v.weeklyRatePct === null || v.weeklyRatePct < WEEKLY_RATE.lose.min) {
          issue.addIssue({
            code: 'custom',
            path: ['weeklyRatePct'],
            message: 'Choose a weekly rate',
          });
        } else if (v.weeklyRatePct > WEEKLY_RATE.lose.warnAbove && !v.rateWarningAccepted) {
          issue.addIssue({
            code: 'custom',
            path: ['rateWarningAccepted'],
            message: 'Confirm that you understand this rate is faster than recommended',
          });
        }
        if (
          v.secondaryTargetWeightKg !== null &&
          v.targetWeightKg !== null &&
          (v.secondaryTargetWeightKg >= v.targetWeightKg ||
            bmi(v.secondaryTargetWeightKg, ctx.heightCm) < MIN_TARGET_BMI)
        ) {
          issue.addIssue({
            code: 'custom',
            path: ['secondaryTargetWeightKg'],
            message: 'Secondary target must be below the main target and above a BMI of 18.5',
          });
        }
      }
      if (v.goalType === 'build_muscle') {
        if (v.targetWeightKg === null || v.targetWeightKg <= ctx.weightKg) {
          issue.addIssue({
            code: 'custom',
            path: ['targetWeightKg'],
            message: 'Target must be above your current weight',
          });
        }
        if (
          v.weeklyRatePct === null ||
          v.weeklyRatePct < WEEKLY_RATE.build.min ||
          v.weeklyRatePct > WEEKLY_RATE.build.max
        ) {
          issue.addIssue({
            code: 'custom',
            path: ['weeklyRatePct'],
            message: 'Choose between 0.1% and 0.25% per week',
          });
        }
      }
    });
export type GoalsValues = z.infer<ReturnType<typeof goalsSchema>>;

// ------------------------------------------------------------------ step 3
export const activitySchema = z.object({
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'very', 'extra'], {
    message: 'Choose your activity level',
  }),
  averageDailySteps: z.number().int().min(LIMITS.steps.min).max(LIMITS.steps.max).nullable(),
});
export type ActivityValues = z.infer<typeof activitySchema>;

// ------------------------------------------------------------------ step 4
export const EQUIPMENT_TYPES = [
  'dumbbells',
  'kettlebell',
  'resistance_bands',
  'barbell',
  'bench',
  'exercise_mat',
  'pull_up_bar',
  'treadmill',
  'exercise_bike',
  'jump_rope',
  'football', // legacy: shown as "Ball (any sport)"
  'ball',
  'racket',
  'stick',
  'cones',
  'none',
  'custom',
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const equipmentSchema = z
  .object({
    environment: z.enum(['home', 'gym', 'outdoors', 'mixed']),
    items: z.array(
      z.object({
        type: z.enum(EQUIPMENT_TYPES),
        customName: z.string().trim().min(1).max(60).nullable(),
        maxWeightKg: z.number().min(0.5).max(200).nullable(),
      }),
    ),
  })
  .superRefine((v, issue) => {
    if (v.items.some((i) => i.type === 'none') && v.items.length > 1) {
      issue.addIssue({
        code: 'custom',
        path: ['items'],
        message: '"No equipment" cannot be combined with other items',
      });
    }
    v.items.forEach((item, idx) => {
      if (item.type === 'custom' && !item.customName) {
        issue.addIssue({
          code: 'custom',
          path: ['items', idx, 'customName'],
          message: 'Name this item',
        });
      }
    });
  });
export type EquipmentValues = z.infer<typeof equipmentSchema>;

// ------------------------------------------------------------------ step 5
export const commitmentSchema = z.object({
  title: z.string().trim().min(1, 'Enter a name').max(80),
  // A sport event `<sport>_<type>` from the sports catalogue, or workout / run / walk / cycle / other.
  category: z.string().refine(isValidCommitmentCategory, { message: 'Choose what this is' }),
  weekday,
  localTime: hhmm,
  durationMinutes: z.number().int().min(5).max(300),
  intensity: z.enum(['easy', 'moderate', 'hard']),
});

export const scheduleSchema = z.object({
  trainingDaysPerWeek: z.number().int().min(0).max(7),
  preferredDays: z.array(weekday),
  maxSessionMinutes: z.number().int().min(LIMITS.sessionMinutes.min).max(LIMITS.sessionMinutes.max),
  preferredTime: hhmm.nullable(),
  commitments: z.array(commitmentSchema).max(7),
});
export type ScheduleValues = z.infer<typeof scheduleSchema>;

// ------------------------------------------------------------------ step 6
const chipList = z.array(z.string().trim().min(1).max(40)).max(30);
export const nutritionSchema = z.object({
  dietType: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'other']),
  allergies: chipList,
  intolerances: chipList,
  dislikedFoods: chipList,
  preferredCuisines: chipList,
  mealsPerDay: z.number().int().min(2).max(6),
  cookingTimeMaxMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).nullable(),
  householdServings: z.number().int().min(1).max(8),
});
export type NutritionValues = z.infer<typeof nutritionSchema>;

// ------------------------------------------------------------------ step 7
export const BODY_AREAS = [
  'ankle_foot',
  'calf_achilles',
  'knee',
  'hip_groin',
  'hamstring',
  'lower_back',
  'shoulder',
  'elbow_wrist_hand',
  'neck',
  'other',
] as const;

export const injurySchema = z.object({
  id: z.uuid(),
  bodyArea: z.enum(BODY_AREAS),
  side: z.enum(['left', 'right', 'both', 'na']),
  status: z.enum(['active', 'recovering', 'cleared_training', 'cleared_sport', 'resolved']),
  painLevel: z.number().int().min(0).max(10).nullable(),
  description: z.string().trim().max(500),
  onsetDate: isoDate.nullable(),
  professionalClearance: z.boolean(),
});
export type InjuryValues = z.infer<typeof injurySchema>;

export const healthSchema = z.object({ injuries: z.array(injurySchema).max(10) });
export type HealthValues = z.infer<typeof healthSchema>;

// ------------------------------------------------------------------ step 8
export const consentSchema = (ctx: { hasHealthData: boolean }) =>
  z
    .object({
      terms: z.boolean(),
      privacy: z.boolean(),
      healthData: z.boolean(),
      notifications: z.boolean(),
    })
    .superRefine((v, issue) => {
      if (!v.terms)
        issue.addIssue({ code: 'custom', path: ['terms'], message: 'Required to use PACE' });
      if (!v.privacy)
        issue.addIssue({ code: 'custom', path: ['privacy'], message: 'Required to use PACE' });
      if (ctx.hasHealthData && !v.healthData) {
        issue.addIssue({
          code: 'custom',
          path: ['healthData'],
          message: 'Needed to store the injury details you entered. You can remove them instead.',
        });
      }
    });
export type ConsentValues = z.infer<ReturnType<typeof consentSchema>>;
