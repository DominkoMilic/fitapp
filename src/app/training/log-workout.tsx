import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Banner, LoadingState, useToast } from '@/components/feedback';
import { Button, ChipGroup, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { localDateInTimezone } from '@/domain/calculations/dates';
import { SPORT_BY_KEY } from '@/domain/sports/catalogue';
import { type ActiveWorkout, createActiveWorkout } from '@/domain/training/active-workout';
import { TEMPLATE_BY_SLUG, TEMPLATES } from '@/domain/training/catalogue';
import {
  clockText,
  emptyWorkout,
  manualTiming,
  markAllDone,
  TIMING_ERROR_TEXT,
} from '@/domain/training/workout-log';
import { useAuth } from '@/features/auth/AuthProvider';
import { minuteInTimezone } from '@/features/coach/time';
import { useProfile } from '@/features/profile/api';
import { EffortFields } from '@/features/training/EffortFields';
import { useLastSets } from '@/features/training/last-performance';
import { useRestrictions } from '@/features/training/library';
import { useScheduledWorkout } from '@/features/training/schedule-api';
import { useSaveSession } from '@/features/training/session-api';
import { sessionRecord } from '@/features/training/session-record';
import { TimingFields, type TimingValue } from '@/features/training/TimingFields';
import { useBuiltWorkout } from '@/features/training/useBuiltWorkout';
import { WorkoutEditor } from '@/features/training/WorkoutEditor';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { useSubmit } from '@/hooks/useSubmit';

const BLANK = 'blank';

/**
 * Log a workout done without the app running (spec 10.4): from a planned workout ("I already did
 * this"), a template, or from scratch. Planned sets start ticked; untick what you skipped, add
 * what you did extra, and enter when and how long.
 */
export default function LogWorkout() {
  const { scheduledId } = useLocalSearchParams<{ scheduledId?: string }>();
  const userId = useAuth().session?.user.id;
  const { data: profile } = useProfile();
  const { workout: scheduled, isPending } = useScheduledWorkout(scheduledId);
  if (scheduledId && isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (!userId || !profile) return <Screen edges={['bottom']}>{null}</Screen>;
  return (
    <Form
      key={scheduled?.id ?? 'free'}
      userId={userId}
      timezone={profile.timezone ?? 'UTC'}
      metric={(profile.unit_system ?? 'metric') === 'metric'}
      scheduled={scheduled ?? null}
    />
  );
}

function Form({
  userId,
  timezone,
  metric,
  scheduled,
}: {
  userId: string;
  timezone: string;
  metric: boolean;
  scheduled: ReturnType<typeof useScheduledWorkout>['workout'] | null;
}) {
  const save = useSaveSession();
  const showToast = useToast((s) => s.show);
  const { current } = useWeightStats('30D');
  const { lastSets } = useLastSets();
  const restrictions = useRestrictions();
  const [now] = useState(() => Date.now());
  const today = localDateInTimezone(new Date(now), timezone);
  const [slug, setSlug] = useState<string>(scheduled?.template_slug ?? BLANK);
  const built = useBuiltWorkout(slug === BLANK ? null : slug);
  const [draft, setDraft] = useState<{ slug: string; workout: ActiveWorkout } | null>(null);
  const [title, setTitle] = useState(scheduled?.title ?? '');
  const minutes = scheduled?.estimated_duration_minutes ?? TEMPLATE_BY_SLUG[slug]?.minutes ?? 45;
  const [timing, setTiming] = useState<TimingValue>(() => ({
    date:
      scheduled?.scheduled_date && scheduled.scheduled_date <= today
        ? scheduled.scheduled_date
        : today,
    startTime: scheduled?.scheduled_time
      ? scheduled.scheduled_time.slice(0, 5)
      : clockText(Math.max(0, minuteInTimezone(new Date(now), timezone) - minutes)),
    durationMinutes: minutes,
  }));
  const [rpe, setRpe] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Start the editor from the chosen template (planned sets ticked), or empty.
  if (draft?.slug !== slug && (slug === BLANK || built)) {
    setDraft({
      slug,
      workout:
        slug === BLANK || !built
          ? emptyWorkout({ id: randomUUID(), userId, title: '', startedAt: now })
          : markAllDone(
              createActiveWorkout({
                id: randomUUID(),
                userId,
                scheduledId: scheduled?.id ?? null,
                built,
                category: scheduled?.category ?? TEMPLATE_BY_SLUG[slug]?.category ?? 'strength',
                intensity: scheduled?.intensity ?? 'moderate',
                now,
                lastSets,
              }),
            ),
    });
  }

  // Templates for the chooser: everything except drill packs for sports the user doesn't play.
  const playable = new Set(restrictions.sports.map((k) => SPORT_BY_KEY[k]?.drillPack));
  const templates = TEMPLATES.filter((t) =>
    t.category === 'sport_skills' || t.category === 'football' ? playable.has(t.slug) : true,
  );

  const result = manualTiming({
    date: timing.date,
    startTime: timing.startTime,
    durationMinutes: timing.durationMinutes ?? 0,
    timezone,
    now,
    today,
  });

  const submit = useSubmit(async () => {
    if (!draft) return;
    if (!result.ok) return setError(TIMING_ERROR_TEXT[result.error]);
    const w = {
      ...draft.workout,
      title: draft.workout.title || title || built?.title || 'Workout',
    };
    if (!w.exercises.length) return setError('Add at least one exercise you did.');
    if (!w.exercises.some((e) => e.sets.some((s) => s.completed)))
      return setError('Tick at least one set as done.');
    setError(null);
    await save(
      sessionRecord({
        workout: w,
        timing: { ...result.value, pausedS: 0 },
        scheduled: scheduled ?? null,
        rpe,
        feeling,
        notes,
        weightKg: current?.kg ?? null,
        timezone,
        source: 'manual',
      }),
    );
    showToast('Workout logged');
    router.replace('/training');
  });

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button title="Save workout" loading={submit.busy} onPress={() => void submit.run()} />
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      {scheduled ? (
        <Text color="textSecondary">
          Logging “{scheduled.title}”. Every planned set is ticked; untick what you skipped and add
          anything extra.
        </Text>
      ) : (
        <>
          <Text variant="small" color="textSecondary">
            What did you do?
          </Text>
          <ChipGroup
            accessibilityLabel="Workout"
            single
            options={[
              ...templates.map((t) => ({ value: t.slug, label: t.name })),
              { value: BLANK, label: 'Something else' },
            ]}
            selected={[slug]}
            onToggle={setSlug}
          />
          {slug === BLANK ? (
            <TextField
              label="Name"
              placeholder="e.g. Home push-ups"
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
          ) : null}
        </>
      )}

      <SectionHeader title="When" />
      <TimingFields
        value={timing}
        onChange={setTiming}
        today={today}
        error={!result.ok && timing.startTime.length >= 4 ? TIMING_ERROR_TEXT[result.error] : null}
      />

      <SectionHeader title="Exercises" />
      {draft ? (
        <WorkoutEditor
          workout={draft.workout}
          onChange={(workout) => setDraft({ ...draft, workout })}
          metric={metric}
          addedDone
        />
      ) : (
        <LoadingState />
      )}

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
