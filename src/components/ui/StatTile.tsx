import { ArrowDown, ArrowUp, Minus } from 'lucide-react-native';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { ChangeTone } from '@/domain/weight/tone';
import { spacing, useTheme } from '@/theme';

import { Card } from './Card';
import { Text } from './Text';

const TONE_TEXT: Record<ChangeTone['tone'], string> = {
  toward: 'toward your goal',
  away: 'away from your goal',
  neutral: '',
};

/**
 * A labelled number. With `trend`, an arrow shows the direction and the tile is tinted green
 * (toward the goal) or amber (away from it); neutral stays plain.
 */
export function StatTile({
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
  // "—" means no data: a unit next to it ("— kg") reads like a value.
  const showUnit = !!unit && value !== '—';
  const showTrend = !!trend && value !== '—';
  const toneColor =
    showTrend && trend.tone === 'toward'
      ? colors.accent
      : showTrend && trend.tone === 'away'
        ? colors.warning
        : colors.textSecondary;
  const tint: ViewStyle | undefined =
    showTrend && trend.tone !== 'neutral'
      ? {
          backgroundColor: trend.tone === 'toward' ? colors.successSurface : colors.warningSurface,
          borderColor: toneColor,
        }
      : undefined;
  const Arrow =
    trend?.direction === 'down' ? ArrowDown : trend?.direction === 'up' ? ArrowUp : Minus;
  const meaning = showTrend ? TONE_TEXT[trend.tone] : '';

  return (
    <Card style={{ ...styles.tile, ...tint }}>
      <View
        accessible
        accessibilityLabel={`${label}: ${value}${showUnit ? ` ${unit}` : ''}${meaning ? `, ${meaning}` : ''}${caption ? `. ${caption}` : ''}`}
      >
        <Text variant="small" color="textSecondary">
          {label}
        </Text>
        <View style={styles.valueRow}>
          {showTrend ? (
            <View testID={`trend-${trend.direction}`} style={styles.arrow}>
              <Arrow size={22} color={toneColor} strokeWidth={2.5} />
            </View>
          ) : null}
          <Text
            variant="display"
            numeric
            style={showTrend && trend.tone !== 'neutral' ? { color: toneColor } : undefined}
          >
            {value}
          </Text>
          {showUnit ? (
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
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 140 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xxs },
  arrow: { alignSelf: 'center', marginRight: 2 },
});
