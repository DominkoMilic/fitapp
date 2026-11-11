import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { isoWeekday } from '@/domain/calculations/dates';
import { formatLongWeekday } from '@/domain/format';
import type { DayMark } from '@/domain/training/week-strip';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

const LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SPOKEN: Record<DayMark, string> = {
  none: 'nothing planned',
  rest: 'rest day',
  planned: 'planned',
  done: 'done',
  skipped: 'skipped',
  progress: 'workout in progress',
};

/**
 * The Training week at a glance: one pill per day with a mark (planned, done, in progress,
 * skipped). Tapping a day shows only that day below; the arrows change week.
 */
export function WeekStrip({
  days,
  today,
  selected,
  onSelect,
  onPrev,
  onNext,
  title,
}: {
  days: { date: string; mark: DayMark }[];
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  title: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          onPress={onPrev}
          hitSlop={8}
          style={styles.arrow}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <Text variant="bodyStrong" accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          onPress={onNext}
          hitSlop={8}
          style={styles.arrow}
        >
          <ChevronRight size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.row} accessibilityRole="tablist">
        {days.map(({ date, mark }) => {
          const isSelected = date === selected;
          const isToday = date === today;
          return (
            <PressableScale
              key={date}
              haptic={isSelected ? null : 'selection'}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${formatLongWeekday(date)}${isToday ? ', today' : ''}, ${SPOKEN[mark]}`}
              onPress={() => onSelect(date)}
              style={[
                styles.day,
                {
                  backgroundColor: isSelected ? colors.accent : colors.surface,
                  borderColor: isToday ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                variant="caption"
                style={{ color: isSelected ? colors.onAccent : colors.textSecondary }}
              >
                {LETTER[isoWeekday(date) - 1]}
              </Text>
              <Text
                variant="bodyStrong"
                style={{ color: isSelected ? colors.onAccent : colors.textPrimary }}
              >
                {Number(date.slice(8, 10))}
              </Text>
              <Mark mark={mark} onAccent={isSelected} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function Mark({ mark, onAccent }: { mark: DayMark; onAccent: boolean }) {
  const { colors } = useTheme();
  const ink = onAccent ? colors.onAccent : colors.accent;
  if (mark === 'done') return <Check size={12} color={ink} strokeWidth={3} />;
  const style =
    mark === 'progress'
      ? { backgroundColor: colors.warning }
      : mark === 'planned'
        ? { backgroundColor: ink }
        : mark === 'skipped'
          ? { backgroundColor: onAccent ? colors.onAccent : colors.textSecondary, opacity: 0.5 }
          : mark === 'rest'
            ? { borderWidth: 1, borderColor: onAccent ? colors.onAccent : colors.textSecondary }
            : null;
  return <View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.xxs },
  day: {
    flex: 1,
    minHeight: TOUCH_TARGET + 24,
    borderRadius: radius.input,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 3 },
});
