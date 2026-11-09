import { CircleCheck, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Card, Screen, SectionHeader, Text } from '@/components/ui';
import { kgToLb, type UnitSystem } from '@/domain/calculations/units';
import { milestoneCatalogue } from '@/domain/milestones/evaluate';
import { useGoalLike, useUnlockedMilestones } from '@/features/milestones/api';
import { useProfile } from '@/features/profile/api';
import { spacing, useTheme } from '@/theme';
import { formatDate } from '@/domain/format';

export default function MilestonesScreen() {
  const { colors } = useTheme();
  const goal = useGoalLike();
  const unlocked = useUnlockedMilestones();
  const { data: profile } = useProfile();
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  if (unlocked.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (unlocked.isError && unlocked.rows.length === 0) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="We couldn't load your milestones."
          onRetry={() => void unlocked.refetch()}
        />
      </Screen>
    );
  }
  const byKey = new Map(unlocked.rows.map((r) => [r.milestone_key, r]));
  const catalogue = milestoneCatalogue(goal);
  // Unlocked milestones from an earlier goal stay visible.
  const extra = unlocked.rows.filter((r) => !catalogue.some((c) => c.key === r.milestone_key));
  const weightLabel = (kg: number) =>
    unit === 'metric' ? `${kg.toFixed(1)} kg` : `${kgToLb(kg).toFixed(1)} lb`;
  const describe = (d: string, threshold: number | null) =>
    threshold !== null && d.startsWith('Your 7-day average')
      ? `Your 7-day average reaches ${weightLabel(threshold)}`
      : d;

  const row = (key: string, title: string, description: string) => {
    const u = byKey.get(key);
    return (
      <Card key={key}>
        <View style={styles.row}>
          {u ? (
            <CircleCheck size={22} color={colors.accent} />
          ) : (
            <Lock size={20} color={colors.textSecondary} />
          )}
          <View style={styles.text}>
            <Text variant="bodyStrong" color={u ? 'textPrimary' : 'textSecondary'}>
              {title}
            </Text>
            <Text variant="small" color="textSecondary">
              {u
                ? `Unlocked ${formatDate(String((u.metadata as { achieved_on?: string } | null)?.achieved_on ?? u.unlocked_at).slice(0, 10))}`
                : description}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const count = catalogue.filter((c) => byKey.has(c.key)).length + extra.length;
  return (
    <Screen edges={['bottom']}>
      <Text color="textSecondary">
        {count} unlocked. Weight milestones use your 7-day average, so a single light morning
        doesn&apos;t count, and they never reward losing weight faster.
      </Text>
      {catalogue.some((c) => c.category === 'weight') ? <SectionHeader title="Weight" /> : null}
      {catalogue
        .filter((c) => c.category === 'weight')
        .map((c) => row(c.key, c.title, describe(c.description, c.threshold)))}
      <SectionHeader title="Training" />
      {catalogue
        .filter((c) => c.category === 'training')
        .map((c) => row(c.key, c.title, c.description))}
      <SectionHeader title="Consistency" />
      {catalogue
        .filter((c) => c.category === 'consistency')
        .map((c) => row(c.key, c.title, c.description))}
      {extra.length ? <SectionHeader title="Earlier goals" /> : null}
      {extra.map((r) => row(r.milestone_key, r.title, r.description ?? ''))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
