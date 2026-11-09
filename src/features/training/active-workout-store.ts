import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ActiveWorkout } from '@/domain/training/active-workout';

interface ActiveWorkoutState {
  workout: ActiveWorkout | null;
  /** When the last workout was saved or discarded (epoch ms). */
  finishedAt: number | null;
  set: (w: ActiveWorkout | null) => void;
  finish: () => void;
  update: (fn: (w: ActiveWorkout) => ActiveWorkout) => void;
}

/**
 * The workout in progress, persisted after every change so it survives the app being killed
 * (spec 10.4, 28.5 #6). Bound to a user id; another user's draft is ignored.
 */
export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set) => ({
      workout: null,
      finishedAt: null,
      set: (workout) => {
        set({ workout });
      },
      finish: () => {
        set({ workout: null, finishedAt: Date.now() });
      },
      update: (fn) => {
        set((s) => (s.workout ? { workout: fn(s.workout) } : s));
      },
    }),
    { name: 'pace.active-workout', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function useActiveWorkout(userId: string | undefined): ActiveWorkout | null {
  const w = useActiveWorkoutStore((s) => s.workout);
  return w && w.userId === userId ? w : null;
}
