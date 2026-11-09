import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { Text } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: colors.accent }]}
          >
            <Text
              variant="small"
              style={{ color: selected ? colors.onAccent : colors.textPrimary, fontWeight: '600' }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: radius.button, borderWidth: 1, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.button - 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});
