import { Banner } from '@/components/feedback';
import { Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

/** Replaced by the onboarding flow in feature/p1-onboarding. */
export default function OnboardingStart() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Text variant="heading">Welcome to PACE</Text>
      <Banner tone="info" message="Onboarding is not available in this build yet." />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
