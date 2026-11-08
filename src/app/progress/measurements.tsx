import { router } from 'expo-router';
import { useState } from 'react';

import { MiniLineChart } from '@/components/charts/MiniLineChart';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, ListItem, Screen, SectionHeader, Text } from '@/components/ui';
import { CM_PER_IN, type UnitSystem } from '@/domain/calculations/units';
import {
  MEASUREMENT_LABELS,
  type MeasurementType,
  summarizeMeasurements,
} from '@/domain/measurements/measurements';
import { useMeasurementActions, useMeasurements } from '@/features/measurements/api';
import { useProfile } from '@/features/profile/api';

export default function MeasurementsScreen() {
  const m = useMeasurements();
  const actions = useMeasurementActions();
  const { data: profile } = useProfile();
  const [toDelete, setToDelete] = useState<string | null>(null);
  const unit = (profile?.unit_system ?? 'metric') as UnitSystem;
  const u = unit === 'metric' ? 'cm' : 'in';
  const disp = (cm: number) => (unit === 'metric' ? cm : cm / CM_PER_IN);
  const fmt = (cm: number, signed = false) =>
    `${signed && cm > 0 ? '+' : ''}${disp(cm).toFixed(1)} ${u}`;

  if (m.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (m.isError && m.rows.length === 0) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="We couldn't load your measurements."
          onRetry={() => void m.refetch()}
        />
      </Screen>
    );
  }
  const summaries = summarizeMeasurements(m.rows);

  return (
    <Screen
      edges={['bottom']}
      footer={<Button title="Add measurements" onPress={() => router.push('/measurements/log')} />}
    >
      {summaries.length === 0 ? (
        <EmptyState
          title="No measurements yet"
          message="Waist and other measurements show progress the scale can miss."
        />
      ) : (
        summaries.map((s) => (
          <Card key={s.type}>
            <Text variant="bodyStrong">{MEASUREMENT_LABELS[s.type]}</Text>
            <Text variant="display" numeric>
              {fmt(s.latestCm)}
            </Text>
            <Text variant="small" color="textSecondary">
              {s.changeCm === null
                ? `First entry ${s.latestDate}`
                : `${fmt(s.changeCm, true)} since ${s.series[0]!.date}`}
            </Text>
            {s.series.length > 1 ? (
              <MiniLineChart
                points={s.series.map((p) => ({ date: p.date, value: disp(p.cm) }))}
                summary={`${MEASUREMENT_LABELS[s.type]} trend: ${fmt(s.firstCm)} to ${fmt(s.latestCm)}`}
              />
            ) : null}
          </Card>
        ))
      )}
      {m.rows.length ? <SectionHeader title="History" /> : null}
      {m.rows.slice(0, 80).map((r) => (
        <ListItem
          key={r.id}
          title={`${MEASUREMENT_LABELS[r.measurement_type as MeasurementType] ?? r.measurement_type}: ${fmt(Number(r.value_cm))}`}
          subtitle={`${r.local_date}${r._failed ? ' · not saved, see Sync status' : r._pending ? ' · not synced yet' : ''}`}
          value="Delete"
          onPress={() => setToDelete(r.id)}
        />
      ))}
      <ConfirmDialog
        visible={toDelete !== null}
        destructive
        title="Delete this measurement?"
        message="It is removed from your history."
        confirmLabel="Delete"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await actions.remove(toDelete);
          setToDelete(null);
        }}
      />
    </Screen>
  );
}
