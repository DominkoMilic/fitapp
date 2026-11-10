import { router } from 'expo-router';
import { ClipboardCheck, Scale } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner, ErrorState, LoadingState } from '@/components/feedback';
import { Card, ProgressBar, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { isoWeekday } from '@/domain/calculations/dates';
import { formatWeight, kgToLb, type UnitSystem } from '@/domain/calculations/units';
import { useCheckins } from '@/features/checkin/api';
import { useNutritionDay } from '@/features/nutrition/useNutritionDay';
import { useFeatures } from '@/features/profile/features';
import {
  greetingFor,
  parsePattern,
  targetFor,
  nextEvent,
  todaysSession,
  upcomingEvents,
} from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { CoachCards } from '@/features/coach/CoachCards';
import { GoalReachedCard } from '@/features/milestones/GoalReachedCard';
import {
  useActivePlan,
  useProfile,
  useRecurringEvents,
  useTargetHistory,
} from '@/features/profile/api';
import { SyncBanner } from '@/features/sync/SyncBanner';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { ResumeWorkoutCard } from '@/features/training/ResumeWorkoutCard';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';
import { intensityLabel } from '@/domain/format';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function QuickAction({
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quick,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {icon}
      <Text variant="caption" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const { today, hour } = useToday();
  const profile = useProfile();
  const targets = useTargetHistory();
  const plan = useActivePlan();
  const events = useRecurringEvents();
  const stats = useWeightStats('30D');
  const checkins = useCheckins();
  const food = useNutritionDay(today);
  const features = useFeatures();

  const queries = [profile, targets, plan, events, stats.goal];
  if (queries.some((q) => q.isPending))
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  if (queries.some((q) => q.isError)) {
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
  const u = unit === 'metric' ? 'kg' : 'lb';
  const disp = (kg: number) => (unit === 'metric' ? kg : kgToLb(kg));
  const name = profile.data?.display_name ?? '';
  const target = targetFor(targets.data ?? [], today);
  const session = todaysSession(parsePattern(plan.data?.weekly_pattern), today);
  const upcoming = upcomingEvents(events.data ?? [], today);
  const checkedInToday = checkins.rows.some((c) => c.local_date === today);
  const next = nextEvent(upcoming, today, session?.title ?? null);
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

      <ResumeWorkoutCard />
      <SyncBanner />
      <GoalReachedCard />
      <CoachCards />

      <View style={styles.row}>
        <QuickAction
          label="Log weight"
          icon={<Scale size={22} color={colors.accent} />}
          onPress={() => router.push('/weight/log')}
        />
        <QuickAction
          label="Check-in"
          icon={<ClipboardCheck size={22} color={colors.accent} />}
          onPress={() => router.push('/check-in')}
        />
      </View>

      <Card onPress={() => router.push('/progress/weight')} accessibilityLabel="Weight details">
        <View style={styles.row}>
          <StatTile
            label={stats.current?.basis === 'average' ? 'Weight (7-day avg)' : 'Latest weight'}
            value={stats.current ? disp(stats.current.kg).toFixed(1) : '—'}
            unit={u}
            caption={
              stats.change7 !== null
                ? `${stats.change7 > 0 ? '+' : ''}${disp(stats.change7).toFixed(1)} ${u} this week`
                : stats.current?.basis === 'single'
                  ? 'Log 3+ days for an average'
                  : undefined
            }
          />
          {stats.targetKg !== null ? (
            <StatTile label="Goal" value={disp(stats.targetKg).toFixed(1)} unit={u} />
          ) : null}
        </View>
        {stats.progressPct !== null ? (
          <ProgressBar
            label="Goal progress"
            value={Math.round(stats.progressPct)}
            max={100}
            unit="%"
          />
        ) : null}
      </Card>

      {!checkedInToday && checkins.isSuccess ? (
        <Card onPress={() => router.push('/check-in')} accessibilityLabel="Do today's check-in">
          <Text variant="bodyStrong">How are you feeling today?</Text>
          <Text variant="small" color="textSecondary">
            A 20-second check-in: sleep, tiredness, soreness, pain.
          </Text>
        </Card>
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
            {session.minutes} min · {intensityLabel(session.intensity)}
          </Text>
        ) : null}
        {session?.notes.map((n) => (
          <Text key={n} variant="caption" color="textSecondary">
            {n}
          </Text>
        ))}
        {next ? (
          <Text variant="small" color="textSecondary">
            Next: {next.title} ·{' '}
            {next.date === today ? 'today' : WEEKDAY_SHORT[isoWeekday(next.date) - 1]}{' '}
            {next.localTime}
          </Text>
        ) : null}
      </Card>

      {features.nutrition ? (
        <>
          <SectionHeader title="Today's nutrition" />
          {target ? (
            <Card onPress={() => router.push('/nutrition')} accessibilityLabel="Open nutrition">
              <ProgressBar
                label="Calories"
                value={food.hasData ? food.totals.kcal : null}
                max={target.kcal}
                unit="kcal"
              />
              <ProgressBar
                label="Protein"
                value={food.hasData ? food.totals.protein_g : null}
                max={target.protein_g}
                unit="g"
              />
              <ProgressBar
                label="Carbs"
                value={food.hasData ? food.totals.carbs_g : null}
                max={target.carbs_g}
                unit="g"
              />
              <ProgressBar
                label="Fat"
                value={food.hasData ? food.totals.fat_g : null}
                max={target.fat_g}
                unit="g"
              />
              {target.water_ml ? (
                <ProgressBar
                  label="Water"
                  value={food.waterMl ? food.waterMl : null}
                  max={target.water_ml}
                  unit="ml"
                />
              ) : null}
              {!food.hasData ? (
                <Text variant="caption" color="textSecondary">
                  Nothing logged yet today. Tap to add your first meal.
                </Text>
              ) : null}
            </Card>
          ) : (
            <Banner tone="info" message="No nutrition targets yet." />
          )}
        </>
      ) : null}

      {stats.startKg !== null && stats.current ? (
        <Text variant="caption" color="textSecondary">
          Started at {formatWeight(stats.startKg, unit)}.
        </Text>
      ) : null}
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
  row: { flexDirection: 'row', gap: spacing.xs },
  quick: {
    flex: 1,
    minHeight: TOUCH_TARGET + 28,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    padding: spacing.xs,
  },
});
