import { router } from 'expo-router';
import { BookOpen, History, Plus, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, LoadingState } from '@/components/feedback';
import { LoadErrorBanner } from '@/components/feedback/LoadErrorBanner';
import { Screen, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { addDays } from '@/domain/calculations/dates';
import { formatDateRange, formatLongWeekday } from '@/domain/format';
import { weekStartOf } from '@/domain/training/records';
import { dayMarks, defaultDay } from '@/domain/training/week-strip';
import { ResumeActivityCard } from '@/features/activity/ResumeActivityCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToday } from '@/features/dashboard/useToday';
import { useProfile } from '@/features/profile/api';
import { useActiveWorkout } from '@/features/training/active-workout-store';
import { useRestrictions } from '@/features/training/library';
import { OccurrenceRow } from '@/features/training/OccurrenceRow';
import { ResumeWorkoutCard } from '@/features/training/ResumeWorkoutCard';
import { useScheduledWorkouts, useScheduleGeneration } from '@/features/training/schedule-api';
import { WeekStrip } from '@/features/training/WeekStrip';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

/**
 * Training tab (redesign 2026-11-21): a week strip on top, then only the selected day's sessions,
 * so the screen stays calm. Anything in progress sits above the strip in amber.
 */
export default function Training() {
  const { colors } = useTheme();
  const { today } = useToday();
  const { data: profile } = useProfile();
  const restrictions = useRestrictions();
  const generation = useScheduleGeneration();
  const active = useActiveWorkout(useAuth().session?.user.id);
  const [offset, setOffset] = useState(0);
  const weekStart = addDays(weekStartOf(today, profile?.week_start === 7 ? 7 : 1), offset * 7);
  const weekEnd = addDays(weekStart, 6);
  const [picked, setPicked] = useState<string | null>(null);
  // A day picked in another week doesn't carry over: each week opens on today or its first day.
  const selected =
    picked && picked >= weekStart && picked <= weekEnd ? picked : defaultDay(weekStart, today);
  const week = useScheduledWorkouts(weekStart, weekEnd);
  const days = dayMarks(weekStart, week.rows, active?.scheduledId ?? null);
  const items = week.rows.filter((r) => r.scheduled_date === selected);
  const changeWeek = (delta: number) => {
    setOffset(offset + delta);
    setPicked(null);
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text variant="heading" accessibilityRole="header">
          Training
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Add training: record, log or plan"
          onPress={() => router.push('/training/add')}
          style={[styles.add, { backgroundColor: colors.accent }]}
        >
          <Plus size={24} color={colors.onAccent} strokeWidth={2.5} />
        </PressableScale>
      </View>
      <LoadErrorBanner
        visible={week.isError}
        what="your week"
        onRetry={() => void week.refetch()}
      />
      {restrictions.sportRestricted ? (
        <Banner
          tone="warning"
          message="Your plan is adjusted for an injury. Tap to review it in Health."
          accessibilityHint="Opens Health and injuries"
          onPress={() => router.push('/settings/health')}
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

      <WeekStrip
        days={days}
        today={today}
        selected={selected}
        onSelect={setPicked}
        onPrev={() => changeWeek(-1)}
        onNext={() => changeWeek(1)}
        title={
          offset === 0
            ? 'This week'
            : formatDateRange(weekStart, weekEnd, undefined, { year: false })
        }
      />

      <View style={styles.day}>
        <Text variant="title" accessibilityRole="header">
          {formatLongWeekday(selected)}
          {selected === today ? ' · today' : ''}
        </Text>
        {week.isPending ? (
          <LoadingState />
        ) : items.length ? (
          items.map((w) => <OccurrenceRow key={w.id} w={w} highlight={selected === today} />)
        ) : (
          <Text color="textSecondary">
            {generation.isPending ? 'Building your calendar…' : 'Nothing planned.'}
          </Text>
        )}
      </View>

      <View style={styles.tiles}>
        <Tile
          label="History"
          icon={<History size={22} color={colors.accent} />}
          onPress={() => router.push('/training/history')}
        />
        <Tile
          label="Records"
          icon={<Trophy size={22} color={colors.accent} />}
          onPress={() => router.push('/training/records')}
        />
        <Tile
          label="Library"
          icon={<BookOpen size={22} color={colors.accent} />}
          onPress={() => router.push('/training/exercises')}
        />
      </View>
    </Screen>
  );
}

function Tile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {icon}
      <Text variant="small" style={styles.tileLabel}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  add: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: { gap: spacing.sm, marginTop: spacing.xs },
  tiles: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  tile: {
    flex: 1,
    minHeight: TOUCH_TARGET + 28,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  tileLabel: { fontWeight: '600' },
});
