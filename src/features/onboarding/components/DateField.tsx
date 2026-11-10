import { CalendarDays } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CalendarSheet } from '@/components/forms/CalendarSheet';
import { FieldError, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { formatLongDate, spokenDate } from '@/domain/calculations/calendar';
import { isValidIsoDate } from '@/domain/calculations/dates';
import { useToday } from '@/features/dashboard/useToday';
import { useProfile } from '@/features/profile/api';
import { motion, radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

/**
 * A date, picked from a calendar sheet instead of typed. Looks like the other inputs (including
 * the red tint for an error); `min`/`max` limit what can be picked. `startOnYears` opens on the
 * year list, for dates far back such as a date of birth.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  min = null,
  max = null,
  startOnYears = false,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  error?: string;
  min?: string | null;
  max?: string | null;
  startOnYears?: boolean;
}) {
  const { colors, reduceMotion } = useTheme();
  const { today } = useToday();
  const weekStartsOn = useProfile().data?.week_start === 7 ? 7 : 1;
  const [open, setOpen] = useState(false);
  const valid = value && isValidIsoDate(value) ? value : null;

  const errorTint = useSharedValue(error ? 1 : 0);
  useEffect(() => {
    errorTint.set(
      reduceMotion ? (error ? 1 : 0) : withTiming(error ? 1 : 0, { duration: motion.normal }),
    );
  }, [error, reduceMotion, errorTint]);
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
      <PressableScale
        feedback="row"
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${valid ? spokenDate(valid) : 'not chosen'}${error ? `, error: ${error}` : ''}`}
        accessibilityHint="Opens a calendar"
        onPress={() => setOpen(true)}
      >
        <Animated.View testID={error ? 'date-error' : 'date-field'} style={[styles.input, tint]}>
          <Text variant="body" color={valid ? 'textPrimary' : 'textSecondary'} style={styles.flex}>
            {valid ? formatLongDate(valid) : 'Choose a date'}
          </Text>
          <CalendarDays size={20} color={colors.accent} />
        </Animated.View>
      </PressableScale>
      <FieldError message={error} />
      {open ? (
        <CalendarSheet
          visible
          title={label}
          value={valid}
          today={today}
          min={min}
          max={max}
          weekStartsOn={weekStartsOn}
          initialView={startOnYears && !valid ? 'years' : 'days'}
          onSelect={(d) => onChange(d)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xxs },
  label: { marginBottom: 2 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET + 4,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  flex: { flex: 1 },
});
