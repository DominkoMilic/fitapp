import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useOnboardingDraft } from '@/features/onboarding/draft-store';
import { useProfile } from '@/features/profile/api';
import { useTheme } from '@/theme';

export default function OnboardingLayout() {
  const { session, initializing } = useAuth();
  const { colors } = useTheme();
  const bindUser = useOnboardingDraft((s) => s.bindUser);
  const profile = useProfile();
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) bindUser(userId);
  }, [bindUser, userId]);

  if (!initializing && !session) return <Redirect href="/welcome" />;
  // Already onboarded (e.g. finished on another device, or a stale route): go to the app.
  if (profile.data?.onboarding_completed_at) return <Redirect href="/home" />;
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
