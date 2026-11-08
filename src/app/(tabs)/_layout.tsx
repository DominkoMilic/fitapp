import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';

/** Replaced by the bottom-tab navigator in feature/p1-app-shell. */
export default function TabsLayout() {
  const { session, initializing } = useAuth();
  if (!initializing && !session) return <Redirect href="/welcome" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
