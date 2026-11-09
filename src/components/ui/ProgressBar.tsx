import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Text } from './Text';

/** Horizontal progress. `value` null means "no data", shown distinctly from zero. */
export function ProgressBar({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number | null;
  max: number;
  unit: string;
}) {
  const { colors } = useTheme();
  const ratio = value === null || max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const text =
    value === null
      ? `No data · target ${max} ${unit}`
      : unit === '%' && max === 100
        ? `${Math.round(value)}%`
        : `${Math.round(value)} / ${max} ${unit}`;
  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value ?? undefined, text }}
    >
      <View style={styles.labels}>
        <Text variant="small">{label}</Text>
        <Text variant="small" color="textSecondary" numeric>
          {text}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xxs },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
});
