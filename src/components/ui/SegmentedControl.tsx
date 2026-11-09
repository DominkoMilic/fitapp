import { StyleSheet, View } from 'react-native';

import { radius, TOUCH_TARGET, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { labelProps, Text } from './Text';

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
          <PressableScale
            key={o.value}
            haptic={selected ? null : 'selection'}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: colors.accent }]}
          >
            <Text
              variant="small"
              align="center"
              style={{ color: selected ? colors.onAccent : colors.textPrimary, fontWeight: '600' }}
              {...labelProps(o.label)}
            >
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: radius.button, borderWidth: 1, padding: 3, gap: 3 },
  segment: {
    // Share the row by label length, so "Breakfast" gets more room than "Any".
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minHeight: TOUCH_TARGET,
    borderRadius: radius.button - 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
