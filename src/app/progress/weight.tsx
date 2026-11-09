import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { WeightChart, type ReferenceLine } from '@/components/charts/WeightChart';
import { Banner, EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import {
  Button,
  Card,
  ListItem,
  ListScreen,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatTile,
  Text,
} from '@/components/ui';
import { kgToLb, type UnitSystem } from '@/domain/calculations/units';
import { useProfile } from '@/features/profile/api';
import { RANGE_DAYS, type RangeKey, useWeightStats } from '@/features/weight/useWeightStats';
import { spacing } from '@/theme';
import { formatDate } from '@/domain/format';

const monthYear = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

export default function WeightScreen() {
  const [range, setRange] = useState<RangeKey>('30D');
  const s = useWeightStats(range);
  const { data: profile } = useProfile();
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  const toDisplay = useCallback((kg: number) => (unit === 'metric' ? kg : kgToLb(kg)), [unit]);
  const u = unit === 'metric' ? 'kg' : 'lb';
  const fmt = (kg: number | null, signed = false) =>
    kg === null ? '—' : `${signed && kg > 0 ? '+' : ''}${toDisplay(kg).toFixed(1)}`;

  if (s.weights.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (s.weights.isError && s.weights.entries.length === 0) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="We couldn't load your weights."
          onRetry={() => void s.weights.refetch()}
        />
      </Screen>
    );
  }

  const refs: ReferenceLine[] = [];
  if (s.startKg !== null) refs.push({ kind: 'start', kg: s.startKg, label: 'Start' });
  if (s.targetKg !== null) refs.push({ kind: 'target', kg: s.targetKg, label: 'Target' });
  if (s.secondaryKg !== null)
    refs.push({ kind: 'secondary', kg: s.secondaryKg, label: '2nd target' });

  const summary = s.current
    ? `Weight chart, ${range}. Current ${s.current.basis === 'average' ? '7-day average' : 'weight'} ${fmt(s.current.kg)} ${u}. ${
        s.change30 !== null ? `Change over 30 days ${fmt(s.change30, true)} ${u}.` : ''
      }`
    : 'Weight chart, no data';

  const fmtEntry = (e: (typeof s.weights.entries)[number]) => (
    <ListItem
      title={`${fmt(Number(e.weight_kg))} ${u}`}
      subtitle={`${formatDate(e.local_date)}${e.note ? ` · ${e.note}` : ''}${e._failed ? ' · not saved, see Sync status' : e._pending ? ' · not synced yet' : ''}`}
      onPress={() => router.push({ pathname: '/weight/log', params: { id: e.id } })}
    />
  );

  return (
    <ListScreen
      data={s.weights.entries}
      keyExtractor={(e) => e.id}
      renderItem={fmtEntry}
      footer={<Button title="Log weight" onPress={() => router.push('/weight/log')} />}
      empty={<Text color="textSecondary">No entries yet.</Text>}
      header={
        <>
          {s.weights.isError ? (
            <Banner
              tone="warning"
              message="Showing saved data; couldn't refresh from the server."
            />
          ) : null}
          <SegmentedControl<RangeKey>
            accessibilityLabel="Date range"
            options={(Object.keys(RANGE_DAYS) as RangeKey[]).map((k) => ({ value: k, label: k }))}
            value={range}
            onChange={setRange}
          />
          {s.inRange.length === 0 ? (
            <EmptyState
              title="No weigh-ins in this range"
              message="Log a morning weight to start your trend."
            />
          ) : (
            <Card>
              <WeightChart
                daily={s.inRange}
                allDaily={s.daily}
                references={refs}
                toDisplay={toDisplay}
                unitLabel={u}
                summary={summary}
              />
            </Card>
          )}

          <View style={styles.row}>
            <StatTile
              label={s.current?.basis === 'average' ? '7-day average' : 'Latest'}
              value={fmt(s.current?.kg ?? null)}
              unit={u}
              caption={s.current?.basis === 'single' ? 'Log 3+ days for an average' : undefined}
            />
            <StatTile label="Since start" value={fmt(s.changeSinceStart, true)} unit={u} />
          </View>
          <View style={styles.row}>
            <StatTile
              label="Last 7 days"
              value={fmt(s.change7, true)}
              unit={u}
              caption={s.change7 === null ? 'Not enough data' : undefined}
            />
            <StatTile
              label="Last 30 days"
              value={fmt(s.change30, true)}
              unit={u}
              caption={s.change30 === null ? 'Not enough data' : undefined}
            />
          </View>
          {s.progressPct !== null ? (
            <Card>
              <Text variant="small" color="textSecondary">
                Goal progress
              </Text>
              <Text variant="display" numeric>
                {Math.round(s.progressPct)}%
              </Text>
              <Text variant="small" color="textSecondary">
                {s.estimate
                  ? `At your current trend: around ${monthYear(s.estimate.earliest)} – ${monthYear(s.estimate.latest)}. An estimate, not a promise.`
                  : 'Estimated date: not enough data yet (needs about 2 weeks of regular weigh-ins and a downward trend).'}
              </Text>
            </Card>
          ) : null}

          <SectionHeader title="History" />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.xs } });
