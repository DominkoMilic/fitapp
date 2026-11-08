import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme';

const TITLES: Record<string, string> = {
  personal: 'Personal information',
  targets: 'Goal and targets',
  goal: 'Change goal',
  sync: 'Sync status',
  health: 'Health and injuries',
  training: 'Training',
  nutrition: 'Nutrition',
  equipment: 'Equipment',
  appearance: 'Appearance',
};

export default function SettingsLayout() {
  const { session, initializing } = useAuth();
  const { colors } = useTheme();
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
      })}
    />
  );
}
