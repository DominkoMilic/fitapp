import { Redirect } from 'expo-router';

import { ConfigErrorScreen } from '@/components/feedback/ConfigErrorScreen';
import { ErrorState, LoadingState } from '@/components/feedback';
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
    case 'route':
      return <Redirect href={gate.href} />;
  }
}
