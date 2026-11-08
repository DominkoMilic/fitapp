import { router } from 'expo-router';
import { Banner, EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Card, ListItem, Screen, SectionHeader, Text } from '@/components/ui';
import { isoWeekday } from '@/domain/calculations/dates';
import { parsePattern } from '@/features/dashboard/today';
import { useToday } from '@/features/dashboard/useToday';
import { WEEKDAY_NAMES } from '@/features/onboarding/constants';
import { useActivePlan, useHealthConditions } from '@/features/profile/api';
import { sportRestricted } from '@/domain/training/injury';
import type { BodyArea, InjuryStatus } from '@/domain/training/injury';
import { useTheme } from '@/theme';

export default function Training() {
  const { colors } = useTheme();
  const { today } = useToday();
  const plan = useActivePlan();
  const health = useHealthConditions();

  if (plan.isPending) {
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  }
  if (plan.isError) {
    return (
      <Screen edges={['top']}>
        <ErrorState message="We couldn't load your plan." onRetry={() => void plan.refetch()} />
      </Screen>
    );
  }
  const days = parsePattern(plan.data?.weekly_pattern);
  const todayWd = isoWeekday(today);
  const restricted = sportRestricted(
    (health.data ?? []).map((h) => ({
      bodyArea: h.body_area as BodyArea | null,
      status: h.status as InjuryStatus,
    })),
  );

  return (
    <Screen edges={['top']}>
      <Text variant="heading" accessibilityRole="header">
        Training
      </Text>
      <Banner
        tone="info"
        message="Workout tracking, the exercise library and the calendar arrive in the next update. Here is the weekly plan PACE generated for you."
      />
      {restricted ? (
        <Banner
          tone="warning"
          message="Your plan is adjusted for a recorded injury. Update its status in Profile → Health."
        />
      ) : null}
      <ListItem
        title="Exercise library"
        subtitle="56 exercises with instructions"
        onPress={() => router.push('/training/exercises')}
      />
      <SectionHeader title={plan.data?.name ?? 'Your week'} />
      {days.length === 0 ? (
        <EmptyState title="No plan yet" message="Your weekly plan will appear here." />
      ) : (
        days.map((d) => (
          <Card
            key={d.weekday}
            style={
              d.weekday === todayWd ? { borderColor: colors.accent, borderWidth: 2 } : undefined
            }
          >
            <Text variant="small" color={d.weekday === todayWd ? 'accent' : 'textSecondary'}>
              {WEEKDAY_NAMES[d.weekday - 1]}
              {d.weekday === todayWd ? ' · Today' : ''}
            </Text>
            <Text variant="bodyStrong">
              {d.title}
              {d.minutes ? ` · ${d.minutes} min` : ''}
            </Text>
            {d.notes.map((n) => (
              <Text key={n} variant="caption" color="textSecondary">
                {n}
              </Text>
            ))}
          </Card>
        ))
      )}
    </Screen>
  );
}
