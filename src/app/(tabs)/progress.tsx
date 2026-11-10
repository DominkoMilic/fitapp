import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { type ReferenceLine, WeightChart } from '@/components/charts/WeightChart';
import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, ListItem, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { kgToLb, type UnitSystem } from '@/domain/calculations/units';
import { changeTone } from '@/domain/weight/tone';
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

  const latest = s.daily.length ? s.daily[s.daily.length - 1]!.kg : null;
  const references: ReferenceLine[] = [];
  if (s.startKg !== null) references.push({ kind: 'start', kg: s.startKg, label: 'Start' });
  if (s.targetKg !== null) references.push({ kind: 'target', kg: s.targetKg, label: 'Target' });

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
        actionLabel="Weight details"
      >
        {s.inRange.length > 1 ? (
          <WeightChart
            daily={s.inRange}
            allDaily={s.daily}
            from={s.rangeFrom}
            to={s.today}
            references={references}
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
      {/* Where you are at a glance: now, the trend, where you began and how far you've come. */}
      <View style={styles.grid}>
        <View style={styles.row}>
          <StatTile label="Current weight" value={fmt(latest)} unit={u} />
          <StatTile
            label="7-day average"
            value={s.current?.basis === 'average' ? fmt(s.current.kg) : '—'}
            unit={u}
            caption={s.current?.basis === 'average' ? undefined : 'Log 3+ days'}
          />
        </View>
        <View style={styles.row}>
          <StatTile label="Start" value={fmt(s.startKg)} unit={u} />
          <StatTile
            label="Total change"
            value={fmt(s.changeSinceStart, true)}
            unit={u}
            trend={changeTone(s.changeSinceStart, s.goal.data?.goal_type)}
          />
        </View>
      </View>
      <Button title="Log weight" onPress={() => router.push('/weight/log')} />
      <SectionHeader title="More" />
      <ListItem title="Weight history" onPress={() => router.push('/progress/weight')} />
      <ListItem title="Body measurements" onPress={() => router.push('/progress/measurements')} />
      <ListItem title="Milestones" onPress={() => router.push('/progress/milestones')} />
      <ListItem title="Weekly report" onPress={() => router.push('/reports')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
});
