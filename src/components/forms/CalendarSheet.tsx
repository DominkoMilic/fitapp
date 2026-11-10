import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutDown,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';
import { Text } from '@/components/ui/Text';
import {
  clampMonth,
  MONTH_NAMES,
  monthGrid,
  shiftMonth,
  spokenDate,
  weekdayLabels,
} from '@/domain/calculations/calendar';
import type { IsoDate } from '@/domain/calculations/dates';
import { haptics, motion, radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

type View_ = 'days' | 'months' | 'years';
const YEARS_PER_PAGE = 12;

const ymKey = (y: number, m: number) => y * 12 + m;
const inRange = (d: IsoDate, min: IsoDate | null, max: IsoDate | null) =>
  (!min || d >= min) && (!max || d <= max);

/**
 * Calendar in a bottom sheet. Tap a day to pick it (the sheet closes). Tap the month title to
 * jump by year and month (handy for a date of birth); swipe or use the arrows to change month.
 * Days outside [min, max] can't be picked.
 */
export function CalendarSheet({
  visible,
  title,
  value,
  today,
  min = null,
  max = null,
  weekStartsOn = 1,
  initialView = 'days',
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: IsoDate | null;
  today: IsoDate;
  min?: IsoDate | null;
  max?: IsoDate | null;
  weekStartsOn?: 1 | 7;
  initialView?: View_;
  onSelect: (date: IsoDate) => void;
  onClose: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  // Closing plays the exit animation first, then tells the parent (which unmounts the sheet).
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
  const start = clampMonth(
    {
      year: Number((value ?? today).slice(0, 4)),
      month: Number((value ?? today).slice(5, 7)),
    },
    min,
    max,
  );
  const [ym, setYm] = useState(start);
  const [view, setView] = useState<View_>(initialView);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [yearPage, setYearPage] = useState(() => start.year - (start.year % YEARS_PER_PAGE));

  const minYm = min ? ymKey(+min.slice(0, 4), +min.slice(5, 7)) : -Infinity;
  const maxYm = max ? ymKey(+max.slice(0, 4), +max.slice(5, 7)) : Infinity;
  const canPrev = ymKey(ym.year, ym.month) > minYm;
  const canNext = ymKey(ym.year, ym.month) < maxYm;

  const go = (delta: 1 | -1) => {
    if ((delta === 1 && !canNext) || (delta === -1 && !canPrev)) return;
    haptics.selection();
    setDirection(delta);
    setYm((c) => shiftMonth(c.year, c.month, delta));
  };

  const swipe = usePanGesture({
    activeOffsetX: [-20, 20],
    failOffsetY: [-20, 20],
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX < -50) scheduleOnRN(go, 1);
      else if (e.translationX > 50) scheduleOnRN(go, -1);
    },
  });

  const pick = (d: IsoDate) => {
    haptics.light();
    onSelect(d);
    close();
  };

  const cells = monthGrid(ym.year, ym.month, weekStartsOn);
  const monthAnim = reduceMotion
    ? undefined
    : (direction === 1 ? SlideInRight : SlideInLeft).duration(motion.normal);

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={view === 'years' ? 'Earlier years' : 'Previous month'}
        disabled={view === 'days' ? !canPrev : view === 'months'}
        onPress={() => (view === 'years' ? setYearPage((p) => p - YEARS_PER_PAGE) : go(-1))}
        style={[
          styles.arrow,
          { opacity: view === 'months' || (view === 'days' && !canPrev) ? 0.3 : 1 },
        ]}
      >
        <ChevronLeft size={22} color={colors.textPrimary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${MONTH_NAMES[ym.month - 1]} ${ym.year}. Choose month and year`}
        onPress={() => setView(view === 'days' ? 'years' : 'days')}
        style={styles.titleButton}
      >
        <Text variant="bodyStrong">
          {view === 'years'
            ? `${yearPage} – ${yearPage + YEARS_PER_PAGE - 1}`
            : view === 'months'
              ? String(ym.year)
              : `${MONTH_NAMES[ym.month - 1]} ${ym.year}`}
        </Text>
        <ChevronRight
          size={16}
          color={colors.accent}
          style={{ transform: [{ rotate: view === 'days' ? '90deg' : '-90deg' }] }}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={view === 'years' ? 'Later years' : 'Next month'}
        disabled={view === 'days' ? !canNext : view === 'months'}
        onPress={() => (view === 'years' ? setYearPage((p) => p + YEARS_PER_PAGE) : go(1))}
        style={[
          styles.arrow,
          { opacity: view === 'months' || (view === 'days' && !canNext) ? 0.3 : 1 },
        ]}
      >
        <ChevronRight size={22} color={colors.textPrimary} />
      </Pressable>
    </View>
  );

  const days = (
    <GestureDetector gesture={swipe}>
      <View>
        <View style={styles.weekRow}>
          {weekdayLabels(weekStartsOn).map((d) => (
            <Text
              key={d}
              variant="caption"
              color="textSecondary"
              align="center"
              style={styles.cell}
            >
              {d.slice(0, 2)}
            </Text>
          ))}
        </View>
        <Animated.View key={`${ym.year}-${ym.month}`} entering={monthAnim} style={styles.grid}>
          {cells.map((c) => {
            const allowed = inRange(c.date, min, max);
            const selected = c.date === value;
            const isToday = c.date === today;
            const state = [
              selected ? 'selected' : null,
              isToday ? 'today' : null,
              allowed ? null : 'not available',
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <Pressable
                key={c.date}
                accessibilityRole="button"
                accessibilityLabel={`${spokenDate(c.date)}${state ? `, ${state}` : ''}`}
                accessibilityState={{ disabled: !allowed, selected }}
                disabled={!allowed}
                onPress={() => pick(c.date)}
                style={styles.cell}
              >
                <Animated.View
                  entering={selected && !reduceMotion ? FadeIn.duration(motion.fast) : undefined}
                  style={[
                    styles.day,
                    selected && { backgroundColor: colors.accent },
                    !selected && isToday && { borderColor: colors.accent, borderWidth: 1.5 },
                  ]}
                >
                  <Text
                    variant="body"
                    align="center"
                    style={{
                      color: selected
                        ? colors.onAccent
                        : isToday
                          ? colors.accent
                          : colors.textPrimary,
                      fontWeight: selected || isToday ? '700' : '400',
                      opacity: !allowed ? 0.25 : c.inMonth ? 1 : 0.45,
                    }}
                  >
                    {c.day}
                  </Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );

  const years = (
    <Animated.View
      key={`y-${yearPage}`}
      entering={reduceMotion ? undefined : FadeIn.duration(motion.fast)}
      style={styles.choiceGrid}
    >
      {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPage + i).map((y) => {
        const allowed = ymKey(y, 12) >= minYm && ymKey(y, 1) <= maxYm;
        const selected = y === ym.year;
        return (
          <Pressable
            key={y}
            accessibilityRole="button"
            accessibilityLabel={`${y}${allowed ? '' : ', not available'}`}
            disabled={!allowed}
            onPress={() => {
              haptics.selection();
              setYm((c) => clampMonth({ year: y, month: c.month }, min, max));
              setView('months');
            }}
            style={[
              styles.choice,
              { borderColor: selected ? colors.accent : colors.border },
              selected && { backgroundColor: colors.successSurface },
              !allowed && { opacity: 0.3 },
            ]}
          >
            <Text variant="bodyStrong" color={selected ? 'accent' : 'textPrimary'}>
              {y}
            </Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );

  const months = (
    <Animated.View
      key={`m-${ym.year}`}
      entering={reduceMotion ? undefined : FadeIn.duration(motion.fast)}
      style={styles.choiceGrid}
    >
      {MONTH_NAMES.map((name, i) => {
        const m = i + 1;
        const allowed = ymKey(ym.year, m) >= minYm && ymKey(ym.year, m) <= maxYm;
        const selected = m === ym.month;
        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={`${name} ${ym.year}${allowed ? '' : ', not available'}`}
            disabled={!allowed}
            onPress={() => {
              haptics.selection();
              setYm({ year: ym.year, month: m });
              setView('days');
            }}
            style={[
              styles.choice,
              { borderColor: selected ? colors.accent : colors.border },
              selected && { backgroundColor: colors.successSurface },
              !allowed && { opacity: 0.3 },
            ]}
          >
            <Text variant="bodyStrong" color={selected ? 'accent' : 'textPrimary'}>
              {name.slice(0, 3)}
            </Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );

  return (
    // Full-screen window, content shown once its size is final (see ModalShell).
    <ModalShell visible={visible} onRequestClose={close} style={styles.backdrop}>
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
              accessibilityLabel="Close calendar"
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
            {header}
            {view === 'days' ? days : view === 'months' ? months : years}
            <View style={styles.actions}>
              {inRange(today, min, max) ? (
                <Button
                  title="Today"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => pick(today)}
                />
              ) : (
                <View />
              )}
              <Button title="Cancel" variant="ghost" fullWidth={false} onPress={close} />
            </View>
          </Animated.View>
        </>
      )}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
  },
  weekRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  choice: {
    width: '31%',
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
});
