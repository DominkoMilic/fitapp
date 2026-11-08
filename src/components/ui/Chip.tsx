import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { Text } from './Text';

export function Chip({
  label,
  selected,
  onPress,
  onRemove,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}) {
  const { colors } = useTheme();
  const press = onRemove ?? onPress;
  return (
    <Pressable
      accessibilityRole={onRemove ? 'button' : 'checkbox'}
      accessibilityState={onRemove ? undefined : { checked: !!selected }}
      accessibilityLabel={onRemove ? `Remove ${label}` : label}
      onPress={press}
      hitSlop={4}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.surfaceRaised,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <Text
        variant="small"
        style={{ color: selected ? colors.onAccent : colors.textPrimary, fontWeight: '500' }}
      >
        {onRemove ? `${label}  ✕` : label}
      </Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  /** Names the group for screen readers (needed when two groups share option labels). */
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.group} role="group" aria-label={accessibilityLabel}>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={selected.includes(o.value)}
          onPress={() => onToggle(o.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_TARGET - 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
