export const ONBOARDING_STEPS = [
  { id: 'personal', title: 'About you' },
  { id: 'goals', title: 'Your goal' },
  { id: 'activity', title: 'Activity level' },
  { id: 'equipment', title: 'Equipment' },
  { id: 'schedule', title: 'Schedule' },
  { id: 'nutrition', title: 'Nutrition' },
  { id: 'health', title: 'Health & injuries' },
  { id: 'consent', title: 'Privacy & consent' },
  { id: 'plan', title: 'Your plan' },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

export const stepIndex = (id: OnboardingStepId) => ONBOARDING_STEPS.findIndex((s) => s.id === id);

export const nextStep = (id: OnboardingStepId): OnboardingStepId | null =>
  ONBOARDING_STEPS[stepIndex(id) + 1]?.id ?? null;

export const previousStep = (id: OnboardingStepId): OnboardingStepId | null =>
  ONBOARDING_STEPS[stepIndex(id) - 1]?.id ?? null;
