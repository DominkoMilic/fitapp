import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ActiveWorkout } from '@/domain/training/active-workout';

interface PreparedState {
  /** Edited exercise lists for planned workouts that haven't started, by scheduled workout id. */
  drafts: Record<string, ActiveWorkout>;
  save: (scheduledId: string, w: ActiveWorkout) => void;
  clear: (scheduledId: string) => void;
}

/**
 * Changes made to a planned workout before starting it (spec 10.4, decision 2026-11-21): kept on
 * this phone until the workout starts, then used as its starting point. Not synced: the plan
 * itself is unchanged, so another phone simply shows the planned version.
 */
export const usePreparedWorkoutStore = create<PreparedState>()(
  persist(
    (set) => ({
      drafts: {},
      save: (scheduledId, w) => {
        set((s) => ({ drafts: { ...s.drafts, [scheduledId]: w } }));
      },
      clear: (scheduledId) => {
        set((s) => {
          const { [scheduledId]: _gone, ...rest } = s.drafts;
          return { drafts: rest };
        });
      },
    }),
    { name: 'pace.prepared-workouts', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** The edited version of a planned workout, if this user made one. */
export function usePreparedWorkout(
  userId: string | undefined,
  scheduledId: string | undefined,
): ActiveWorkout | null {
  const w = usePreparedWorkoutStore((s) => (scheduledId ? s.drafts[scheduledId] : undefined));
  return w && w.userId === userId ? w : null;
}
