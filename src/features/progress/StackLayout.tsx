import { type Href, Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { HeaderBack } from '@/navigation/HeaderBack';
import { stackAnimation, useTheme } from '@/theme';

/** Shared stack for signed-in detail screens (weight, measurements, milestones, check-in). */
export function SignedInStack({
  titles,
  modal,
  fallback,
}: {
  titles: Record<string, string>;
  modal?: boolean;
  /** Where the back arrow of the stack's first screen leads when there is no history. */
  fallback: Href;
}) {
  const { session, initializing } = useAuth();
  const { colors, reduceMotion } = useTheme();
  if (!initializing && !session) return <Redirect href="/welcome" />;
  return (
    <Stack
      screenOptions={({ route, navigation }) => ({
        ...(isFirst(route.key, navigation)
          ? { headerLeft: () => <HeaderBack fallback={fallback} /> }
          : null),
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

/** The first screen of a stack gets no native back arrow (nothing earlier in that stack). */
export function isFirst(
  key: string | undefined,
  navigation: { getState: () => { routes: readonly { key: string }[] } },
) {
  return !!key && navigation.getState().routes[0]?.key === key;
}
