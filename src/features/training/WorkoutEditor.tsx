import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedRow, Button, Card, rowKeys, Text } from '@/components/ui';
import {
  type ActiveWorkout,
  addExercise,
  addSet,
  removeExercise,
  removeSet,
  updateSet,
} from '@/domain/training/active-workout';
import { spacing } from '@/theme';

import { ExerciseHowTo } from './ExerciseHowTo';
import { ExercisePicker } from './ExercisePicker';
import { useLastSets } from './last-performance';
import { SetRow } from './SetRow';

/**
 * Every exercise and set of a workout on one screen, for logging a past workout or editing a
 * saved one (spec 10.4): change reps, weight or seconds, tick what you did, add or remove sets
 * and exercises.
 */
export function WorkoutEditor({
  workout: w,
  onChange,
  metric,
  addedDone = false,
  planning = false,
}: {
  workout: ActiveWorkout;
  onChange: (next: ActiveWorkout) => void;
  metric: boolean;
  /** Logging afterwards: exercises you add start with their sets ticked (you already did them). */
  addedDone?: boolean;
  /** Before a workout starts: sets can be changed but not ticked off. */
  planning?: boolean;
}) {
  const { lastSets } = useLastSets();
  const [picking, setPicking] = useState(false);
  /** The exercise whose instructions are open (one at a time). */
  const [howTo, setHowTo] = useState<string | null>(null);
  const keys = rowKeys(w.exercises, (e) => e.slug);
  return (
    <View style={styles.stack}>
      {w.exercises.length === 0 ? (
        <Text color="textSecondary">
          {planning
            ? 'No exercises yet. Add some to start.'
            : 'No exercises yet. Add what you did.'}
        </Text>
      ) : null}
      {w.exercises.map((ex, i) => (
        <AnimatedRow key={keys[i]}>
          <Card>
            <View style={styles.head}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{ex.name}</Text>
                {caption(ex) ? (
                  <Text variant="caption" color="textSecondary">
                    {caption(ex)}
                  </Text>
                ) : null}
              </View>
              <Button
                title={howTo === keys[i] ? 'Hide' : 'How to'}
                variant="ghost"
                fullWidth={false}
                accessibilityLabel={`${howTo === keys[i] ? 'Hide' : 'Show'} how to do ${ex.name}`}
                onPress={() => setHowTo(howTo === keys[i] ? null : (keys[i] ?? null))}
              />
              {w.exercises.length > 1 ? (
                <Button
                  title="Remove"
                  variant="ghost"
                  fullWidth={false}
                  accessibilityLabel={`Remove ${ex.name}`}
                  onPress={() => onChange(removeExercise(w, i))}
                />
              ) : null}
            </View>
            {howTo === keys[i] ? <ExerciseHowTo slug={ex.slug} name={ex.name} /> : null}
            {ex.sets.map((s, k) => (
              <SetRow
                key={k}
                index={k}
                set={s}
                tracking={ex.tracking}
                metric={metric}
                onChange={(patch) => onChange(updateSet(w, i, k, patch))}
                onToggle={
                  planning
                    ? undefined
                    : () => onChange(updateSet(w, i, k, { completed: !s.completed }))
                }
                onRemove={ex.sets.length > 1 ? () => onChange(removeSet(w, i, k)) : undefined}
              />
            ))}
            <Button
              title="+ Add set"
              variant="ghost"
              fullWidth={false}
              disabled={ex.sets.length >= 10}
              onPress={() => onChange(addSet(w, i))}
            />
          </Card>
        </AnimatedRow>
      ))}
      {picking ? (
        <ExercisePicker
          onPick={(e) => {
            const next = addExercise(w, e, lastSets, w.exercises.length - 1);
            const at = next.currentIndex;
            onChange(
              addedDone
                ? {
                    ...next,
                    exercises: next.exercises.map((x, j) =>
                      j === at ? { ...x, sets: x.sets.map((s) => ({ ...s, completed: true })) } : x,
                    ),
                  }
                : next,
            );
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <Button title="+ Add an exercise" variant="secondary" onPress={() => setPicking(true)} />
      )}
    </View>
  );
}

const caption = (ex: ActiveWorkout['exercises'][number]) =>
  [
    ex.phase === 'warmup' ? 'Warm-up' : ex.phase === 'cooldown' ? 'Cool-down' : null,
    ex.unilateral ? 'per side' : null,
    ex.added ? 'added by you' : null,
  ]
    .filter(Boolean)
    .join(' · ');

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
