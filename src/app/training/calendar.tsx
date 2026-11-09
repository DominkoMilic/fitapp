import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LoadingState } from '@/components/feedback';
import { Button, Screen, SectionHeader, Text } from '@/components/ui';
import { addDays, isoWeekday } from '@/domain/calculations/dates';
import { useToday } from '@/features/dashboard/useToday';
import { dayLabel, WEEKDAY_SHORT } from '@/features/training/labels';
import { OccurrenceRow } from '@/features/training/OccurrenceRow';
import { useScheduledWorkouts } from '@/features/training/schedule-api';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';
import { LoadErrorBanner } from '@/components/feedback/LoadErrorBanner';

const monthStart = (date: string, offset: number) => {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1 + offset, 1));
  return d.toISOString().slice(0, 10);
};

export default function MonthCalendar() {
  const { colors } = useTheme();
  const { today } = useToday();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const first = monthStart(today, offset);
  const nextFirst = monthStart(today, offset + 1);
  const gridStart = addDays(first, -(isoWeekday(first) - 1));
  const { rows, isPending, isError, refetch } = useScheduledWorkouts(
    gridStart,
    addDays(gridStart, 41),
  );
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const title = new Date(`${first}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Screen edges={['bottom']}>
      <LoadErrorBanner visible={isError} what="your calendar" onRetry={() => void refetch()} />
      <View style={styles.nav}>
        <Button
          title="‹"
          variant="ghost"
          fullWidth={false}
          onPress={() => setOffset(offset - 1)}
          accessibilityLabel="Previous month"
        />
        <Text variant="title">{title}</Text>
        <Button
          title="›"
          variant="ghost"
          fullWidth={false}
          onPress={() => setOffset(offset + 1)}
          accessibilityLabel="Next month"
        />
      </View>
      <View style={styles.grid}>
        {WEEKDAY_SHORT.map((d) => (
          <Text key={d} variant="caption" color="textSecondary" align="center" style={styles.cellW}>
            {d}
          </Text>
        ))}
        {cells.map((date) => {
          const items = rows.filter((r) => r.scheduled_date === date && r.kind !== 'rest');
          const inMonth = date >= first && date < nextFirst;
          const isSel = date === selected;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(date, today)}: ${items.length ? items.map((i) => i.title).join(', ') : 'nothing planned'}`}
              onPress={() => setSelected(date)}
              style={[
                styles.cell,
                styles.cellW,
                { borderColor: isSel ? colors.accent : 'transparent', opacity: inMonth ? 1 : 0.4 },
              ]}
            >
              <Text variant="small" color={date === today ? 'accent' : 'textPrimary'}>
                {Number(date.slice(8, 10))}
              </Text>
              <View style={styles.dots}>
                {items.slice(0, 3).map((i) => (
                  <View
                    key={i.id}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i.status === 'completed'
                            ? colors.accent
                            : i.kind === 'commitment'
                              ? colors.warning
                              : i.status === 'skipped'
                                ? colors.border
                                : colors.info,
                      },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" color="textSecondary">
        Green: done · Blue: planned · Orange: your sport or a fixed activity
      </Text>
      <SectionHeader title={dayLabel(selected, today)} />
      {isPending ? (
        <LoadingState />
      ) : rows.filter((r) => r.scheduled_date === selected).length ? (
        rows
          .filter((r) => r.scheduled_date === selected)
          .map((w) => <OccurrenceRow key={w.id} w={w} />)
      ) : (
        <Text color="textSecondary">Nothing planned.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellW: { width: `${100 / 7}%` },
  cell: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    paddingVertical: spacing.xxs,
    borderWidth: 1.5,
    borderRadius: radius.input,
  },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
