import { Clock } from 'lucide-react-native';
import { type ComponentRef, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { ModalShell } from '@/components/ui/ModalShell';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import {
  isTimeOfDay,
  pickerHours,
  pickerMinutes,
  snapTime,
} from '@/domain/calculations/time-of-day';
import { haptics, motion, radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

const ROW = TOUCH_TARGET;
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A time of day ("HH:MM", 24-hour), picked instead of typed: hours, then minutes in 5-minute
 * steps. Looks like the other inputs (red tint and message for an error); `min`/`max` limit what
 * can be picked (e.g. reminders outside quiet hours).
 */
export function TimeField({
  label,
  value,
  onChange,
  error,
  hint,
  min = null,
  max = null,
  fallback,
}: {
  label: string;
  value: string | null;
  onChange: (time: string) => void;
  error?: string;
  hint?: string;
  min?: string | null;
  max?: string | null;
  /** Where the picker starts when there's no value yet. */
  fallback?: string;
}) {
  const { colors, reduceMotion } = useTheme();
  const [open, setOpen] = useState(false);
  const valid = isTimeOfDay(value) ? value : null;

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
        accessibilityLabel={`${label}: ${valid ?? 'not chosen'}${error ? `, error: ${error}` : ''}`}
        accessibilityHint="Opens a time picker"
        onPress={() => setOpen(true)}
      >
        <Animated.View testID={error ? 'time-error' : 'time-field'} style={[styles.input, tint]}>
          <Text variant="body" color={valid ? 'textPrimary' : 'textSecondary'} style={styles.flex}>
            {valid ?? 'Choose a time'}
          </Text>
          <Clock size={20} color={colors.accent} />
        </Animated.View>
      </PressableScale>
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <Text variant="small" color="textSecondary">
          {hint}
        </Text>
      ) : null}
      {open ? (
        <TimeSheet
          title={label}
          start={snapTime(valid, min, max, fallback)}
          min={min}
          max={max}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

function TimeSheet({
  title,
  start,
  min,
  max,
  onSelect,
  onClose,
}: {
  title: string;
  start: string;
  min: string | null;
  max: string | null;
  onSelect: (time: string) => void;
  onClose: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const [hour, setHour] = useState(Number(start.slice(0, 2)));
  const [minute, setMinute] = useState(Number(start.slice(3, 5)));
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  const close = () => {
    if (closing) return;
    if (reduceMotion) return onClose();
    setClosing(true);
    closeTimer.current = setTimeout(onClose, motion.normal);
  };

  const hours = pickerHours(min, max);
  const minutes = pickerMinutes(hour, min, max);
  const pickHour = (h: number) => {
    haptics.selection();
    setHour(h);
    // Keep the minute when it exists in the new hour, otherwise take the nearest one there.
    const options = pickerMinutes(h, min, max);
    if (!options.includes(minute) && options.length) {
      setMinute(
        options.reduce((best, m) => (Math.abs(m - minute) < Math.abs(best - minute) ? m : best)),
      );
    }
  };
  const done = () => {
    haptics.light();
    onSelect(`${pad(hour)}:${pad(minute)}`);
    close();
  };

  return (
    <ModalShell visible onRequestClose={close} style={styles.backdrop}>
      {closing ? null : (
        <>
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(motion.screen)}
            exiting={reduceMotion ? undefined : FadeOut.duration(motion.normal)}
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close time picker"
            />
          </Animated.View>
          <Animated.View
            entering={reduceMotion ? undefined : SlideInDown.duration(motion.screen)}
            exiting={reduceMotion ? undefined : SlideOutDown.duration(motion.normal)}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: spacing.lg + (insets?.bottom ?? 0),
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text variant="small" color="textSecondary">
              {title}
            </Text>
            <Text variant="heading" align="center" accessibilityLiveRegion="polite">
              {pad(hour)}:{pad(minute)}
            </Text>
            <View style={styles.columns}>
              <Column label="Hour" values={hours} selected={hour} onPick={pickHour} format={pad} />
              <Column
                label="Minute"
                values={minutes}
                selected={minute}
                onPick={(m) => {
                  haptics.selection();
                  setMinute(m);
                }}
                format={pad}
              />
            </View>
            <View style={styles.actions}>
              <Button title="Cancel" variant="ghost" fullWidth={false} onPress={close} />
              <Button title="Done" fullWidth={false} onPress={done} />
            </View>
          </Animated.View>
        </>
      )}
    </ModalShell>
  );
}

function Column({
  label,
  values,
  selected,
  onPick,
  format,
}: {
  label: string;
  values: number[];
  selected: number;
  onPick: (v: number) => void;
  format: (v: number) => string;
}) {
  const { colors } = useTheme();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const index = Math.max(0, values.indexOf(selected));
  // Opens with the chosen value in the middle of the column.
  const initialY = Math.max(0, (index - 2) * ROW);
  return (
    <View style={styles.column}>
      <Text variant="small" color="textSecondary" align="center">
        {label}
      </Text>
      <ScrollView
        ref={ref}
        style={[styles.list, { borderColor: colors.border }]}
        contentOffset={{ x: 0, y: initialY }}
        onLayout={() => ref.current?.scrollTo({ y: initialY, animated: false })}
        showsVerticalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {values.map((v) => {
          const on = v === selected;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${label} ${format(v)}`}
              onPress={() => onPick(v)}
              style={[styles.row, on ? { backgroundColor: colors.accent } : null]}
            >
              <Text
                variant="body"
                align="center"
                style={{ color: on ? colors.onAccent : colors.textPrimary, fontWeight: '600' }}
              >
                {format(v)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.xs },
  columns: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, gap: spacing.xxs },
  list: { height: ROW * 5, borderWidth: 1, borderRadius: radius.input },
  row: {
    height: ROW,
    justifyContent: 'center',
    borderRadius: radius.input - 4,
    marginHorizontal: 2,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
