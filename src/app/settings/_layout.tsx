import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { stackAnimation, useTheme } from '@/theme';

const TITLES: Record<string, string> = {
  personal: 'Personal information',
  targets: 'Goal and targets',
  goal: 'Change goal',
  sync: 'Sync status',
  health: 'Health and injuries',
  'training-setup': 'Training setup',
  training: 'Schedule',
  nutrition: 'Nutrition',
  equipment: 'Equipment',
  appearance: 'Appearance',
  notifications: 'Reminders',
  data: 'Data and privacy',
  sports: 'Your sports',
  features: 'App features',
  'delete-account': 'Delete account',
};

export default function SettingsLayout() {
  const { session, initializing } = useAuth();
  const { colors, reduceMotion } = useTheme();
  if (!initializing && !session) return <Redirect href="/welcome" />;
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: true,
        title: TITLES[route.name] ?? '',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        ...stackAnimation(reduceMotion),
      })}
    />
  );
}
