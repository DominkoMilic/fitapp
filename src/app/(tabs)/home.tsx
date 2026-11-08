import { Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

export default function Home() {
  const { session, signOut } = useAuth();
  return (
    <Screen>
      <Text variant="heading">Signed in</Text>
      <Text color="textSecondary">{session?.user.email}</Text>
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
