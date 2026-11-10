import { useLocalSearchParams } from 'expo-router';

import { goBack } from '@/navigation/back';
import { useState } from 'react';

import { Banner, ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, Screen, SectionHeader, TextField } from '@/components/ui';
import { localDateInTimezone } from '@/domain/calculations/dates';
import type { ActiveWorkout } from '@/domain/training/active-workout';
import { EXERCISE_BY_SLUG } from '@/domain/training/catalogue';
import {
  activeFromSaved,
  clockText,
  manualTiming,
  TIMING_ERROR_TEXT,
} from '@/domain/training/workout-log';
import { minuteInTimezone } from '@/features/coach/time';
import { useProfile } from '@/features/profile/api';
import { EffortFields } from '@/features/training/EffortFields';
import {
  type ExerciseSet,
  useSaveSession,
  useSessions,
  type WorkoutSession,
} from '@/features/training/session-api';
import { sessionRecord } from '@/features/training/session-record';
import { TimingFields, type TimingValue } from '@/features/training/TimingFields';
import { WorkoutEditor } from '@/features/training/WorkoutEditor';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { useSubmit } from '@/hooks/useSubmit';

/** Correct a saved workout: when and how long, sets, reps, weights, exercises, effort (spec 10.4). */
export default function EditWorkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, sets, isPending } = useSessions();
  const { data: profile } = useProfile();
  if (isPending || !profile)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  const s = sessions.find((x) => x.id === id);
  if (!s)
    return (
      <Screen edges={['bottom']}>
        <ErrorState title="Not found" message="This workout no longer exists." />
      </Screen>
    );
  return (
    <Form
      key={s.id}
      session={s}
      sets={sets.filter((x) => x.workout_session_id === s.id)}
      timezone={profile.timezone ?? 'UTC'}
      metric={(profile.unit_system ?? 'metric') === 'metric'}
    />
  );
}

function Form({
  session: s,
  sets,
  timezone,
  metric,
}: {
  session: WorkoutSession;
  sets: ExerciseSet[];
  timezone: string;
  metric: boolean;
}) {
  const save = useSaveSession();
  const showToast = useToast((t) => t.show);
  const { current } = useWeightStats('30D');
  const [now] = useState(() => Date.now());
  const today = localDateInTimezone(new Date(now), timezone);
  const [workout, setWorkout] = useState<ActiveWorkout>(() =>
    activeFromSaved({ session: s, sets, exercisesBySlug: EXERCISE_BY_SLUG }),
  );
  const [title, setTitle] = useState(s.title);
  const [timing, setTiming] = useState<TimingValue>(() => ({
    date: s.local_date,
    startTime: clockText(minuteInTimezone(new Date(s.started_at), timezone)),
    durationMinutes: Math.max(1, Math.round(s.duration_seconds / 60)),
  }));
  const [rpe, setRpe] = useState<number | null>(
    s.perceived_exertion === null ? null : Number(s.perceived_exertion),
  );
  const [feeling, setFeeling] = useState<number | null>(s.feeling);
  const [notes, setNotes] = useState(s.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  const result = manualTiming({
    date: timing.date,
    startTime: timing.startTime,
    durationMinutes: timing.durationMinutes ?? 0,
    timezone,
    now,
    today,
  });

  const submit = useSubmit(async () => {
    // Shown on the time fields, not in a banner.
    if (!result.ok) return setTriedSave(true);
    if (!workout.exercises.length) return setError('A workout needs at least one exercise.');
    setError(null);
    await save(
      {
        ...sessionRecord({
          workout: { ...workout, title: title.trim() || s.title },
          timing: { ...result.value, pausedS: 0 },
          // Editing never completes or re-completes a planned workout.
          scheduled: null,
          rpe,
          feeling,
          notes,
          weightKg: current?.kg ?? null,
          timezone,
          source: s.source === 'manual' ? 'manual' : 'app',
        }),
        scheduledWorkoutId: s.scheduled_workout_id,
      },
      { id: s.id, onServer: !s._pending, setIds: sets.map((x) => x.id) },
    );
    showToast('Workout updated');
    goBack({ pathname: '/training/history/[id]', params: { id: s.id } });
  });

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button title="Save changes" loading={submit.busy} onPress={() => void submit.run()} />
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      <TextField label="Name" value={title} onChangeText={setTitle} maxLength={80} />
      <SectionHeader title="When" />
      <TimingFields
        value={timing}
        onChange={setTiming}
        today={today}
        error={
          !result.ok && (triedSave || timing.startTime.length >= 4)
            ? TIMING_ERROR_TEXT[result.error]
            : null
        }
      />
      <SectionHeader title="Exercises" />
      <WorkoutEditor workout={workout} onChange={setWorkout} metric={metric} addedDone />
      <SectionHeader title="How it went" />
      <EffortFields
        rpe={rpe}
        feeling={feeling}
        notes={notes}
        onRpe={setRpe}
        onFeeling={setFeeling}
        onNotes={setNotes}
      />
    </Screen>
  );
}
