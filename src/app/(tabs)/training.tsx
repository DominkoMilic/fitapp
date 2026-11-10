import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, LoadingState } from '@/components/feedback';
import { Button, ListItem, Screen, SectionHeader, Text } from '@/components/ui';
import { addDays } from '@/domain/calculations/dates';
import { weekStartOf } from '@/domain/training/records';
import { useToday } from '@/features/dashboard/useToday';
import { useProfile } from '@/features/profile/api';
import { dayLabel } from '@/features/training/labels';
import { useRestrictions } from '@/features/training/library';
import { OccurrenceRow } from '@/features/training/OccurrenceRow';
import { useScheduledWorkouts, useScheduleGeneration } from '@/features/training/schedule-api';
import { ResumeWorkoutCard } from '@/features/training/ResumeWorkoutCard';
import { ResumeActivityCard } from '@/features/activity/ResumeActivityCard';
import { spacing } from '@/theme';
import { EXERCISES } from '@/domain/training/catalogue';
import { formatDateRange } from '@/domain/format';
import { LoadErrorBanner } from '@/components/feedback/LoadErrorBanner';

export default function Training() {
  const { today } = useToday();
  const { data: profile } = useProfile();
  const restrictions = useRestrictions();
  const generation = useScheduleGeneration();
  const [offset, setOffset] = useState(0);
  const weekStart = addDays(weekStartOf(today, profile?.week_start === 7 ? 7 : 1), offset * 7);
  const weekEnd = addDays(weekStart, 6);
  const week = useScheduledWorkouts(weekStart, weekEnd);
  const todays = week.rows.filter((r) => r.scheduled_date === today);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text variant="heading" accessibilityRole="header">
          Training
        </Text>
        <Button
          title="+ Add"
          accessibilityLabel="Add training: record, log or plan"
          fullWidth={false}
          onPress={() => router.push('/training/add')}
        />
      </View>
      <LoadErrorBanner
        visible={week.isError}
        what="your week"
        onRetry={() => void week.refetch()}
      />
      {restrictions.sportRestricted ? (
        <Banner
          tone="warning"
          message="Your plan is adjusted for a recorded injury. Update its status in Profile → Health."
        />
      ) : null}
      {generation.isError && week.rows.length === 0 ? (
        <Banner
          tone="warning"
          message="Couldn't build your calendar. Check your connection and try again."
        />
      ) : null}

      <ResumeWorkoutCard />
      <ResumeActivityCard />
      {offset === 0 ? (
        <>
          <SectionHeader title="Today" />
          {week.isPending ? (
            <LoadingState />
          ) : todays.length ? (
            todays.map((w) => <OccurrenceRow key={w.id} w={w} highlight />)
          ) : (
            <Text color="textSecondary">Nothing planned today.</Text>
          )}
        </>
      ) : null}

      <View style={styles.weekNav}>
        <Button
          title="‹ Prev"
          accessibilityLabel="Previous week"
          variant="ghost"
          fullWidth={false}
          onPress={() => setOffset(offset - 1)}
        />
        <Text variant="bodyStrong">
          {offset === 0
            ? 'This week'
            : formatDateRange(weekStart, weekEnd, undefined, { year: false })}
        </Text>
        <Button
          title="Next ›"
          accessibilityLabel="Next week"
          variant="ghost"
          fullWidth={false}
          onPress={() => setOffset(offset + 1)}
        />
      </View>
      {week.isPending ? (
        <LoadingState />
      ) : week.rows.length === 0 ? (
        <Text color="textSecondary">
          {generation.isPending ? 'Building your calendar…' : 'Nothing scheduled this week.'}
        </Text>
      ) : (
        Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((date) => {
          // Today is already shown above on the current week.
          if (offset === 0 && date === today) return null;
          const items = week.rows.filter((r) => r.scheduled_date === date);
          if (!items.length) return null;
          return (
            <View key={date} style={styles.day}>
              <Text variant="small" color={date === today ? 'accent' : 'textSecondary'}>
                {dayLabel(date, today)}
              </Text>
              {items.map((w) => (
                <OccurrenceRow key={w.id} w={w} />
              ))}
            </View>
          );
        })
      )}

      <SectionHeader title="More" />
      <ListItem
        title="History"
        subtitle="Workouts, games and activities"
        onPress={() => router.push('/training/history')}
      />
      <ListItem title="Personal records" onPress={() => router.push('/training/records')} />
      <ListItem
        title="Exercise library"
        subtitle={`${EXERCISES.length} exercises with instructions`}
        onPress={() => router.push('/training/exercises')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  day: { gap: spacing.xs },
});
