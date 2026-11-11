import AsyncStorage from '@react-native-async-storage/async-storage';

import { recordingNotificationText } from '@/domain/activity/notification';
import { liveStats, withPoints } from '@/domain/activity/recording';
import { pointBuffer } from '@/services/location/point-buffer';
import {
  clearRecordingNotification,
  isRecordingNotificationShown,
  showRecordingNotification,
} from '@/services/notifications/recording-notification';

import { asRecording, type RecordingMeta } from './recording-store';

const STORE_KEY = 'pace.active-activity';
const UNIT_KEY = 'pace.recording-unit';
const LAST_KEY = 'pace.recording-notified-at';

/** Remembered for the background task, which has no profile to read. */
export const setRecordingUnit = (unit: 'metric' | 'imperial') =>
  AsyncStorage.setItem(UNIT_KEY, unit).catch(() => undefined);

/** The persisted recording, read straight from storage (works in the background task too). */
async function storedMeta(): Promise<RecordingMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const rec = raw
      ? (JSON.parse(raw) as { state?: { rec?: RecordingMeta | null } }).state?.rec
      : null;
    return rec ?? null;
  } catch {
    return null;
  }
}

/**
 * Updates the recording notification with the moving time, distance and pace (spec 11.6).
 * `throttleMs` skips the update when one went out recently (called on every GPS delivery);
 * `meta` is passed right after a change, before storage has caught up.
 */
export async function refreshRecordingNotification(
  opts: { throttleMs?: number; meta?: RecordingMeta | null; now?: number } = {},
): Promise<void> {
  const now = opts.now ?? Date.now();
  try {
    if (opts.throttleMs) {
      const last = Number((await AsyncStorage.getItem(LAST_KEY)) ?? 0);
      if (now - last < opts.throttleMs) return;
    }
    const meta = opts.meta !== undefined ? opts.meta : await storedMeta();
    if (!meta) return clearRecordingNotification();
    // Paused, nothing changes: re-post only if it was swiped away (every re-post redraws it and
    // can swallow a tap on Resume or Finish). A state change (opts.meta) always posts.
    if (
      opts.meta === undefined &&
      meta.status === 'paused' &&
      (await isRecordingNotificationShown())
    )
      return;
    const [points, unit] = await Promise.all([
      pointBuffer.all(meta.id),
      AsyncStorage.getItem(UNIT_KEY),
    ]);
    const s = liveStats(withPoints(asRecording(meta), points), now, null);
    await showRecordingNotification({
      ...recordingNotificationText({
        type: meta.type,
        movingS: s.movingS,
        distanceM: s.distanceM,
        currentPaceSPerKm: s.currentPaceSPerKm,
        currentSpeedMps: s.currentSpeedMps,
        unit: unit === 'imperial' ? 'imperial' : 'metric',
        paused: meta.status === 'paused',
      }),
      paused: meta.status === 'paused',
    });
    await AsyncStorage.setItem(LAST_KEY, String(now));
  } catch {
    // A notification update must never break recording.
  }
}

export { clearRecordingNotification };
