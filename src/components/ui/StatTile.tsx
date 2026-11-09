import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Card } from './Card';
import { Text } from './Text';

export function StatTile({
  label,
  value,
  unit,
  caption,
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
}) {
  // "—" means no data: a unit next to it ("— kg") reads like a value.
  const showUnit = !!unit && value !== '—';
  return (
    <Card style={styles.tile}>
      <View
        accessible
        accessibilityLabel={`${label}: ${value}${showUnit ? ` ${unit}` : ''}${caption ? `. ${caption}` : ''}`}
      >
        <Text variant="small" color="textSecondary">
          {label}
        </Text>
        <View style={styles.valueRow}>
          <Text variant="display" numeric>
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
});
