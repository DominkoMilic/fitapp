import { ChartLine } from 'lucide-react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Card, Screen, SectionHeader, Text } from '@/components/ui';
import { formatWeight, type UnitSystem } from '@/domain/calculations/units';
import { weightMilestones } from '@/domain/milestones/weight-milestones';
import { useActiveGoal, useProfile } from '@/features/profile/api';
import { useTheme } from '@/theme';

export default function Progress() {
  const { colors } = useTheme();
  const goal = useActiveGoal();
  const profile = useProfile();
  if (goal.isPending) {
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  }
  if (goal.isError) {
    return (
      <Screen edges={['top']}>
        <ErrorState message="We couldn't load your goal." onRetry={() => void goal.refetch()} />
      </Screen>
    );
  }
  const unit = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const g = goal.data;
  const milestones =
    g && g.goal_type === 'lose_weight' && g.target_weight_kg !== null
      ? weightMilestones({
          startKg: Number(g.starting_weight_kg),
          targetKg: Number(g.target_weight_kg),
          secondaryTargetKg:
            g.secondary_target_weight_kg === null ? null : Number(g.secondary_target_weight_kg),
        })
      : [];
  return (
    <Screen edges={['top']}>
      <Text variant="heading" accessibilityRole="header">
        Progress
      </Text>
      <EmptyState
        icon={<ChartLine size={36} color={colors.textSecondary} />}
        title="Weight tracking is next"
        message={`Daily weigh-ins, the 7-day trend chart and measurements arrive in the next update. You started at ${
          g ? formatWeight(Number(g.starting_weight_kg), unit) : '—'
        }.`}
      />
      {milestones.length ? (
        <>
          <SectionHeader title="Milestones ahead" />
          <Card>
            {milestones.map((m) => (
              <Text key={m.key} variant="small">
                ○ {m.title}
              </Text>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
