import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

import type { OnboardingStepId } from './steps';

/** Values the user edited on the plan preview (null = use calculated targets). */
export interface TargetOverrides {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface OnboardingDraft {
  userId: string | null;
  lastStep: OnboardingStepId;
  personal: PersonalValues | null;
  goals: GoalsValues | null;
  activity: ActivityValues | null;
  equipment: EquipmentValues | null;
  schedule: ScheduleValues | null;
  nutrition: NutritionValues | null;
  health: HealthValues | null;
  healthConsent: boolean;
  consent: ConsentValues | null;
  overrides: TargetOverrides | null;
}

interface DraftActions {
  /** Binds the draft to a user; a different user gets a fresh draft. */
  bindUser: (userId: string) => void;
  save: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  setLastStep: (step: OnboardingStepId) => void;
  reset: () => void;
}

export const emptyDraft: OnboardingDraft = {
  userId: null,
  lastStep: 'personal',
  personal: null,
  goals: null,
  activity: null,
  equipment: null,
  schedule: null,
  nutrition: null,
  health: null,
  healthConsent: false,
  consent: null,
  overrides: null,
};

export const useOnboardingDraft = create<OnboardingDraft & DraftActions>()(
  persist(
    (set, get) => ({
      ...emptyDraft,
      bindUser: (userId) => {
        if (get().userId !== userId) set({ ...emptyDraft, userId });
      },
      save: (key, value) => set({ [key]: value } as Partial<OnboardingDraft>),
      setLastStep: (lastStep) => set({ lastStep }),
      reset: () => set({ ...emptyDraft }),
    }),
    {
      name: 'pace.onboarding-draft',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
