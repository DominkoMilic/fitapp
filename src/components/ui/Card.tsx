import { type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
  raised,
}: PropsWithChildren<{
  onPress?: () => void;
  /** What tapping does (read as a hint; the card's own text stays readable). */
  accessibilityLabel?: string;
  style?: ViewStyle;
  raised?: boolean;
}>) {
  const { colors } = useTheme();
  const base = [
    styles.card,
    { backgroundColor: raised ? colors.surfaceRaised : colors.surface, borderColor: colors.border },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
});
