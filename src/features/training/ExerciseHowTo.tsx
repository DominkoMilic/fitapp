import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { EXERCISE_BY_SLUG } from '@/domain/training/catalogue';
import { spacing } from '@/theme';

import { ExerciseAnimation } from './ExerciseAnimation';

/**
 * How to do an exercise: the animation (when there is one), numbered steps and the caution.
 * Used in the workout list (tap to expand), before starting, and mid-workout.
 */
export function ExerciseHowTo({
  slug,
  name,
  showAnimation = true,
  /** Steps for exercises outside the catalogue (the user's own). */
  fallbackSteps,
}: {
  slug: string;
  name?: string;
  showAnimation?: boolean;
  fallbackSteps?: readonly string[];
}) {
  const info = EXERCISE_BY_SLUG[slug];
  const steps = info?.instructions ?? fallbackSteps ?? [];
  return (
    <View style={styles.wrap}>
      {showAnimation ? (
        <View style={styles.anim}>
          <ExerciseAnimation slug={slug} name={name ?? info?.name} size={180} />
        </View>
      ) : null}
      {steps.length ? (
        steps.map((step, k) => (
          <Text key={k} variant="small">
            {k + 1}. {step}
          </Text>
        ))
      ) : (
        <Text variant="small" color="textSecondary">
          No instructions for this exercise yet.
        </Text>
      )}
      {info?.caution ? (
        <Text variant="caption" color="textSecondary">
          {info.caution}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  anim: { alignItems: 'center', paddingVertical: spacing.xxs },
});
