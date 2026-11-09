import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';

import { ConfigErrorScreen } from '@/components/feedback/ConfigErrorScreen';
import { ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGate } from '@/features/auth/useGate';

/** Entry point: sends the user to auth, onboarding or the app (spec 6.1). */
export default function Gate() {
  const gate = useGate();
  const { signOut } = useAuth();

  switch (gate.kind) {
    case 'config_error':
      return <ConfigErrorScreen />;
    case 'loading':
      return (
        <Screen>
          <LoadingState />
        </Screen>
      );
    case 'profile_error':
      return (
        <Screen>
          <ErrorState message="We couldn't load your profile." onRetry={gate.retry} />
          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
        </Screen>
      );
    case 'account_missing':
      return <AccountMissing onSignOut={signOut} />;
    case 'route':
      return <Redirect href={gate.href} />;
  }
}

/** The session belongs to an account that no longer exists: clear it and explain. */
function AccountMissing({ onSignOut }: { onSignOut: () => Promise<unknown> }) {
  const showToast = useToast((s) => s.show);
  useEffect(() => {
    // Signing out re-routes to Welcome immediately, so the explanation also goes in a toast.
    showToast('This account no longer exists. You have been signed out.');
    void onSignOut();
  }, [onSignOut, showToast]);
  return (
    <Screen>
      <ErrorState
        title="This account no longer exists"
        message="It may have been deleted on another device. You've been signed out."
      />
      <Button title="Back to start" onPress={() => router.replace('/welcome')} />
    </Screen>
  );
}
