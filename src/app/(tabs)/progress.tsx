import { router } from 'expo-router';
import { CalendarCheck, History, Ruler, Trophy } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { type ReferenceLine, WeightChart } from '@/components/charts/WeightChart';
import { ErrorState, LoadingState } from '@/components/feedback';
import { Card, HeaderAddButton, MiniStat, Screen, Text, Tile } from '@/components/ui';
import { kgToLb, type UnitSystem } from '@/domain/calculations/units';
import { weighedWhen } from '@/domain/format';
import { changeTone } from '@/domain/weight/tone';
import { GoalReachedCard } from '@/features/milestones/GoalReachedCard';
import { useProfile } from '@/features/profile/api';
import { useWeightStats } from '@/features/weight/useWeightStats';
import { spacing, useTheme } from '@/theme';

/**
 * Progress tab (polish 2026-11-23, same language as Home and Training): a "+" to log weight, the
 * 30-day chart, the key figures in one compact card, and tiles for everything else.
 */
export default function Progress() {
  const { colors } = useTheme();
  const s = useWeightStats('30D');
  const { data: profile } = useProfile();
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  const toDisplay = useCallback((kg: number) => (unit === 'metric' ? kg : kgToLb(kg)), [unit]);
  const u = unit === 'metric' ? 'kg' : 'lb';
  const fmt = (kg: number | null, signed = false) =>
    kg === null ? '—' : `${signed && kg > 0 ? '+' : ''}${toDisplay(kg).toFixed(1)}`;

  const latest = s.daily.length ? s.daily[s.daily.length - 1]! : null;
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
      <View style={styles.header}>
        <Text variant="heading" accessibilityRole="header">
          Progress
        </Text>
        <HeaderAddButton
          accessibilityLabel="Log weight"
          onPress={() => router.push('/weight/log')}
        />
      </View>
      <GoalReachedCard />

      <Card
        onPress={() => router.push('/progress/weight')}
        accessibilityLabel="Open weight details"
        actionLabel="Weight details"
      >
        <View style={styles.chartHead}>
          <Text variant="small" color="textSecondary">
            Weight · last 30 days
          </Text>
          {latest ? (
            <Text variant="small" color="textSecondary">
              <Text variant="bodyStrong" numeric>
                {fmt(latest.kg)} {u}
              </Text>
              {` · ${weighedWhen(latest.date, s.today)}`}
            </Text>
          ) : null}
        </View>
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

      {/* Where you are at a glance, in one card instead of four large tiles. */}
      <Card>
        <View style={styles.row}>
          <MiniStat label="Current weight" value={fmt(latest?.kg ?? null)} unit={u} />
          <MiniStat
            label="7-day average"
            value={s.current?.basis === 'average' ? fmt(s.current.kg) : '—'}
            unit={u}
            caption={s.current?.basis === 'average' ? undefined : 'Log 3+ days'}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <MiniStat label="Start" value={fmt(s.startKg)} unit={u} />
          <MiniStat
            label="Total change"
            value={fmt(s.changeSinceStart, true)}
            unit={u}
            trend={changeTone(s.changeSinceStart, s.goal.data?.goal_type)}
          />
        </View>
      </Card>

      <View style={styles.tiles}>
        <View style={styles.tileRow}>
          <Tile
            label="Weight history"
            icon={<History size={22} color={colors.accent} />}
            onPress={() => router.push('/progress/weight')}
          />
          <Tile
            label="Measurements"
            icon={<Ruler size={22} color={colors.accent} />}
            onPress={() => router.push('/progress/measurements')}
          />
        </View>
        <View style={styles.tileRow}>
          <Tile
            label="Milestones"
            icon={<Trophy size={22} color={colors.accent} />}
            onPress={() => router.push('/progress/milestones')}
          />
          <Tile
            label="Weekly report"
            icon={<CalendarCheck size={22} color={colors.accent} />}
            onPress={() => router.push('/reports')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
  tiles: { gap: spacing.xs, marginTop: spacing.xs },
  tileRow: { flexDirection: 'row', gap: spacing.xs },
});
