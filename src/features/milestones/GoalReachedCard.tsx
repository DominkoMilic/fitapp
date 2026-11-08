import { router } from 'expo-router';
import { PartyPopper } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/feedback';
import { Button, Card, Text } from '@/components/ui';
import { formatWeight, type UnitSystem } from '@/domain/calculations/units';
import { goalReached } from '@/domain/milestones/evaluate';
import { useActiveGoal, useChangeGoal, useProfile } from '@/features/profile/api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { spacing, useTheme } from '@/theme';

import { useGoalLike } from './api';

/** Spec 13.4: celebrate, then offer secondary target / maintenance / new goal. */
export function GoalReachedCard() {
  const { colors } = useTheme();
  const goal = useGoalLike();
  const { data: active } = useActiveGoal();
  const { data: profile } = useProfile();
  const { current, today } = useWeightStats('30D');
  const change = useChangeGoal();
  if (!active || !goalReached(goal, current) || !current) return null;
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  const secondary = goal?.secondaryKg ?? null;
  const currentKg = Math.round(current.kg * 100) / 100;

  return (
    <Card raised>
      <View style={styles.row}>
        <PartyPopper size={28} color={colors.accent} />
        <View style={styles.flex}>
          <Text variant="title">You reached your target!</Text>
          <Text variant="small" color="textSecondary">
            Your 7-day average is {formatWeight(current.kg, unit)}. What&apos;s next?
          </Text>
        </View>
      </View>
      {change.isError ? (
        <Banner tone="danger" message="Couldn't update your goal. Please try again." />
      ) : null}
      {secondary !== null && secondary < current.kg ? (
        <Button
          title={`Go for my secondary target (${formatWeight(secondary, unit)})`}
          loading={change.isPending}
          onPress={() =>
            change.mutate(
              {
                mode: 'update',
                goalId: active.id,
                values: { target_weight_kg: secondary, secondary_target_weight_kg: null },
              },
              { onSuccess: () => router.push('/settings/targets') },
            )
          }
        />
      ) : null}
      <Button
        title="Switch to maintenance"
        variant={secondary !== null && secondary < current.kg ? 'secondary' : 'primary'}
        loading={change.isPending}
        onPress={() =>
          change.mutate(
            {
              mode: 'replace',
              endCurrentAs: 'achieved',
              next: {
                goal_type: 'maintain',
                focus_tags: active.focus_tags,
                starting_weight_kg: currentKg,
                started_at: today,
              },
            },
            { onSuccess: () => router.push('/settings/targets') },
          )
        }
      />
      <Button
        title="Set a new goal"
        variant="ghost"
        onPress={() => router.push('/settings/goal')}
      />
      <Text variant="caption" color="textSecondary">
        Your calorie target doesn&apos;t change until you review and confirm it.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
});
