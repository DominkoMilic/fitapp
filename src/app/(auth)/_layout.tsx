import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { stackAnimation, useTheme } from '@/theme';

export default function AuthLayout() {
  const { session, initializing } = useAuth();
  const { colors, reduceMotion } = useTheme();
  if (!initializing && session) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background },
        ...stackAnimation(reduceMotion),
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
