import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DismissState {
  /** Per user: the local date and the rule ids dismissed on it. */
  byUser: Record<string, { date: string; ids: string[] }>;
  dismiss: (userId: string, date: string, ruleId: string) => void;
}

/** Dismissed coach cards stay hidden for the rest of the local day (spec 15.1, 28.9 #2). */
export const useDismissals = create<DismissState>()(
  persist(
    (set) => ({
      byUser: {},
      dismiss: (userId, date, ruleId) => {
        set((s) => {
          const cur = s.byUser[userId];
          const ids = cur?.date === date ? [...new Set([...cur.ids, ruleId])] : [ruleId];
          return { byUser: { ...s.byUser, [userId]: { date, ids } } };
        });
      },
    }),
    { name: 'pace.coach-dismissals', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function dismissedOn(
  state: DismissState['byUser'],
  userId: string | undefined,
  date: string,
): Set<string> {
  const cur = userId ? state[userId] : undefined;
  return new Set(cur?.date === date ? cur.ids : []);
}
