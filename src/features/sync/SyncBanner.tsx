import { router } from 'expo-router';

import { Banner } from '@/components/feedback';
import { Card } from '@/components/ui';

import { useSyncStatus } from './SyncProvider';
import { plural } from '@/domain/format';

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
            ? `${plural(failed, 'change')} couldn't be saved. Tap to review.`
            : `${plural(pending, 'change')} waiting to sync. They're safe on this phone.`
        }
      />
    </Card>
  );
}
