import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, NumberField, Screen, Text } from '@/components/ui';
import {
  addSet,
  createActiveWorkout,
  elapsedS,
  goTo,
  isPaused,
  pause,
  reportPain,
  restRemainingS,
  resume,
  skipExercise,
  skipRest,
  toggleSetDone,
  updateSet,
} from '@/domain/training/active-workout';
import { EXERCISE_BY_SLUG } from '@/domain/training/catalogue';
import { suggestProgression } from '@/domain/training/progression';
import { formatClock, useNow } from '@/hooks/useNow';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { useActiveWorkout, useActiveWorkoutStore } from '@/features/training/active-workout-store';
import { useLastSets } from '@/features/training/last-performance';
import { useScheduledWorkout } from '@/features/training/schedule-api';
import { useSessions } from '@/features/training/session-api';
import { useBuiltWorkout } from '@/features/training/useBuiltWorkout';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';
import { KG_PER_LB } from '@/domain/calculations/units';
import { announce } from '@/services/a11y/announce';

/** Starts (or resumes) a workout and runs it set by set. */
export default function WorkoutSession() {
  const { scheduledId, template } = useLocalSearchParams<{
    scheduledId?: string;
    template?: string;
  }>();
  const userId = useAuth().session?.user.id;
  const active = useActiveWorkout(userId);
  const { workout: scheduled, isPending } = useScheduledWorkout(scheduledId);
  const built = useBuiltWorkout(template ?? scheduled?.template_slug);
  const sessions = useSessions();
  const { lastSets } = useLastSets();
  const setStore = useActiveWorkoutStore((s) => s.set);
  const [resumeAnyway, setResumeAnyway] = useState(false);
  // After a workout is saved or discarded the store is cleared while this screen may still be
  // mounted underneath the summary; it must not start another workout (phantom workout bug).
  const [openedAt] = useState(() => Date.now());
  const finishedAt = useActiveWorkoutStore((s) => s.finishedAt);
  const finishedSinceOpened = finishedAt !== null && finishedAt >= openedAt;
  // Opened for a different workout while one is running: ask before replacing anything.
  const conflict = !!active && !!scheduledId && active.scheduledId !== scheduledId && !resumeAnyway;

  // Start a new workout unless one is already running.
  useEffect(() => {
    if (!userId || !built || sessions.isPending) return;
    if (active || finishedSinceOpened) return;
    setStore(
      createActiveWorkout({
        id: randomUUID(),
        userId,
        scheduledId: scheduled?.id ?? null,
        built,
        category: scheduled?.category ?? 'strength',
        intensity: scheduled?.intensity ?? 'moderate',
        now: Date.now(),
        lastSets,
      }),
    );
  }, [
    userId,
    built,
    sessions.isPending,
    active,
    finishedSinceOpened,
    scheduledId,
    scheduled,
    lastSets,
    setStore,
  ]);

  if (conflict && active) {
    return (
      <Screen edges={['bottom']}>
        <Banner
          tone="info"
          title="A workout is already in progress"
          message={`${active.title} was started earlier and isn't finished.`}
        />
        <Button title="Resume it" onPress={() => setResumeAnyway(true)} />
        <Button
          title="Finish or discard it first"
          variant="ghost"
          onPress={() => router.replace('/training/summary')}
        />
      </Screen>
    );
  }
  if (active) return <Runner />;
  if (finishedSinceOpened) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="Workout finished"
          message="It's saved in your history."
          actionLabel="Back to Training"
          onAction={() => router.replace('/training')}
        />
      </Screen>
    );
  }
  if (isPending || sessions.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Preparing your workout" />
      </Screen>
    );
  if (!built)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          title="No workout to start"
          message="Open a workout from your calendar to start it."
        />
      </Screen>
    );
  return (
    <Screen edges={['bottom']}>
      <LoadingState />
    </Screen>
  );
}

function Runner() {
  const { colors } = useTheme();
  const userId = useAuth().session?.user.id;
  const w = useActiveWorkout(userId)!;
  const update = useActiveWorkoutStore((s) => s.update);
  const { data: profile } = useProfile();
  const { lastSets, lastRpeBySlug } = useLastSets();
  const paused = isPaused(w);
  const now = useNow(1000, !paused || w.restEndsAt !== null);
  const [showHow, setShowHow] = useState(false);
  const [confirmPain, setConfirmPain] = useState(false);
  const metric = (profile?.unit_system ?? 'metric') === 'metric';
  const toDisp = (kg: number | null) =>
    kg === null ? null : metric ? kg : Math.round((kg / KG_PER_LB) * 10) / 10;
  const fromDisp = (v: number | null) => (v === null ? null : metric ? v : v * KG_PER_LB);

  const i = w.currentIndex;
  const ex = w.exercises[i]!;
  const info = EXERCISE_BY_SLUG[ex.slug];
  const rest = restRemainingS(w, now);
  // Speak once when a rest ends (a live region would read the timer every second).
  const resting = rest > 0;
  const wasResting = useRef(false);
  useEffect(() => {
    if (wasResting.current && !resting) announce('Rest over. Time for your next set.');
    wasResting.current = resting;
  }, [resting]);
  const last = lastSets[ex.slug];
  const suggestion =
    last && ex.phase === 'main'
      ? suggestProgression({
          sets: last.map((s) => ({ reps: s.reps, weightKg: s.weightKg, completed: true })),
          repsMax: ex.repsMax,
          plannedSets: ex.targetSets,
          rpe: lastRpeBySlug[ex.slug] ?? null,
          restS: ex.restS,
          unilateral: ex.unilateral,
          veryHardStreak: 0,
          heavierWeightAvailableKg: null,
        })
      : null;
  const target =
    ex.tracking === 'time'
      ? `${ex.targetSets} × ${ex.durationS} s`
      : `${ex.targetSets} × ${ex.repsMin}${ex.repsMax !== ex.repsMin ? `–${ex.repsMax}` : ''} reps`;

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footerRow}>
          <Button
            title="‹ Back"
            variant="secondary"
            fullWidth={false}
            disabled={i === 0}
            onPress={() => update((x) => goTo(x, i - 1))}
          />
          {i < w.exercises.length - 1 ? (
            <Button
              title="Next exercise ›"
              fullWidth={false}
              onPress={() => update((x) => goTo(x, i + 1))}
            />
          ) : (
            <Button
              title="Finish workout"
              fullWidth={false}
              onPress={() => router.push('/training/summary')}
            />
          )}
        </View>
      }
    >
      <View style={styles.topRow}>
        <Text variant="small" color="textSecondary">
          {i + 1} / {w.exercises.length} ·{' '}
          {ex.phase === 'warmup' ? 'Warm-up' : ex.phase === 'cooldown' ? 'Cool-down' : 'Main'}
        </Text>
        <Text
          variant="title"
          numeric
          accessibilityLabel={`Elapsed ${formatClock(elapsedS(w, now))}`}
        >
          {formatClock(elapsedS(w, now))}
        </Text>
        <Button
          title={paused ? 'Resume' : 'Pause'}
          variant="ghost"
          fullWidth={false}
          onPress={() =>
            update((x) => (isPaused(x) ? resume(x, Date.now()) : pause(x, Date.now())))
          }
        />
      </View>
      {paused ? <Banner tone="info" message="Paused. The timer stops until you resume." /> : null}

      <Text variant="heading" accessibilityRole="header">
        {ex.name}
      </Text>
      <Text color="textSecondary">
        {target}
        {ex.unilateral ? ' per side' : ''}
        {ex.restS ? ` · rest ${ex.restS} s` : ''}
      </Text>
      {suggestion && suggestion.kind !== 'none' ? (
        <Text variant="small" color="accent">
          {suggestion.message}
        </Text>
      ) : null}
      {ex.painFlag ? (
        <Banner
          tone="warning"
          message="You reported pain. Skip exercises that hurt and consider finishing for today. If pain persists, get it checked by a healthcare professional."
        />
      ) : null}
      {info ? (
        <Button
          title={showHow ? 'Hide instructions' : 'How to do it'}
          variant="ghost"
          fullWidth={false}
          onPress={() => setShowHow(!showHow)}
        />
      ) : null}
      {showHow && info ? (
        <Card>
          {info.instructions.map((step, k) => (
            <Text key={k} variant="small">
              {k + 1}. {step}
            </Text>
          ))}
          <Text variant="caption" color="textSecondary">
            {info.caution}
          </Text>
        </Card>
      ) : null}

      {rest > 0 ? (
        <Card raised>
          <Text variant="small" color="textSecondary">
            Rest
          </Text>
          <Text variant="display" numeric>
            {formatClock(rest)}
          </Text>
          <Button
            title="Skip rest"
            variant="ghost"
            fullWidth={false}
            onPress={() => update(skipRest)}
          />
        </Card>
      ) : null}

      {ex.sets.map((s, k) => (
        <View
          key={k}
          style={[
            styles.setRow,
            {
              borderColor: s.completed ? colors.accent : colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Text variant="bodyStrong" style={styles.setNo}>
            {k + 1}
          </Text>
          {ex.tracking === 'time' ? (
            <View style={styles.flex}>
              <NumberField
                label={`Set ${k + 1} seconds`}
                suffix="s"
                decimal={false}
                precision={0}
                value={s.durationS}
                onChangeValue={(v) => update((x) => updateSet(x, i, k, { durationS: v }))}
              />
            </View>
          ) : (
            <>
              <View style={styles.flex}>
                <NumberField
                  label={`Set ${k + 1} reps`}
                  decimal={false}
                  precision={0}
                  value={s.reps}
                  onChangeValue={(v) => update((x) => updateSet(x, i, k, { reps: v }))}
                />
              </View>
              {ex.tracking === 'reps_weight' ? (
                <View style={styles.flex}>
                  <NumberField
                    label={`Set ${k + 1} weight`}
                    suffix={metric ? 'kg' : 'lb'}
                    value={toDisp(s.weightKg)}
                    onChangeValue={(v) =>
                      update((x) => updateSet(x, i, k, { weightKg: fromDisp(v) }))
                    }
                  />
                </View>
              ) : null}
            </>
          )}
          <Button
            title={s.completed ? '✓' : 'Done'}
            variant={s.completed ? 'primary' : 'secondary'}
            fullWidth={false}
            accessibilityLabel={`Set ${k + 1} ${s.completed ? 'completed, tap to undo' : 'mark as done'}`}
            onPress={() => update((x) => toggleSetDone(x, i, k, Date.now()))}
          />
        </View>
      ))}
      <View style={styles.footerRow}>
        <Button
          title="+ Add set"
          variant="ghost"
          fullWidth={false}
          onPress={() => update((x) => addSet(x, i))}
        />
        <Button
          title="Skip exercise"
          variant="ghost"
          fullWidth={false}
          onPress={() => update((x) => skipExercise(x, i))}
        />
      </View>
      <Button title="It hurts" variant="destructive" onPress={() => setConfirmPain(true)} />
      <ConfirmDialog
        visible={confirmPain}
        title="Stop this exercise?"
        message="Don't train through pain. PACE will mark this exercise and you can move on or finish the workout."
        confirmLabel="Stop exercise"
        onCancel={() => setConfirmPain(false)}
        onConfirm={() => {
          update((x) => reportPain(x, i));
          setConfirmPain(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  setRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1.5,
    borderRadius: radius.card,
  },
  setNo: { width: 20, textAlign: 'center', marginBottom: spacing.sm },
  flex: { flex: 1, minWidth: TOUCH_TARGET * 1.5 },
});
