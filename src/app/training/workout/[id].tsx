import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { Banner, ConfirmDialog, ErrorState, LoadingState, useToast } from '@/components/feedback';
import {
  Button,
  Card,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatusTag,
  Text,
} from '@/components/ui';
import { formatLongWeekday } from '@/domain/format';
import { readAdaptedNote, visibleNotes } from '@/domain/training/adapt';
import { TEMPLATE_BY_SLUG } from '@/domain/training/catalogue';
import { useToday } from '@/features/dashboard/useToday';
import { dayLabel, isSport, STATUS_LABEL } from '@/features/training/labels';
import { useRestrictions } from '@/features/training/library';
import { usePreparedWorkout } from '@/features/training/prepared-workout-store';
import { useScheduleActions, useScheduledWorkout } from '@/features/training/schedule-api';
import { useBuiltWorkout } from '@/features/training/useBuiltWorkout';
import { ExpandableExerciseCard } from '@/features/training/ExpandableExerciseCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveWorkout } from '@/features/training/active-workout-store';
import { useSessions } from '@/features/training/session-api';
import { useGuardedAction } from '@/hooks/useSubmit';
import { parseSportCategory } from '@/domain/sports/catalogue';

const SKIP_MESSAGE =
  'Showing up is what counts. Even 20 minutes keeps your rhythm going, and an easy session is better than none. If you’re ill or in pain, resting is the right call.';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { today } = useToday();
  const { workout: w, isPending } = useScheduledWorkout(id);
  const actions = useScheduleActions();
  const restrictions = useRestrictions();
  const showToast = useToast((s) => s.show);
  const guard = useGuardedAction();
  const built = useBuiltWorkout(w?.template_slug);
  const userId = useAuth().session?.user.id;
  const active = useActiveWorkout(userId);
  const running = !!active && active.scheduledId === id;
  const { sessions } = useSessions();
  const doneSession = sessions.find((x) => x.scheduled_workout_id === id);
  const prepared = usePreparedWorkout(userId, id);
  const [askSkip, setAskSkip] = useState(false);
  /** The exercise whose instructions are open (one at a time). */
  const [open, setOpen] = useState<number | null>(null);
  // Full or the 20-minute version: a length choice above Start instead of a separate button.
  const [length, setLength] = useState<'full' | 'quick'>('full');
  const quickSlug = w?.template_slug
    ? (TEMPLATE_BY_SLUG[w.template_slug]?.shortVersion ?? null)
    : null;
  const builtQuick = useBuiltWorkout(quickSlug);

  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (!w)
    return (
      <Screen edges={['bottom']}>
        <ErrorState title="Not found" message="This workout no longer exists." />
      </Screen>
    );

  const template = w.template_slug ? TEMPLATE_BY_SLUG[w.template_slug] : undefined;
  const shortSlug = template?.shortVersion ?? null;
  const sport = w.kind === 'commitment' || isSport(w.category);
  const eventSport = parseSportCategory(w.category)?.sport ?? null;

  // Nothing can be started or logged for a day that hasn't come yet (spec 10.4).
  const future = w.scheduled_date > today;
  const startable = !!built && w.kind !== 'rest' && !future;
  const canChooseLength = !!shortSlug && !!builtQuick && w.status === 'planned' && !running;
  const quick = canChooseLength && length === 'quick';
  const shown = quick ? builtQuick : built;
  const fullMinutes = w.estimated_duration_minutes ?? template?.minutes ?? null;
  const quickMinutes = shortSlug ? (TEMPLATE_BY_SLUG[shortSlug]?.minutes ?? 20) : 20;
  const start = (template?: string) =>
    router.push({
      pathname: '/training/session',
      params: template ? { scheduledId: w.id, template } : { scheduledId: w.id },
    });
  const skip = () => {
    setAskSkip(false);
    guard(actions.skip(w).then(() => showToast('Skipped. Rest well, and see you next time.')));
  };

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading" accessibilityRole="header">
        {w.title}
      </Text>
      <Text color="textSecondary">
        {[
          dayLabel(w.scheduled_date, today),
          w.scheduled_time?.slice(0, 5),
          quick
            ? `${quickMinutes} min`
            : w.estimated_duration_minutes
              ? `${w.estimated_duration_minutes} min`
              : null,
          STATUS_LABEL[w.status] || null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {visibleNotes(w.notes).map((n) => (
        <Text key={n} variant="small" color="textSecondary">
          {n}
        </Text>
      ))}
      {w.status === 'planned' && readAdaptedNote(w.notes) ? (
        <Button
          title={`Undo: back to ${readAdaptedNote(w.notes)?.title}`}
          variant="ghost"
          fullWidth={false}
          onPress={() => guard(actions.undoSwap(w))}
        />
      ) : null}
      {eventSport && restrictions.restrictedFor(eventSport.key) ? (
        <Banner
          tone="warning"
          message={`Your injury isn't marked as cleared for ${eventSport.label.toLowerCase()}. Check with a healthcare professional before playing.`}
        />
      ) : null}

      {built ? (
        <>
          {built.adjustedForInjury || built.removed.length ? (
            <Banner
              tone="info"
              title="Adjusted for you"
              message={[
                built.exercises.filter((e) => e.substitutedFor).length
                  ? `Swapped: ${built.exercises
                      .filter((e) => e.substitutedFor)
                      .map((e) => e.name)
                      .join(', ')}.`
                  : '',
                built.removed.length
                  ? `Left out: ${built.removed.map((r) => `${r.name} (${r.reason === 'injury' ? 'injury' : 'equipment'})`).join(', ')}.`
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ) : null}
          {built.tooFewExercises ? (
            <Banner
              tone="warning"
              message="Most of this workout doesn't suit your current injury. A recovery session is a better choice today."
            />
          ) : null}
          {canChooseLength ? (
            <SegmentedControl
              accessibilityLabel="Workout length"
              options={[
                { value: 'full', label: fullMinutes ? `Full · ${fullMinutes} min` : 'Full' },
                { value: 'quick', label: `Quick · ${quickMinutes} min` },
              ]}
              value={length}
              onChange={setLength}
            />
          ) : null}
          <SectionHeader
            title="Exercises"
            action={prepared && !quick ? <StatusTag label="Edited" /> : undefined}
          />
          {prepared && !quick
            ? prepared.exercises.map((e, i) => (
                <ExpandableExerciseCard
                  key={`${e.slug}-${i}`}
                  slug={e.slug}
                  name={e.name}
                  detail={`${e.sets.length} × ${
                    e.tracking === 'time'
                      ? `${e.sets[0]?.durationS ?? e.durationS ?? 0} s`
                      : `${e.sets[0]?.reps ?? e.repsMin} reps`
                  }${e.unilateral ? ' per side' : ''}${e.added ? ' · added by you' : ''}`}
                  expanded={open === i}
                  onToggle={() => setOpen(open === i ? null : i)}
                />
              ))
            : null}
          {prepared && !quick
            ? null
            : (shown ?? built).exercises.map((e, i) => (
                <ExpandableExerciseCard
                  key={`${e.slug}-${i}`}
                  slug={e.slug}
                  name={e.name}
                  eyebrow={
                    e.phase === 'warmup' ? 'Warm-up' : e.phase === 'cooldown' ? 'Cool-down' : 'Main'
                  }
                  detail={`${e.sets} × ${
                    e.durationS
                      ? e.durationS >= 120
                        ? `${Math.round(e.durationS / 60)} min`
                        : `${e.durationS} s`
                      : `${e.repsMin}${e.repsMax !== e.repsMin ? `–${e.repsMax}` : ''} reps`
                  }${e.unilateral ? ' per side' : ''}`}
                  expanded={open === i}
                  onToggle={() => setOpen(open === i ? null : i)}
                />
              ))}
        </>
      ) : null}

      {w.status === 'planned' ? (
        <>
          {future && built && w.kind !== 'rest' ? (
            <Card tone="muted">
              <Text variant="body" color="textSecondary">
                You can start this on {formatLongWeekday(w.scheduled_date)}.
              </Text>
            </Card>
          ) : null}
          {startable ? (
            <Button
              title={
                running
                  ? 'Resume workout'
                  : quick
                    ? `Start ${quickMinutes}-min workout`
                    : 'Start workout'
              }
              onPress={() => start(quick && shortSlug ? shortSlug : undefined)}
            />
          ) : null}
          {built && w.kind !== 'rest' && !running && !quick ? (
            <Button
              title={prepared ? 'Edit again' : 'Edit before starting'}
              variant="secondary"
              accessibilityHint="Change sets, reps or exercises for this workout only"
              onPress={() =>
                router.push({ pathname: '/training/prepare', params: { scheduledId: w.id } })
              }
            />
          ) : null}
          {startable && !running ? (
            <Button
              title="I already did this"
              variant="secondary"
              accessibilityHint="Log this workout with the time you did it, without running the timer"
              onPress={() =>
                router.push({ pathname: '/training/log-workout', params: { scheduledId: w.id } })
              }
            />
          ) : null}
          {sport && !future ? (
            <Button
              title="Log this session"
              // One primary action per screen: when the workout can be started, that's the main one.
              variant={startable ? 'secondary' : 'primary'}
              onPress={() =>
                router.push({ pathname: '/training/log-event', params: { scheduledId: w.id } })
              }
            />
          ) : null}
          {w.kind !== 'rest' && !running ? (
            <Button title="Skip" variant="ghost" onPress={() => setAskSkip(true)} />
          ) : null}
          {w.occurrence_key === null ? (
            <Button
              title="Remove this workout"
              variant="ghost"
              onPress={() => guard(actions.removeOneOff(w).then(() => goBack('/training')))}
            />
          ) : null}
        </>
      ) : w.status === 'completed' && doneSession ? (
        <Button
          title="See what you did"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/training/history/[id]', params: { id: doneSession.id } })
          }
        />
      ) : w.status === 'skipped' ? (
        <Button title="Restore" variant="secondary" onPress={() => guard(actions.restore(w))} />
      ) : null}
      {w.recurring_event_id ? (
        <Button
          title="Edit the recurring session"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: '/training/series/[id]',
              params: { id: w.recurring_event_id as string },
            })
          }
        />
      ) : null}

      {/* Skipping is fine, but first a nudge towards a shorter session (never through pain). */}
      <ConfirmDialog
        visible={askSkip}
        title="Skip this workout?"
        message={SKIP_MESSAGE}
        confirmLabel={
          !startable
            ? 'Skip anyway'
            : shortSlug
              ? 'Try the 20-minute version'
              : 'Start an easy session'
        }
        cancelLabel="Keep it"
        secondary={startable ? { label: 'Skip anyway', onPress: skip } : undefined}
        onCancel={() => setAskSkip(false)}
        onConfirm={() => {
          if (!startable) return skip();
          setAskSkip(false);
          start(shortSlug ?? undefined);
        }}
      />
    </Screen>
  );
}
