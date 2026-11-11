import { ChevronRight } from 'lucide-react-native';
import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
  raised,
  tone = 'default',
  actionLabel = 'Details',
  affordance = 'label',
}: PropsWithChildren<{
  onPress?: () => void;
  /** What tapping does (read as a hint; the card's own text stays readable). */
  accessibilityLabel?: string;
  style?: ViewStyle;
  raised?: boolean;
  /**
   * `success`: done / unlocked (tinted surface, accent border and a bar on the left) so it is
   * recognisable mid-scroll, not only by its icon. `muted`: locked / not yet available.
   * `warning`: started but not finished (amber surface, border and bar), e.g. a workout in progress.
   */
  tone?: 'default' | 'success' | 'muted' | 'warning';
  /**
   * A tappable card always shows that it opens something: `label` (default) adds a small
   * "Details ›" footer (text from `actionLabel`), `chevron` a trailing chevron for list-like cards.
   */
  actionLabel?: string;
  affordance?: 'label' | 'chevron' | 'none';
}>) {
  const { colors } = useTheme();
  const toneStyle: ViewStyle =
    tone === 'success'
      ? {
          backgroundColor: colors.successSurface,
          borderColor: colors.accent,
          borderLeftWidth: 5,
        }
      : tone === 'warning'
        ? {
            backgroundColor: colors.warningSurface,
            borderColor: colors.warning,
            borderLeftWidth: 5,
          }
        : tone === 'muted'
          ? {
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderStyle: 'dashed',
            }
          : {
              backgroundColor: raised ? colors.surfaceRaised : colors.surface,
              borderColor: colors.border,
            };
  const base = [styles.card, toneStyle, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityHint={accessibilityLabel}
      onPress={onPress}
      feedback="row"
      style={base}
    >
      {affordance === 'chevron' ? (
        <View style={styles.chevronRow}>
          <View style={styles.flex}>{children}</View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </View>
      ) : (
        <>
          {children}
          {affordance === 'label' ? (
            <View style={styles.action} importantForAccessibility="no-hide-descendants">
              <Text variant="small" color="accent" style={styles.actionText}>
                {actionLabel}
              </Text>
              <ChevronRight size={16} color={colors.accent} />
            </View>
          ) : null}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
  chevronRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: spacing.xxs,
  },
  actionText: { fontWeight: '600' },
});
