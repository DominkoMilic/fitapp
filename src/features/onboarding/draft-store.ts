import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  ActivityValues,
  ConsentValues,
  EquipmentValues,
  GoalsValues,
  HealthValues,
  PersonalValues,
  ScheduleValues,
} from '@/domain/validation/onboarding';

import type { OnboardingStepId } from './steps';

export interface OnboardingDraft {
  userId: string | null;
  lastStep: OnboardingStepId;
  personal: PersonalValues | null;
  goals: GoalsValues | null;
  activity: ActivityValues | null;
  equipment: EquipmentValues | null;
  schedule: ScheduleValues | null;
  health: HealthValues | null;
  healthConsent: boolean;
  consent: ConsentValues | null;
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
  health: null,
  healthConsent: false,
  consent: null,
};

export const useOnboardingDraft = create<OnboardingDraft & DraftActions>()(
  persist(
    (set, get) => ({
      ...emptyDraft,
      bindUser: (userId) => {
        if (get().userId !== userId) set({ ...emptyDraft, userId });
      },
      save: (key, value) => {
        set({ [key]: value } as Partial<OnboardingDraft>);
      },
      setLastStep: (lastStep) => {
        set({ lastStep });
      },
      reset: () => {
        set({ ...emptyDraft });
      },
    }),
    {
      name: 'pace.onboarding-draft',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted, version) =>
        migrateDraft(persisted, version) as OnboardingDraft & DraftActions,
    },
  ),
);

/**
 * Version 1 drafts had a nutrition step (removed with nutrition, decisions 2026-11-18): drop its
 * answers and resume a draft that stopped there at the next step, Health.
 */
export function migrateDraft(persisted: unknown, version: number): unknown {
  if (version >= 2 || !persisted || typeof persisted !== 'object') return persisted;
  const { nutrition: _n, overrides: _o, ...rest } = persisted as Record<string, unknown>;
  return { ...rest, lastStep: rest.lastStep === 'nutrition' ? 'health' : rest.lastStep };
}
