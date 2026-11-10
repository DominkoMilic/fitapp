import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, ConfirmDialog, EmptyState } from '@/components/feedback';
import { Button, Card, ListScreen, Text } from '@/components/ui';
import type { SyncEntity } from '@/domain/sync/outbox';
import { useOutbox, useSyncActions, useSyncStatus } from '@/features/sync/SyncProvider';
import { spacing } from '@/theme';

const LABELS: Record<SyncEntity, string> = {
  weight_entries: 'Weight',
  body_measurements: 'Measurement',
  daily_checkins: 'Check-in',
  user_milestones: 'Milestone',
  exercises: 'Custom exercise',
  scheduled_workouts: 'Calendar change',
  workout_sessions: 'Workout',
  exercise_sets: 'Workout set',
  activities: 'Activity',
  activity_routes: 'Activity route',
  weekly_reports: 'Weekly report',
};

/** Spec 18.2: every unsynced or rejected change is visible, with Retry and an explicit Discard. */
export default function SyncStatusScreen() {
  const queue = useOutbox();
  const status = useSyncStatus();
  const { flush, retry, discard } = useSyncActions();
  const [toDiscard, setToDiscard] = useState<string | null>(null);

  return (
    <ListScreen
      data={queue}
      keyExtractor={(op) => op.id}
      footer={<Button title="Sync now" loading={status.syncing} onPress={() => void flush()} />}
      header={
        queue.length === 0 ? (
          <EmptyState
            title="Everything is synced"
            message="All your changes are saved to your account."
          />
        ) : (
          <Text color="textSecondary">
            {status.pending} waiting to sync
            {status.failed ? `, ${status.failed} need attention` : ''}. Changes are kept on this
            phone until they reach your account.
          </Text>
        )
      }
      renderItem={(op) => (
        <View style={styles.item}>
          <Card>
            <Text variant="bodyStrong">
              {LABELS[op.entity]} · {op.kind === 'delete' ? 'delete' : 'save'}
            </Text>
            <Text variant="small" color="textSecondary">
              Queued {op.createdAt.slice(0, 16).replace('T', ' ')} ·{' '}
              {op.status === 'failed' ? 'rejected by the server' : `attempts: ${op.attempts}`}
            </Text>
            {op.lastError ? (
              <Banner tone={op.status === 'failed' ? 'danger' : 'info'} message={op.lastError} />
            ) : null}
            {op.status === 'failed' ? (
              <>
                <Button title="Retry" variant="secondary" onPress={() => void retry(op.id)} />
                <Button
                  title="Discard this change"
                  variant="ghost"
                  onPress={() => setToDiscard(op.id)}
                />
              </>
            ) : null}
          </Card>
        </View>
      )}
      overlay={
        <ConfirmDialog
          visible={toDiscard !== null}
          destructive
          title="Discard this change?"
          message="It will be removed from this phone and never saved to your account."
          confirmLabel="Discard"
          onCancel={() => setToDiscard(null)}
          onConfirm={async () => {
            if (toDiscard) await discard(toDiscard);
            setToDiscard(null);
          }}
        />
      }
    />
  );
}

const styles = StyleSheet.create({ item: { marginBottom: spacing.md } });
