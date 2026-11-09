import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, useToast } from '@/components/feedback';
import { Button, Card, ListItem, ProgressBar, Screen, SectionHeader, Text } from '@/components/ui';
import { buildExport, type ExportProgress } from '@/features/account/export';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSyncActions, useSyncStatus } from '@/features/sync/SyncProvider';
import { shareJsonFile } from '@/services/share/share-file';

export default function YourData() {
  const session = useAuth().session;
  const sync = useSyncStatus();
  const { flush } = useSyncActions();
  const showToast = useToast((s) => s.show);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsynced = sync.pending + sync.failed;

  const onExport = async () => {
    if (!session) return;
    setError(null);
    try {
      await flush();
      const json = await buildExport(
        { id: session.user.id, email: session.user.email ?? null },
        setProgress,
      );
      await shareJsonFile(`pace-export-${new Date().toISOString().slice(0, 10)}.json`, json);
      showToast('Export ready');
    } catch {
      setError('The export could not be created. Check your connection and try again.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <SectionHeader title="Export" />
      <Text color="textSecondary">
        Download everything PACE stores about you as one JSON file: profile, goals and targets,
        weights and measurements, check-ins and health information, workouts, activities with their
        routes, food logs, recipes, plans, reviews and reports.
      </Text>
      {unsynced ? (
        <Banner
          message={`${unsynced} change${unsynced > 1 ? 's' : ''} on this phone ${unsynced > 1 ? "haven't" : "hasn't"} synced yet and won't be in the export until they do.`}
        />
      ) : null}
      {progress ? (
        <Card>
          <Text variant="small" color="textSecondary">
            Exporting {progress.label}…
          </Text>
          <ProgressBar
            label="Export progress"
            value={progress.done}
            max={progress.total}
            unit="parts"
          />
        </Card>
      ) : null}
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button title="Export my data" loading={!!progress} onPress={() => void onExport()} />

      <SectionHeader title="Delete" />
      <ListItem
        title="Delete all health information"
        subtitle="Keeps your account"
        onPress={() => router.push('/settings/health')}
      />
      <ListItem
        title="Delete my account"
        subtitle="Permanently deletes your account and all data"
        destructive
        onPress={() => router.push('/settings/delete-account')}
      />
    </Screen>
  );
}
