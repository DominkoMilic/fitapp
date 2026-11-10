import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ChartLine, Dumbbell, House, User, Users, Utensils } from 'lucide-react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useRecalibrationEngine } from '@/features/coach/useRecalibrationEngine';
import { useMilestoneEngine } from '@/features/milestones/api';
import { useNotificationEngine } from '@/features/notifications/useNotificationEngine';
import { profileTabShown, useFeatures } from '@/features/profile/features';
import { motion, useTheme } from '@/theme';

function MilestoneEngine() {
  useMilestoneEngine();
  return null;
}

/** Local reminders kept in line with the plan (spec 17). */
function NotificationEngine() {
  useNotificationEngine();
  return null;
}

/** Two-weekly target review (spec 8.9); runs when the app opens. */
function RecalibrationEngine() {
  useRecalibrationEngine();
  return null;
}

export default function TabsLayout() {
  const { session, initializing } = useAuth();
  const { colors, reduceMotion } = useTheme();
  const features = useFeatures();
  if (!initializing && !session) return <Redirect href="/welcome" />;

  return (
    <>
      <MilestoneEngine />
      <RecalibrationEngine />
      <NotificationEngine />
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: reduceMotion ? 'none' : motion.transitions.tabs,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="training"
          options={{
            title: 'Training',
            tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="nutrition"
          options={{
            // Hidden when the user switched nutrition off (Settings → App features).
            href: features.nutrition ? undefined : null,
            title: 'Nutrition',
            tabBarIcon: ({ color, size }) => <Utensils color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            // Shown once social is set up and switched on (spec 33.5).
            href: features.social ? undefined : null,
            title: 'Social',
            tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, size }) => <ChartLine color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            // At most five tabs: with nutrition and social both on, Profile opens from the Home
            // header instead.
            href: profileTabShown(features) ? undefined : null,
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>
    </>
  );
}
