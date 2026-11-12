import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Keep the most recent decisions only; old sessions never come back as suggestions anyway. */
const KEEP = 200;

interface AdaptState {
  /** Per user: suggestion keys already applied or declined. */
  byUser: Record<string, string[]>;
  markHandled: (userId: string, keys: readonly string[]) => void;
}

/** Plan-adaptation suggestions you answered (Apply or Keep my plan) don't come back. */
export const useAdaptDecisions = create<AdaptState>()(
  persist(
    (set) => ({
      byUser: {},
      markHandled: (userId, keys) =>
        set((s) => ({
          byUser: {
            ...s.byUser,
            [userId]: [...new Set([...(s.byUser[userId] ?? []), ...keys])].slice(-KEEP),
          },
        })),
    }),
    { name: 'pace.plan-adaptations', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);
