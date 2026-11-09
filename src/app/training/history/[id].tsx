import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { groupSavedSets } from '@/domain/training/workout-log';
import { goBack } from '@/navigation/back';
import { ConfirmDialog, ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, Screen, StatTile, Text } from '@/components/ui';
import { formatClock } from '@/hooks/useNow';
import { useProfile } from '@/features/profile/api';
import { useSyncActions } from '@/features/sync/SyncProvider';
import { useSessions } from '@/features/training/session-api';
import { KG_PER_LB } from '@/domain/calculations/units';
import { spacing } from '@/theme';
import { completionLabel, formatDate } from '@/domain/format';

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, sets, isPending } = useSessions();
  const { write } = useSyncActions();
  const { data: profile } = useProfile();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const metric = (profile?.unit_system ?? 'metric') === 'metric';
  const s = sessions.find((x) => x.id === id);
  if (isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (!s)
    return (
      <Screen edges={['bottom']}>
        <ErrorState title="Not found" message="This workout no longer exists." />
      </Screen>
    );
  // One card per exercise as it was done (the warm-up and main glute bridge stay separate).
  const groups = groupSavedSets(sets.filter((x) => x.workout_session_id === s.id));
  const w = (kg: number) => (metric ? `${kg} kg` : `${Math.round((kg / KG_PER_LB) * 10) / 10} lb`);

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading" accessibilityRole="header">
        {s.title}
      </Text>
      <Text color="textSecondary">
        {formatDate(s.local_date)} · {completionLabel(s.completion_status)}
        {s.source === 'manual' ? ' · logged manually' : ''}
      </Text>
      <View style={styles.row}>
        <StatTile label="Duration" value={formatClock(s.duration_seconds)} />
        <StatTile
          label="Effort"
          value={s.perceived_exertion === null ? '—' : `${Number(s.perceived_exertion)}`}
          caption="RPE 0–10"
        />
      </View>
      <View style={styles.row}>
        <StatTile
          label="Volume"
          value={
            s.total_volume_kg
              ? `${Math.round(metric ? Number(s.total_volume_kg) : Number(s.total_volume_kg) / KG_PER_LB)}`
              : '—'
          }
          unit={s.total_volume_kg ? (metric ? 'kg' : 'lb') : undefined}
        />
        <StatTile
          label="Calories"
          value={s.calories_estimated === null ? '—' : `≈${s.calories_estimated}`}
          caption="Estimate"
        />
      </View>
      {s.notes ? (
        <Card>
          <Text>{s.notes}</Text>
        </Card>
      ) : null}
      <Button
        title="Edit workout"
        variant="secondary"
        accessibilityHint="Change the time, duration, sets and exercises"
        onPress={() => router.push({ pathname: '/training/history/edit', params: { id: s.id } })}
      />
      {groups.map((g, gi) => (
        <Card key={`${g.name}-${gi}`}>
          <Text variant="bodyStrong">
            {g.name}
            {g.rows.some((r) => r.pain_flag) ? ' · pain reported' : ''}
          </Text>
          {g.rows.map((r) => (
            <Text key={r.id} variant="small" color={r.completed ? 'textPrimary' : 'textSecondary'}>
              Set {r.set_number}:{' '}
              {r.skipped
                ? 'skipped'
                : [
                    r.repetitions !== null ? `${r.repetitions} reps` : null,
                    r.weight_kg ? w(Number(r.weight_kg)) : null,
                    r.duration_seconds ? `${r.duration_seconds} s` : null,
                  ]
                    .filter(Boolean)
                    .join(' × ')}
              {!r.completed && !r.skipped ? ' (not done)' : ''}
            </Text>
          ))}
        </Card>
      ))}
      <Button title="Delete this workout" variant="ghost" onPress={() => setConfirmDelete(true)} />
      <ConfirmDialog
        visible={confirmDelete}
        destructive
        title="Delete this workout?"
        message="It's removed from your history and records. Milestones you already unlocked stay unlocked."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await write({
            id: randomUUID(),
            entity: 'workout_sessions',
            recordKey: s.id,
            kind: 'delete',
            payload: null,
            createdOffline: false,
          });
          setConfirmDelete(false);
          goBack('/training/history');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.xs } });
