import { Eye, EyeOff } from 'lucide-react-native';
import { type ComponentRef, type Ref, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion, radius, spacing, TOUCH_TARGET, typography, useTheme } from '@/theme';

import { FieldError } from './FieldError';
import { useFormLocked } from './FormLock';

import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  suffix?: string;
  /** Error styling without a message of its own (e.g. one part of a date shares one message). */
  invalid?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

const isEmailField = (p: TextInputProps) =>
  p.keyboardType === 'email-address' ||
  p.textContentType === 'emailAddress' ||
  (typeof p.autoComplete === 'string' && p.autoComplete.startsWith('email'));

/**
 * Keyboard behaviour shared by every field (callers can override any of it):
 * - Return moves to the next field and keeps the keyboard open; a field with its own
 *   `onSubmitEditing` (usually the last one in a form) shows "done" and submits.
 * - Passwords and emails are never auto-capitalised or auto-corrected.
 */
export function keyboardDefaults(p: TextInputProps): TextInputProps {
  const literal = !!p.secureTextEntry || isEmailField(p);
  const ownSubmit = !!p.onSubmitEditing;
  const returnKeyType = p.multiline ? undefined : ownSubmit ? 'done' : 'next';
  return {
    returnKeyType,
    submitBehavior: p.multiline ? undefined : returnKeyType === 'next' ? 'submit' : 'blurAndSubmit',
    onSubmitEditing: ownSubmit ? undefined : () => KeyboardController.setFocusTo('next'),
    ...(literal ? { autoCapitalize: 'none', autoCorrect: false, spellCheck: false } : null),
  };
}

export function TextField({
  label,
  error,
  hint,
  suffix,
  invalid,
  style,
  ref,
  ...rest
}: TextFieldProps) {
  const { colors, reduceMotion } = useTheme();
  const locked = useFormLocked();
  const secure = !!rest.secureTextEntry;
  const [revealed, setRevealed] = useState(false);
  const hasError = !!error || !!invalid;
  // The input eases into a red tint (border and background) when it has an error, and back.
  const errorTint = useSharedValue(hasError ? 1 : 0);
  useEffect(() => {
    errorTint.set(
      reduceMotion ? (hasError ? 1 : 0) : withTiming(hasError ? 1 : 0, { duration: motion.normal }),
    );
  }, [hasError, reduceMotion, errorTint]);
  const tint = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      errorTint.get(),
      [0, 1],
      [colors.surface, colors.dangerSurface],
    ),
    borderColor: interpolateColor(errorTint.get(), [0, 1], [colors.border, colors.danger]),
  }));
  return (
    <View style={styles.wrapper}>
      <Text variant="small" color="textSecondary" style={styles.label}>
        {label}
      </Text>
      <Animated.View testID={hasError ? 'field-error' : undefined} style={[styles.inputRow, tint]}>
        <TextInput
          ref={ref}
          accessibilityLabel={error ? `${label}, error: ${error}` : label}
          accessibilityHint={hint}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, typography.body, { color: colors.textPrimary }, style]}
          maxFontSizeMultiplier={2}
          {...keyboardDefaults(rest)}
          {...rest}
          secureTextEntry={secure && !revealed}
          editable={locked ? false : rest.editable}
        />
        {suffix ? (
          <Text variant="body" color="textSecondary">
            {suffix}
          </Text>
        ) : null}
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((r) => !r)}
            hitSlop={8}
            style={styles.reveal}
          >
            {revealed ? (
              <EyeOff size={20} color={colors.textSecondary} />
            ) : (
              <Eye size={20} color={colors.textSecondary} />
            )}
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <FieldError message={error} />
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
  reveal: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
  },
});
