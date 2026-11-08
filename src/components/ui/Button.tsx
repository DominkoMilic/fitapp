import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';

import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

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
  }[variant];
  const fg = {
    primary: colors.onAccent,
    secondary: colors.textPrimary,
    ghost: colors.accent,
    destructive: colors.onDanger,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: variant === 'secondary' ? colors.border : 'transparent',
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
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
          <Text variant="bodyStrong" style={{ color: fg }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
