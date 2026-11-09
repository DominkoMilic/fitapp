import { router, Stack } from 'expo-router';

import { EmptyState } from '@/components/feedback';
import { Screen } from '@/components/ui';

/** Unknown links (pace://…, old notifications, typos) land here instead of a dev error page. */
export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <EmptyState
        title="Page not found"
        message="This link doesn't lead anywhere in PACE. It may be from an older version of the app."
        actionLabel="Go to Home"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
