import { calculateNutritionPlan } from '@/domain/calculations/plan';
import { generateWeeklyPattern } from '@/domain/training/weekly-pattern';
import { buildOnboardingPayload, type CompleteDraft } from '@/features/onboarding/payload';

/** The example user from spec 25.1, as an onboarding draft. Test fixture only. */
export const seedDraft: CompleteDraft = {
  personal: {
    displayName: 'Dev User',
    dateOfBirth: '2003-05-01',
    calcSex: 'male',
    heightCm: 187,
    weightKg: 108,
    unitSystem: 'metric',
    timezone: 'Europe/Zagreb',
  },
  goals: {
    goalType: 'lose_weight',
    targetWeightKg: 90,
    secondaryTargetWeightKg: 87,
    weeklyRatePct: 0.5,
    rateWarningAccepted: false,
    targetDate: null,
    focusTags: ['futsal', 'strength'],
  },
  activity: { activityLevel: 'moderate', averageDailySteps: null },
  equipment: {
    environment: 'home',
    items: [
      { type: 'dumbbells', customName: null, maxWeightKg: 5 },
      { type: 'kettlebell', customName: null, maxWeightKg: 5 },
      { type: 'exercise_mat', customName: null, maxWeightKg: null },
    ],
  },
  schedule: {
    trainingDaysPerWeek: 2,
    preferredDays: [1, 4],
    maxSessionMinutes: 45,
    preferredTime: null,
    commitments: [
      {
        title: 'Practice match',
        category: 'futsal_practice',
        weekday: 2,
        localTime: '20:00',
        durationMinutes: 60,
        intensity: 'hard',
      },
      {
        title: 'League match',
        category: 'futsal_match',
        weekday: 6,
        localTime: '18:00',
        durationMinutes: 60,
        intensity: 'hard',
      },
    ],
  },
  nutrition: {
    dietType: 'omnivore',
    allergies: [],
    intolerances: [],
    dislikedFoods: [],
    preferredCuisines: [],
    mealsPerDay: 3,
    cookingTimeMaxMinutes: null,
    householdServings: 1,
  },
  health: {
    injuries: [
      {
        id: 'dddddddd-0000-4000-8000-000000000001',
        bodyArea: 'ankle_foot',
        side: 'right',
        status: 'recovering',
        painLevel: 2,
        description: '',
        onsetDate: null,
        professionalClearance: false,
      },
    ],
  },
  consent: { terms: true, privacy: true, healthData: true, notifications: false },
  overrides: null,
};

export function buildSeed(draft: CompleteDraft = seedDraft) {
  const plan = calculateNutritionPlan({
    sex: draft.personal.calcSex,
    dateOfBirth: draft.personal.dateOfBirth,
    heightCm: draft.personal.heightCm,
    weightKg: draft.personal.weightKg,
    activityLevel: draft.activity.activityLevel,
    goalType: draft.goals.goalType,
    targetWeightKg: draft.goals.targetWeightKg,
    weeklyRatePct: draft.goals.weeklyRatePct,
    asOf: '2026-11-08',
  });
  const pattern = generateWeeklyPattern({
    trainingDaysPerWeek: draft.schedule.trainingDaysPerWeek,
    preferredDays: draft.schedule.preferredDays,
    maxSessionMinutes: draft.schedule.maxSessionMinutes,
    commitments: draft.schedule.commitments,
    focusTags: draft.goals.focusTags,
    injuries: draft.health.injuries.map((i) => ({ bodyArea: i.bodyArea, status: i.status })),
  });
  return {
    plan,
    pattern,
    payload: buildOnboardingPayload({ draft, plan, pattern, legalVersion: '2026-11-08' }),
  };
}
