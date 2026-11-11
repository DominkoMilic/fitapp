import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, Screen, Text } from '@/components/ui';
import { type ActiveWorkout, createActiveWorkout } from '@/domain/training/active-workout';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { useLastSets } from '@/features/training/last-performance';
import {
  usePreparedWorkout,
  usePreparedWorkoutStore,
} from '@/features/training/prepared-workout-store';
import { useScheduledWorkout } from '@/features/training/schedule-api';
import { useBuiltWorkout } from '@/features/training/useBuiltWorkout';
import { WorkoutEditor } from '@/features/training/WorkoutEditor';
import { goBack } from '@/navigation/back';

/**
 * Change a planned workout before starting it: sets, reps, weight, add or remove exercises.
 * Only this session changes; the plan stays as it is.
 */
export default function PrepareWorkout() {
  const { scheduledId } = useLocalSearchParams<{ scheduledId: string }>();
  const userId = useAuth().session?.user.id;
  const { workout: scheduled, isPending } = useScheduledWorkout(scheduledId);
  const built = useBuiltWorkout(scheduled?.template_slug);
  const prepared = usePreparedWorkout(userId, scheduledId);
  const { lastSets } = useLastSets();
  const metric = (useProfile().data?.unit_system ?? 'metric') === 'metric';

  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (!scheduled || !userId || (!built && !prepared))
    return (
      <Screen edges={['bottom']}>
        <ErrorState title="Not found" message="This workout can't be edited." />
      </Screen>
    );
  const plan = () =>
    createActiveWorkout({
      id: randomUUID(),
      userId,
      scheduledId: scheduled.id,
      built: built!,
      category: scheduled.category,
      intensity: scheduled.intensity,
      now: Date.now(),
      lastSets,
    });
  return (
    <Editor
      scheduledId={scheduled.id}
      initial={prepared ? () => prepared : plan}
      edited={!!prepared}
      metric={metric}
    />
  );
}

function Editor({
  scheduledId,
  initial,
  edited,
  metric,
}: {
  scheduledId: string;
  initial: () => ActiveWorkout;
  edited: boolean;
  metric: boolean;
}) {
  const [w, setW] = useState(initial);
  const save = usePreparedWorkoutStore((s) => s.save);
  const clear = usePreparedWorkoutStore((s) => s.clear);
  const showToast = useToast((s) => s.show);
  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button
            title="Save changes"
            disabled={w.exercises.length === 0}
            onPress={() => {
              save(scheduledId, w);
              showToast('Saved for this workout');
              goBack('/training');
            }}
          />
          {edited ? (
            <Button
              title="Reset to the plan"
              variant="ghost"
              onPress={() => {
                clear(scheduledId);
                showToast('Back to the planned workout');
                goBack('/training');
              }}
            />
          ) : null}
        </>
      }
    >
      <Text variant="heading" accessibilityRole="header">
        {w.title}
      </Text>
      <Text variant="small" color="textSecondary">
        Changes apply to this workout only. Your plan stays the same.
      </Text>
      <WorkoutEditor workout={w} onChange={setW} metric={metric} planning />
    </Screen>
  );
}
