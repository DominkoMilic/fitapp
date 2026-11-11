import { ActivityIndicator, type PressableProps, StyleSheet, View } from 'react-native';

import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { labelProps, Text } from './Text';

/** Decorative glyphs (‹ › ✓ + ✕) are not read aloud: "+ Add set" is spoken as "Add set". */
export const spokenLabel = (title: string) =>
  title
    .replace(/[‹›✓✕+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * `destructive`: removes something for good (solid red). `caution`: serious but not destructive,
 * e.g. Report (red outline on a light red tint), so it reads differently from Remove beside it.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'caution';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  fullWidth = true,
  icon,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const bg = {
    primary: colors.accent,
    secondary: colors.surfaceRaised,
    ghost: 'transparent',
    destructive: colors.danger,
    caution: colors.dangerSurface,
  }[variant];
  const border = {
    primary: colors.accent,
    secondary: colors.border,
    ghost: colors.border,
    destructive: colors.danger,
    caution: colors.danger,
  }[variant];
  const fg = {
    primary: colors.onAccent,
    secondary: colors.textPrimary,
    ghost: colors.accent,
    destructive: colors.onDanger,
    caution: colors.danger,
  }[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? spokenLabel(title)}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      dimmed={isDisabled}
      haptic={variant === 'primary' || variant === 'destructive' ? 'light' : null}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          // Every button has a visible edge so it reads as tappable (ghost = outline button).
          borderColor: border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            variant="bodyStrong"
            align="center"
            style={[styles.label, { color: fg }]}
            {...labelProps(title)}
          >
            {title}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  label: { flexShrink: 1 },
});
