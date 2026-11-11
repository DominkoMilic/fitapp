import { router } from 'expo-router';
import { ChevronRight, Dumbbell, Scale } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Card, ProgressBar, Screen, SectionHeader, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { isoWeekday } from '@/domain/calculations/dates';
import { formatWeight, kgToLb, type UnitSystem } from '@/domain/calculations/units';
import { useCheckins } from '@/features/checkin/api';
import {
  greetingFor,
  parsePattern,
  nextEvent,
  todaysSession,
  upcomingEvents,
} from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { CoachCards } from '@/features/coach/CoachCards';
import { GoalReachedCard } from '@/features/milestones/GoalReachedCard';
import { useActivePlan, useProfile, useRecurringEvents } from '@/features/profile/api';
import { SyncBanner } from '@/features/sync/SyncBanner';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { ResumeWorkoutCard } from '@/features/training/ResumeWorkoutCard';
import { useActiveWorkout } from '@/features/training/active-workout-store';
import { useScheduledWorkouts, useScheduleGeneration } from '@/features/training/schedule-api';
import { useAuth } from '@/features/auth/AuthProvider';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';
import { formatLongWeekday, intensityLabel } from '@/domain/format';
import { goalJourney } from '@/domain/weight/tone';

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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="light"
      onPress={onPress}
      style={[styles.quick, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.successSurface }]}>{icon}</View>
      <Text variant="small" align="center" style={styles.quickLabel}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** One labelled number in the Start · Now · Goal row. */
function Figure({
  label,
  value,
  unit,
  disp,
  strong,
  note,
}: {
  label: string;
  value: number | null;
  unit: string;
  disp: (kg: number) => number;
  strong?: boolean;
  /** Shown after the unit, e.g. "7-day avg". */
  note?: string;
}) {
  return (
    <View
      style={styles.figure}
      accessible
      accessibilityLabel={`${label}: ${value === null ? 'no data' : `${disp(value).toFixed(1)} ${unit}`}`}
    >
      <Text variant="small" color="textSecondary" numberOfLines={1}>
        {label}
      </Text>
      <Text
        variant={strong ? 'display' : 'title'}
        numeric
        color={strong ? 'textPrimary' : 'textSecondary'}
      >
        {value === null ? '—' : disp(value).toFixed(1)}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {note ? `${unit} · ${note}` : unit}
      </Text>
    </View>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const { today, hour } = useToday();
  const profile = useProfile();
  const plan = useActivePlan();
  const events = useRecurringEvents();
  const stats = useWeightStats('30D');
  const checkins = useCheckins();
  const active = useActiveWorkout(useAuth().session?.user.id);
  // Builds the calendar here too (once a day), so "Start workout" knows today's session
  // without visiting Training first.
  useScheduleGeneration();
  const todayRows = useScheduledWorkouts(today, today).rows;

  const queries = [profile, plan, events, stats.goal];
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
  const session = todaysSession(parsePattern(plan.data?.weekly_pattern), today);
  const upcoming = upcomingEvents(events.data ?? [], today);
  const checkedInToday = checkins.rows.some((c) => c.local_date === today);
  const next = nextEvent(upcoming, today, session?.title ?? null);
  const journey =
    stats.startKg !== null && stats.current
      ? goalJourney(stats.startKg, stats.current.kg, stats.targetKg)
      : null;
  const dateLabel = formatLongWeekday(today);
  // Quick log: resume a workout in progress, start today's planned one, or log one done earlier.
  const planned = todayRows.find(
    (r) => r.status === 'planned' && (r.kind === 'workout' || r.kind === 'recovery'),
  );
  const workoutAction = active
    ? { label: 'Resume workout', go: () => router.push('/training/session') }
    : planned
      ? {
          label: 'Start workout',
          go: () => router.push({ pathname: '/training/workout/[id]', params: { id: planned.id } }),
        }
      : { label: 'Log workout', go: () => router.push('/training/log-workout') };

  return (
    <Screen edges={['top']}>
      {/* Tapping your name opens your profile. */}
      <PressableScale
        feedback="row"
        accessibilityRole="button"
        accessibilityLabel={`${greetingFor(hour)}, ${name}. ${dateLabel}`}
        accessibilityHint="Opens your profile"
        onPress={() => router.push('/profile')}
        style={styles.header}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.successSurface, borderColor: colors.accent },
          ]}
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
        <ChevronRight size={20} color={colors.textSecondary} />
      </PressableScale>

      <ResumeWorkoutCard />
      <SyncBanner />
      <GoalReachedCard />
      <CoachCards />

      <SectionHeader title="Your progress" />
      <Card
        onPress={() => router.push('/progress/weight')}
        accessibilityLabel="Weight details"
        actionLabel="Weight details"
      >
        {/* Where you started, where you are, where you're going. */}
        <View style={styles.journey}>
          <Figure label="Start" value={stats.startKg} unit={u} disp={disp} />
          <Figure
            label="Now"
            note={stats.current?.basis === 'average' ? '7-day avg' : undefined}
            value={stats.current?.kg ?? null}
            unit={u}
            disp={disp}
            strong
          />
          {stats.targetKg !== null ? (
            <Figure label="Goal" value={stats.targetKg} unit={u} disp={disp} />
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
        {journey ? (
          <Text variant="small" color="textSecondary">
            {`${disp(journey.moved).toFixed(1)} ${u} ${journey.direction}`}
            {journey.toGo !== null ? ` · ${disp(journey.toGo).toFixed(1)} ${u} to go` : ''}
          </Text>
        ) : stats.current?.basis === 'single' ? (
          <Text variant="small" color="textSecondary">
            Log 3+ days for an average
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="Quick log" />
      <View style={styles.row}>
        <QuickAction
          label="Log weight"
          icon={<Scale size={22} color={colors.accent} />}
          onPress={() => router.push('/weight/log')}
        />
        <QuickAction
          label={workoutAction.label}
          icon={<Dumbbell size={22} color={colors.accent} />}
          onPress={workoutAction.go}
        />
      </View>

      {!checkedInToday && checkins.isSuccess ? (
        <>
          <SectionHeader title="Daily check-in" />
          <Card
            onPress={() => router.push('/check-in')}
            accessibilityLabel="Do today's check-in"
            actionLabel="Start check-in"
          >
            <Text variant="bodyStrong">How are you feeling today?</Text>
            <Text variant="small" color="textSecondary">
              A 20-second check-in: sleep, tiredness, soreness, pain.
            </Text>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Today" />
      <Card
        onPress={() => router.push('/training')}
        accessibilityLabel={`Today's plan: ${session?.title ?? 'none'}`}
        actionLabel="Open training"
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.xs },
  journey: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  figure: { alignItems: 'center', flex: 1, gap: 2 },
  quick: {
    flex: 1,
    minHeight: TOUCH_TARGET + 28,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontWeight: '600' },
});
