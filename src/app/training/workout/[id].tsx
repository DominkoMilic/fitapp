import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { Banner, ConfirmDialog, ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { addDays } from '@/domain/calculations/dates';
import { TEMPLATE_BY_SLUG } from '@/domain/training/catalogue';
import { moveWarnings } from '@/domain/training/schedule';
import { useToday } from '@/features/dashboard/useToday';
import { DateField } from '@/features/onboarding/components/DateField';
import { dayLabel, isSport, STATUS_LABEL } from '@/features/training/labels';
import { useRestrictions } from '@/features/training/library';
import {
  useScheduleActions,
  useScheduledWorkout,
  useScheduledWorkouts,
} from '@/features/training/schedule-api';
import { useBuiltWorkout } from '@/features/training/useBuiltWorkout';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveWorkout } from '@/features/training/active-workout-store';
import { useSessions } from '@/features/training/session-api';
import { useGuardedAction } from '@/hooks/useSubmit';
import { parseSportCategory } from '@/domain/sports/catalogue';

const WARNING_TEXT = {
  match_tomorrow:
    'There is a game or match the next day. Keep that day light: rest or mobility is better.',
  three_hard_days: 'This would make three hard days in a row. Consider an easier day in between.',
} as const;

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
  const [moving, setMoving] = useState(false);
  const [moveDate, setMoveDate] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState<string[] | null>(null);
  const nearby = useScheduledWorkouts(addDays(today, -60), addDays(today, 120));

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

  const doMove = async (date: string) => {
    await actions.move(w, date);
    setMoving(false);
    setConfirmMove(null);
    showToast(`Moved to ${dayLabel(date, today)}`);
  };
  const tryMove = () => {
    if (!moveDate) return;
    const others = nearby.rows.filter((r) => r.id !== w.id);
    const warnings = moveWarnings(moveDate, w.intensity, others);
    if (warnings.length) setConfirmMove(warnings.map((x) => WARNING_TEXT[x.kind]));
    else void doMove(moveDate);
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
          w.estimated_duration_minutes ? `${w.estimated_duration_minutes} min` : null,
          STATUS_LABEL[w.status] || null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {w.notes.map((n) => (
        <Text key={n} variant="small" color="textSecondary">
          {n}
        </Text>
      ))}
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
          <SectionHeader title="Exercises" />
          {built.exercises.map((e, i) => (
            <Card key={`${e.slug}-${i}`}>
              <Text variant="small" color="textSecondary">
                {e.phase === 'warmup' ? 'Warm-up' : e.phase === 'cooldown' ? 'Cool-down' : 'Main'}
              </Text>
              <Text variant="bodyStrong">{e.name}</Text>
              <Text variant="small" color="textSecondary">
                {e.sets} ×{' '}
                {e.durationS
                  ? `${e.durationS >= 120 ? `${Math.round(e.durationS / 60)} min` : `${e.durationS} s`}`
                  : `${e.repsMin}${e.repsMax !== e.repsMin ? `–${e.repsMax}` : ''} reps`}
                {e.unilateral ? ' per side' : ''}
              </Text>
            </Card>
          ))}
        </>
      ) : null}

      {w.status === 'planned' ? (
        <>
          {built && w.kind !== 'rest' ? (
            <Button
              title={running ? 'Resume workout' : 'Start workout'}
              onPress={() =>
                router.push({ pathname: '/training/session', params: { scheduledId: w.id } })
              }
            />
          ) : null}
          {built && w.kind !== 'rest' && !running && w.scheduled_date <= today ? (
            <Button
              title="I already did this"
              variant="secondary"
              accessibilityHint="Log this workout with the time you did it, without running the timer"
              onPress={() =>
                router.push({ pathname: '/training/log-workout', params: { scheduledId: w.id } })
              }
            />
          ) : null}
          {built && shortSlug ? (
            <Button
              title="Short on time? Start the 20-minute version"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/training/session',
                  params: { scheduledId: w.id, template: shortSlug },
                })
              }
            />
          ) : null}
          {sport ? (
            <Button
              title="Log this session"
              // One primary action per screen: when the workout can be started, that's the main one.
              variant={built && w.kind !== 'rest' ? 'secondary' : 'primary'}
              onPress={() =>
                router.push({ pathname: '/training/log-event', params: { scheduledId: w.id } })
              }
            />
          ) : null}
          {w.kind !== 'rest' ? (
            moving ? (
              <Card raised>
                <DateField label="Move to" value={moveDate} onChange={setMoveDate} />
                <Button
                  title="Move"
                  disabled={!moveDate || moveDate === w.scheduled_date}
                  onPress={tryMove}
                />
                <Button title="Cancel" variant="ghost" onPress={() => setMoving(false)} />
              </Card>
            ) : (
              <Button
                title="Move to another day"
                variant="secondary"
                onPress={() => {
                  setMoveDate(w.scheduled_date);
                  setMoving(true);
                }}
              />
            )
          ) : null}
          {w.kind !== 'rest' ? (
            <Button
              title="Skip"
              variant="ghost"
              onPress={() => guard(actions.skip(w).then(() => showToast('Skipped. No problem.')))}
            />
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

      <ConfirmDialog
        visible={confirmMove !== null}
        title="Move anyway?"
        message={(confirmMove ?? []).join('\n')}
        confirmLabel="Move anyway"
        onCancel={() => setConfirmMove(null)}
        onConfirm={() => moveDate && void doMove(moveDate)}
      />
    </Screen>
  );
}
