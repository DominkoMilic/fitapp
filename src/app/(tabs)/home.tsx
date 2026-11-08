import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Banner, ErrorState, LoadingState } from '@/components/feedback';
import { Card, ProgressBar, SectionHeader, StatTile, Text } from '@/components/ui';
import { Screen } from '@/components/ui/Screen';
import { isoWeekday } from '@/domain/calculations/dates';
import { formatWeight, type UnitSystem } from '@/domain/calculations/units';
import {
  greetingFor,
  parsePattern,
  targetFor,
  todaysSession,
  upcomingEvents,
} from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import {
  useActiveGoal,
  useActivePlan,
  useProfile,
  useRecurringEvents,
  useTargetHistory,
} from '@/features/profile/api';
import { radius, spacing, useTheme } from '@/theme';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Home() {
  const { colors } = useTheme();
  const { today, hour } = useToday();
  const profile = useProfile();
  const goal = useActiveGoal();
  const targets = useTargetHistory();
  const plan = useActivePlan();
  const events = useRecurringEvents();

  const queries = [profile, goal, targets, plan, events];
  if (queries.some((q) => q.isPending)) {
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  }
  const failed = queries.find((q) => q.isError);
  if (failed) {
    return (
      <Screen edges={['top']}>
        <ErrorState
          message="We couldn't load your dashboard."
          onRetry={() => queries.forEach((q) => void q.refetch())}
        />
      </Screen>
    );
  }

  const unit = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const name = profile.data?.display_name ?? '';
  const target = targetFor(targets.data ?? [], today);
  const session = todaysSession(parsePattern(plan.data?.weekly_pattern), today);
  const upcoming = upcomingEvents(events.data ?? [], today);
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View
          style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}
          accessibilityElementsHidden
        >
          <Text variant="title" color="accent">
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="heading" accessibilityRole="header">
            {greetingFor(hour)}, {name}
          </Text>
          <Text variant="small" color="textSecondary">
            {dateLabel}
          </Text>
        </View>
      </View>

      {goal.data ? (
        <View style={styles.row}>
          <StatTile
            label="Starting weight"
            value={formatWeight(Number(goal.data.starting_weight_kg), unit).split(' ')[0] ?? ''}
            unit={unit === 'metric' ? 'kg' : 'lb'}
            caption="Weight logging arrives next"
          />
          {goal.data.target_weight_kg !== null ? (
            <StatTile
              label="Goal"
              value={formatWeight(Number(goal.data.target_weight_kg), unit).split(' ')[0] ?? ''}
              unit={unit === 'metric' ? 'kg' : 'lb'}
            />
          ) : null}
        </View>
      ) : null}

      <SectionHeader title="Today" />
      <Card
        onPress={() => router.push('/training')}
        accessibilityLabel={`Today's plan: ${session?.title ?? 'none'}`}
      >
        <Text variant="small" color="textSecondary">
          Today&apos;s plan
        </Text>
        <Text variant="title">{session ? session.title : 'No plan for today'}</Text>
        {session && session.minutes ? (
          <Text variant="small" color="textSecondary">
            {session.minutes} min · {session.intensity}
          </Text>
        ) : null}
        {session?.notes.map((n) => (
          <Text key={n} variant="caption" color="textSecondary">
            {n}
          </Text>
        ))}
      </Card>

      <SectionHeader title="Nutrition targets" />
      {target ? (
        <Card>
          <ProgressBar label="Calories" value={null} max={target.kcal} unit="kcal" />
          <ProgressBar label="Protein" value={null} max={target.protein_g} unit="g" />
          <ProgressBar label="Carbs" value={null} max={target.carbs_g} unit="g" />
          <ProgressBar label="Fat" value={null} max={target.fat_g} unit="g" />
          {target.water_ml ? (
            <ProgressBar label="Water" value={null} max={target.water_ml} unit="ml" />
          ) : null}
          <Text variant="caption" color="textSecondary">
            Food and water logging arrive in a later update, so intake shows as no data, not zero.
          </Text>
        </Card>
      ) : (
        <Banner tone="info" message="No nutrition targets yet." />
      )}

      <SectionHeader title="Coming up" />
      {upcoming.length ? (
        upcoming.map((e) => (
          <Card key={`${e.date}-${e.title}`}>
            <Text variant="bodyStrong">{e.title}</Text>
            <Text variant="small" color="textSecondary">
              {e.date === today ? 'Today' : WEEKDAY_SHORT[isoWeekday(e.date) - 1]} · {e.localTime}
            </Text>
          </Card>
        ))
      ) : (
        <Text color="textSecondary">No matches or practices this week.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
});
