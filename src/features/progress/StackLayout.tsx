import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { stackAnimation, useTheme } from '@/theme';

/** Shared stack for signed-in detail screens (weight, measurements, milestones, check-in). */
export function SignedInStack({
  titles,
  modal,
}: {
  titles: Record<string, string>;
  modal?: boolean;
}) {
  const { session, initializing } = useAuth();
  const { colors, reduceMotion } = useTheme();
  if (!initializing && !session) return <Redirect href="/welcome" />;
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: true,
        title: titles[route.name] ?? '',
        presentation: modal ? 'modal' : 'card',
        ...stackAnimation(reduceMotion, modal ? 'modal' : 'stack'),
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      })}
    />
  );
}
