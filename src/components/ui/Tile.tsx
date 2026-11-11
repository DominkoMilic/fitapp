import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** A square shortcut with an icon and a short label (Training and Progress "more" rows). */
export function Tile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {icon}
      <Text variant="small" align="center" style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: TOUCH_TARGET + 28,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  label: { fontWeight: '600' },
});
