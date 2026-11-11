import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { ChangeTone } from '@/domain/weight/tone';
import { spacing, useTheme } from '@/theme';

import { Text } from './Text';

/**
 * A smaller labelled number for grouped figures inside one card. With `trend`, an arrow and
 * colour show the direction (green toward the goal, amber away), like StatTile.
 */
export function MiniStat({
  label,
  value,
  unit,
  caption,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  trend?: ChangeTone;
}) {
  const { colors } = useTheme();
  const empty = value === '—';
  const tone =
    !empty && trend?.tone === 'toward'
      ? colors.accent
      : !empty && trend?.tone === 'away'
        ? colors.warning
        : undefined;
  const Arrow =
    trend?.direction === 'down' ? ArrowDown : trend?.direction === 'up' ? ArrowUp : null;
  return (
    <View
      style={styles.item}
      accessible
      accessibilityLabel={`${label}: ${value}${unit && !empty ? ` ${unit}` : ''}${caption ? `. ${caption}` : ''}`}
    >
      <Text variant="small" color="textSecondary" numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.row}>
        {Arrow && !empty && tone ? <Arrow size={18} color={tone} strokeWidth={2.5} /> : null}
        <Text variant="title" numeric style={tone ? { color: tone } : undefined}>
          {value}
        </Text>
        {unit && !empty ? (
          <Text variant="small" color="textSecondary">
            {unit}
          </Text>
        ) : null}
      </View>
      {caption ? (
        <Text variant="caption" color="textSecondary">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xxs },
});
