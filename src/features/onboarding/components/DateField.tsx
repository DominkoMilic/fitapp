import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NumberField, Text } from '@/components/ui';
import { isValidIsoDate } from '@/domain/calculations/dates';
import { spacing } from '@/theme';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function split(iso: string | null) {
  if (!iso || !isValidIsoDate(iso)) return { d: null, m: null, y: null };
  const [y, m, d] = iso.split('-').map(Number);
  return { d: d ?? null, m: m ?? null, y: y ?? null };
}

/**
 * Day / month / year entry. Works the same on iOS, Android and web, and with screen readers.
 * Reports an ISO date only when all three parts form a real calendar date.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  error?: string;
}) {
  const [parts, setParts] = useState(() => split(value));

  const update = (next: typeof parts) => {
    setParts(next);
    const { d, m, y } = next;
    const iso = d && m && y && y >= 1900 ? `${pad(y, 4)}-${pad(m)}-${pad(d)}` : null;
    onChange(iso && isValidIsoDate(iso) ? iso : null);
  };

  return (
    <View style={styles.wrapper}>
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
      <View style={styles.row}>
        <View style={styles.small}>
          <NumberField
            label="Day"
            accessibilityLabel={`${label}, day${error ? `, error: ${error}` : ''}`}
            decimal={false}
            precision={0}
            value={parts.d}
            onChangeValue={(d) => update({ ...parts, d })}
            maxLength={2}
          />
        </View>
        <View style={styles.small}>
          <NumberField
            label="Month"
            accessibilityLabel={`${label}, month${error ? `, error: ${error}` : ''}`}
            decimal={false}
            precision={0}
            value={parts.m}
            onChangeValue={(m) => update({ ...parts, m })}
            maxLength={2}
          />
        </View>
        <View style={styles.large}>
          <NumberField
            label="Year"
            accessibilityLabel={`${label}, year${error ? `, error: ${error}` : ''}`}
            decimal={false}
            precision={0}
            value={parts.y}
            onChangeValue={(y) => update({ ...parts, y })}
            maxLength={4}
          />
        </View>
      </View>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xxs },
  row: { flexDirection: 'row', gap: spacing.xs },
  small: { flex: 1 },
  large: { flex: 1.5 },
});
