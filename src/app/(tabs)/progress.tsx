import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { WeightChart } from '@/components/charts/WeightChart';
import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, ListItem, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { kgToLb, type UnitSystem } from '@/domain/calculations/units';
import { GoalReachedCard } from '@/features/milestones/GoalReachedCard';
import { useProfile } from '@/features/profile/api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { spacing } from '@/theme';

export default function Progress() {
  const s = useWeightStats('30D');
  const { data: profile } = useProfile();
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  const toDisplay = useCallback((kg: number) => (unit === 'metric' ? kg : kgToLb(kg)), [unit]);
  const u = unit === 'metric' ? 'kg' : 'lb';
  const fmt = (kg: number | null, signed = false) =>
    kg === null ? '—' : `${signed && kg > 0 ? '+' : ''}${toDisplay(kg).toFixed(1)}`;

  if (s.weights.isPending || s.goal.isPending)
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  if (s.weights.isError && s.weights.entries.length === 0) {
    return (
      <Screen edges={['top']}>
        <ErrorState
          message="We couldn't load your progress."
          onRetry={() => void s.weights.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Text variant="heading" accessibilityRole="header">
        Progress
      </Text>
      <GoalReachedCard />
      <Card
        onPress={() => router.push('/progress/weight')}
        accessibilityLabel="Open weight details"
      >
        <View style={styles.row}>
          <StatTile
            label={s.current?.basis === 'average' ? '7-day average' : 'Latest weight'}
            value={fmt(s.current?.kg ?? null)}
            unit={u}
          />
          <StatTile
            label="Last 30 days"
            value={fmt(s.change30, true)}
            unit={u}
            caption={s.change30 === null ? 'Not enough data' : undefined}
          />
        </View>
        {s.inRange.length > 1 ? (
          <WeightChart
            daily={s.inRange}
            allDaily={s.daily}
            references={
              s.targetKg !== null ? [{ kind: 'target', kg: s.targetKg, label: 'Target' }] : []
            }
            toDisplay={toDisplay}
            unitLabel={u}
            summary={`Weight over the last 30 days. Current ${fmt(s.current?.kg ?? null)} ${u}.`}
          />
        ) : (
          <Text variant="small" color="textSecondary">
            Log a few morning weigh-ins to see your trend.
          </Text>
        )}
      </Card>
      <Button title="Log weight" onPress={() => router.push('/weight/log')} />
      <SectionHeader title="More" />
      <ListItem title="Weight history" onPress={() => router.push('/progress/weight')} />
      <ListItem title="Body measurements" onPress={() => router.push('/progress/measurements')} />
      <ListItem title="Milestones" onPress={() => router.push('/progress/milestones')} />
      <ListItem title="Weekly report" onPress={() => router.push('/reports')} />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.xs } });
