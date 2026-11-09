import { FunctionsHttpError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useRecordingStore } from '@/features/activity/recording-store';
import { useDismissals } from '@/features/coach/dismissals';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { useActiveWorkoutStore } from '@/features/training/active-workout-store';
import { requireSupabase } from '@/integrations/supabase/client';
import { pointBuffer } from '@/services/location/point-buffer';
import { stopTracking } from '@/services/location/tracker';
import { notifier } from '@/services/notifications/notifier';

export type DeleteError =
  'wrong_password' | 'reauthentication_required' | 'network' | 'retry' | 'unknown';

/** Calls the delete-account function (after the password was re-entered). Retry-safe. */
export async function requestAccountDeletion(): Promise<
  { ok: true } | { ok: false; error: DeleteError }
> {
  try {
    const { error } = await requireSupabase().functions.invoke('delete-account', {
      body: { confirm: 'DELETE' },
    });
    if (!error) return { ok: true };
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status as number;
      if (status === 403) return { ok: false, error: 'reauthentication_required' };
      return { ok: false, error: status >= 500 ? 'retry' : 'unknown' };
    }
    return { ok: false, error: 'network' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/**
 * Removes everything this account left on the device: the outbox (passed in), in-progress
 * recordings and workouts, GPS points, scheduled reminders, dismissals and drafts (spec 19, 28.10 #5).
 */
export async function clearLocalData(userId: string, clearOutbox: () => Promise<void>) {
  const tasks: Promise<unknown>[] = [clearOutbox()];
  const rec = useRecordingStore.getState().rec;
  if (rec?.userId === userId) {
    tasks.push(
      stopTracking().catch(() => undefined),
      pointBuffer.clear(rec.id),
    );
    useRecordingStore.getState().set(null);
  }
  if (useActiveWorkoutStore.getState().workout?.userId === userId)
    useActiveWorkoutStore.getState().set(null);
  useOnboardingDraft.getState().reset();
  useDismissals.setState((s) => {
    const { [userId]: _gone, ...rest } = s.byUser;
    return { byUser: rest };
  });
  tasks.push(notifier.cancelAllReminders(), notifier.cancelRestEnd());
  tasks.push(AsyncStorage.removeItem('pace.active-recording-id'));
  await Promise.allSettled(tasks);
}
