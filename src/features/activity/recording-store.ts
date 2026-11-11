import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { emptyTrack } from '@/domain/activity/gps-filter';
import type { Recording } from '@/domain/activity/recording';

import type { TrackingMode } from '@/services/location/tracker';

/** The recording without its track: the track is always rebuilt from the point buffer. */
export type RecordingMeta = Omit<Recording, 'track'> & { mode: TrackingMode };

interface RecordingState {
  rec: RecordingMeta | null;
  set: (r: RecordingMeta | null) => void;
  update: (fn: (r: Recording) => Recording) => void;
}

export const asRecording = (m: RecordingMeta): Recording => ({ ...m, track: emptyTrack() });

/** Persisted after every change so a killed app can resume or finish (spec 11.6, 28.6 #6). */
export const useRecordingStore = create<RecordingState>()(
  persist(
    (set) => ({
      rec: null,
      set: (rec) => {
        set({ rec });
      },
      update: (fn) => {
        set((s) => {
          if (!s.rec) return s;
          const { track: _track, ...next } = fn(asRecording(s.rec));
          return { rec: { ...next, mode: s.rec.mode } };
        });
      },
    }),
    { name: 'pace.active-activity', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function useActiveRecording(userId: string | undefined): RecordingMeta | null {
  const r = useRecordingStore((s) => s.rec);
  return r && r.userId === userId ? r : null;
}

// Pause from the notification runs in a separate background copy of the app, which writes to
// storage. Coming back to the app reloads that, so the screen never acts on an outdated state.
if (Platform.OS !== 'web')
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void useRecordingStore.persist.rehydrate();
  });
