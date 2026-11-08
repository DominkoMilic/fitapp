import { router } from 'expo-router';
import { Activity, ClipboardCheck, Ruler, Scale } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner, ErrorState, LoadingState } from '@/components/feedback';
import { Card, ProgressBar, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { isoWeekday } from '@/domain/calculations/dates';
import { formatWeight, kgToLb, type UnitSystem } from '@/domain/calculations/units';
import { useCheckins } from '@/features/checkin/api';
import {
  greetingFor,
  parsePattern,
  targetFor,
  todaysSession,
  upcomingEvents,
} from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { useUnlockedMilestones } from '@/features/milestones/api';
import { GoalReachedCard } from '@/features/milestones/GoalReachedCard';
import {
  useActivePlan,
  useProfile,
  useRecurringEvents,
  useTargetHistory,
} from '@/features/profile/api';
import { SyncBanner } from '@/features/sync/SyncBanner';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

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
  const milestones = useUnlockedMilestones();

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
  const recent = milestones.rows.slice(0, 3);
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

      <SyncBanner />
      <GoalReachedCard />

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
        <QuickAction
          label="Measure"
          icon={<Ruler size={22} color={colors.accent} />}
          onPress={() => router.push('/measurements/log')}
        />
        <QuickAction
          label="Progress"
          icon={<Activity size={22} color={colors.accent} />}
          onPress={() => router.push('/progress/weight')}
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

      {recent.length ? (
        <>
          <SectionHeader title="Recent milestones" />
          <Card
            onPress={() => router.push('/progress/milestones')}
            accessibilityLabel="All milestones"
          >
            {recent.map((m) => (
              <Text key={m.milestone_key} variant="small">
                🏅 {m.title}
              </Text>
            ))}
          </Card>
        </>
      ) : null}

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
