import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ChartLine, Dumbbell, House, User, Utensils } from 'lucide-react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useRecalibrationEngine } from '@/features/coach/useRecalibrationEngine';
import { useMilestoneEngine } from '@/features/milestones/api';
import { useNotificationEngine } from '@/features/notifications/useNotificationEngine';
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
            title: 'Nutrition',
            tabBarIcon: ({ color, size }) => <Utensils color={color} size={size} />,
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
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>
    </>
  );
}
