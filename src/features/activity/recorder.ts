import { randomUUID } from 'expo-crypto';

import type { ActivityType } from '@/domain/activity/met';
import { pauseRecording, resumeRecording, startRecording } from '@/domain/activity/recording';
import { pointBuffer } from '@/services/location/point-buffer';
import { startTracking, stopTracking } from '@/services/location/tracker';

import { clearRecordingNotification, refreshRecordingNotification } from './live-notification';
import { useRecordingStore } from './recording-store';

/** Orchestrates the store and location updates. Each step persists before returning. */
export const recorder = {
  async start(userId: string, type: ActivityType) {
    const id = randomUUID();
    const now = Date.now();
    const { track: _t, ...meta } = startRecording({ id, userId, type, now });
    useRecordingStore.getState().set({ ...meta, mode: 'foreground' });
    const mode = await startTracking(id, type);
    const cur = useRecordingStore.getState().rec;
    if (cur?.id === id) useRecordingStore.getState().set({ ...cur, mode });
    void refreshRecordingNotification({ meta: useRecordingStore.getState().rec });
    return id;
  },
  async pause() {
    useRecordingStore.getState().update((r) => pauseRecording(r, Date.now()));
    await stopTracking();
    await refreshRecordingNotification({ meta: useRecordingStore.getState().rec });
  },
  async resume() {
    const rec = useRecordingStore.getState().rec;
    if (!rec) return;
    useRecordingStore.getState().update((r) => resumeRecording(r, Date.now()));
    const mode = await startTracking(rec.id, rec.type);
    const cur = useRecordingStore.getState().rec;
    if (cur) useRecordingStore.getState().set({ ...cur, mode });
    await refreshRecordingNotification({ meta: useRecordingStore.getState().rec });
  },
  /** After an app kill/restart: make sure points keep flowing for a recording in progress. */
  async ensureTracking() {
    const rec = useRecordingStore.getState().rec;
    if (!rec || rec.status !== 'recording') return;
    const mode = await startTracking(rec.id, rec.type);
    const cur = useRecordingStore.getState().rec;
    if (cur) useRecordingStore.getState().set({ ...cur, mode });
  },
  /** Stops GPS and freezes the recording (status paused) before the summary. */
  async stop() {
    useRecordingStore.getState().update((r) => pauseRecording(r, Date.now()));
    await stopTracking();
    // Finished: the summary takes over, the notification goes.
    await clearRecordingNotification();
  },
  /** After saving (or confirmed discard): clear the buffer and the draft. */
  async clear() {
    const rec = useRecordingStore.getState().rec;
    await stopTracking();
    await clearRecordingNotification();
    useRecordingStore.getState().set(null);
    if (rec) await pointBuffer.clear(rec.id);
  },
};
