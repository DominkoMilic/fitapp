import { ChevronDown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { motion, radius, spacing, useTheme } from '@/theme';

import { ExerciseHowTo } from './ExerciseHowTo';

/**
 * An exercise in a workout list. Tapping it opens the instructions (animation, steps, caution)
 * right there, so you can check how to do it without leaving the list or the workout.
 */
export function ExpandableExerciseCard({
  slug,
  name,
  detail,
  eyebrow,
  expanded,
  onToggle,
}: {
  slug: string;
  name: string;
  /** e.g. "3 × 12 reps". */
  detail: string;
  /** e.g. "Warm-up". */
  eyebrow?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <PressableScale
        feedback="row"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${name}, ${detail}`}
        accessibilityHint={expanded ? 'Hides the instructions' : 'Shows how to do it'}
        onPress={onToggle}
        style={styles.header}
      >
        <View style={styles.flex}>
          {eyebrow ? (
            <Text variant="small" color="textSecondary">
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="bodyStrong">{name}</Text>
          <Text variant="small" color="textSecondary">
            {detail}
          </Text>
        </View>
        <View style={expanded ? styles.up : undefined}>
          <ChevronDown size={20} color={colors.textSecondary} />
        </View>
      </PressableScale>
      {expanded ? (
        <Animated.View entering={FadeIn.duration(motion.fast)} style={styles.body}>
          <ExerciseHowTo slug={slug} name={name} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  flex: { flex: 1, gap: 2 },
  up: { transform: [{ rotate: '180deg' }] },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
