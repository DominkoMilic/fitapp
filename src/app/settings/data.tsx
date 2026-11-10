import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, useToast } from '@/components/feedback';
import { Button, Card, ListItem, ProgressBar, Screen, SectionHeader, Text } from '@/components/ui';
import { buildExport, type ExportProgress } from '@/features/account/export';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSyncActions, useSyncStatus } from '@/features/sync/SyncProvider';
import { shareJsonFile } from '@/services/share/share-file';
import { plural } from '@/domain/format';

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
        Download everything PACE stores about you as one JSON file: profile and goals, weights and
        measurements, check-ins and health information, workouts, activities with their routes,
        plans, milestones, reports and your social profile.
      </Text>
      {unsynced ? (
        <Banner
          message={`${plural(unsynced, 'change')} on this phone ${unsynced === 1 ? "hasn't" : "haven't"} synced yet and won't be in the export until they do.`}
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

      <SectionHeader title="Legal" />
      <ListItem title="Privacy policy" onPress={() => router.push('/legal/privacy')} />
      <ListItem title="Terms of use" onPress={() => router.push('/legal/terms')} />
      <ListItem title="Health disclaimer" onPress={() => router.push('/legal/disclaimer')} />
      <ListItem title="Data sources and licences" onPress={() => router.push('/legal/licences')} />
    </Screen>
  );
}
