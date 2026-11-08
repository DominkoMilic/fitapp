import { type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { radius, spacing, TOUCH_TARGET, typography, useTheme } from '@/theme';

import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  suffix?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, error, hint, suffix, style, ref, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text variant="small" color="textSecondary" style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, typography.body, { color: colors.textPrimary }, style]}
          maxFontSizeMultiplier={2}
          {...rest}
        />
        {suffix ? (
          <Text variant="body" color="textSecondary">
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text
          variant="small"
          color="danger"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xxs },
  label: { marginBottom: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET + 4,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  input: { flex: 1, paddingVertical: spacing.xs },
});
