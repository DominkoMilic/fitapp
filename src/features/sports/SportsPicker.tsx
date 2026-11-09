import { StyleSheet, View } from 'react-native';

import { ChipGroup, Text, Toggle } from '@/components/ui';
import { SPORTS } from '@/domain/sports/catalogue';
import { spacing } from '@/theme';

/** Which sports the user plays (any number, up to 8), or none. */
export function SportsPicker({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (sports: string[]) => void;
}) {
  const none = value.length === 0;
  return (
    <View style={styles.stack}>
      <Toggle
        label="I don't play a sport"
        description="PACE plans your training and nutrition without games or practices."
        value={none}
        onChange={(on) => onChange(on ? [] : [...value])}
      />
      <Text variant="small" color="textSecondary">
        {none ? 'Or pick the sports you play:' : 'Sports you play (pick all that apply):'}
      </Text>
      <ChipGroup
        accessibilityLabel="Sports you play"
        options={SPORTS.map((s) => ({ value: s.key, label: s.label }))}
        selected={value}
        onToggle={(k) =>
          onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k].slice(0, 8))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: spacing.xs } });
