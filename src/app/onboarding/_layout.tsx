import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { useTheme } from '@/theme';

export default function OnboardingLayout() {
  const { session, initializing } = useAuth();
  const { colors } = useTheme();
  const bindUser = useOnboardingDraft((s) => s.bindUser);
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) bindUser(userId);
  }, [bindUser, userId]);

  if (!initializing && !session) return <Redirect href="/welcome" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
