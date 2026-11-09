import { router } from 'expo-router';

import { Button, Card, Text } from '@/components/ui';
import { plural } from '@/domain/format';
import { elapsedS } from '@/domain/training/active-workout';
import { formatClock, useNow } from '@/hooks/useNow';
import { useAuth } from '@/features/auth/AuthProvider';

import { useActiveWorkout } from './active-workout-store';

/** Shown when a workout is in progress (e.g. after the app was closed mid-workout). */
export function ResumeWorkoutCard() {
  const w = useActiveWorkout(useAuth().session?.user.id);
  const now = useNow(1000, !!w && !w.pausedAt);
  if (!w) return null;
  const done = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  return (
    <Card raised>
      <Text variant="small" color="accent">
        Workout in progress
      </Text>
      <Text variant="title">{w.title}</Text>
      <Text variant="small" color="textSecondary">
        {formatClock(elapsedS(w, now))} · {plural(done, 'set')} done{w.pausedAt ? ' · paused' : ''}
      </Text>
      <Button title="Resume workout" onPress={() => router.push('/training/session')} />
    </Card>
  );
}
