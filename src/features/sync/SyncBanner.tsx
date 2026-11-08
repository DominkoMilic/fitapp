import { router } from 'expo-router';

import { Banner } from '@/components/feedback';
import { Card } from '@/components/ui';

import { useSyncStatus } from './SyncProvider';

/** Small sync indicator: only shown when something is waiting or failed. */
export function SyncBanner() {
  const { pending, failed } = useSyncStatus();
  if (!pending && !failed) return null;
  return (
    <Card onPress={() => router.push('/settings/sync')} accessibilityLabel="Open sync status">
      <Banner
        tone={failed ? 'danger' : 'info'}
        message={
          failed
            ? `${failed} change${failed > 1 ? 's' : ''} couldn't be saved. Tap to review.`
            : `${pending} change${pending > 1 ? 's' : ''} waiting to sync. They're safe on this phone.`
        }
      />
    </Card>
  );
}
