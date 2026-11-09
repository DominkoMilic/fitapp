import { useEffect } from 'react';

import { useActiveWorkoutStore } from '@/features/training/active-workout-store';
import { notifier } from '@/services/notifications/notifier';

/** "Rest over" while the app is in the background during a workout (spec 17, rest timer). */
export function useRestTimerNotification() {
  const restEndsAt = useActiveWorkoutStore((s) => s.workout?.restEndsAt ?? null);
  useEffect(() => {
    void (
      restEndsAt === null ? notifier.cancelRestEnd() : notifier.scheduleRestEnd(restEndsAt)
    ).catch(() => undefined);
  }, [restEndsAt]);
}
