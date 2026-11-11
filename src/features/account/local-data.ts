import AsyncStorage from '@react-native-async-storage/async-storage';

import { pauseRecording } from '@/domain/activity/recording';
import { useRecordingStore } from '@/features/activity/recording-store';
import { useDismissals } from '@/features/coach/dismissals';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { useActiveWorkoutStore } from '@/features/training/active-workout-store';
import { usePreparedWorkoutStore } from '@/features/training/prepared-workout-store';
import { pointBuffer } from '@/services/location/point-buffer';
import { stopTracking } from '@/services/location/tracker';
import { notifier } from '@/services/notifications/notifier';
import { clearExportFiles } from '@/services/share/share-file';

/**
 * Removes what an account left on this device (spec 19, 28.10 #5; audit: sign-out hygiene).
 *
 * - 'sign-out': stop GPS, cancel reminders (they name workouts), drop the onboarding draft (date of
 *   birth, weight, health) and export files. The in-progress workout/recording and unsynced outbox
 *   stay: they belong to this user only, are never shown to another account, and resume on sign-in.
 * - 'delete': everything above plus the outbox, recordings, GPS points, drafts and dismissals.
 */
export async function clearLocalData(
  userId: string,
  mode: 'sign-out' | 'delete',
  clearOutbox?: () => Promise<void>,
) {
  const tasks: Promise<unknown>[] = [
    stopTracking().catch(() => undefined),
    notifier.cancelAllReminders(),
    notifier.cancelRestEnd(),
    AsyncStorage.removeItem('pace.active-recording-id'),
    // Saved reads for offline start (src/services/query-client.ts).
    AsyncStorage.removeItem('pace.query-cache'),
    clearExportFiles(),
  ];
  useOnboardingDraft.getState().reset();

  if (mode === 'delete') {
    if (clearOutbox) tasks.push(clearOutbox());
    const rec = useRecordingStore.getState().rec;
    if (rec?.userId === userId) {
      tasks.push(pointBuffer.clear(rec.id));
      useRecordingStore.getState().set(null);
    }
    if (useActiveWorkoutStore.getState().workout?.userId === userId)
      useActiveWorkoutStore.getState().set(null);
    usePreparedWorkoutStore.setState((s) => ({
      drafts: Object.fromEntries(Object.entries(s.drafts).filter(([, w]) => w.userId !== userId)),
    }));
    useDismissals.setState((s) => {
      const { [userId]: _gone, ...rest } = s.byUser;
      return { byUser: rest };
    });
  } else {
    // Recording stays resumable, but GPS is off until the user signs in and resumes it.
    const rec = useRecordingStore.getState().rec;
    if (rec?.userId === userId && rec.status === 'recording') {
      useRecordingStore.getState().update((r) => pauseRecording(r, Date.now()));
    }
  }
  await Promise.allSettled(tasks);
}
