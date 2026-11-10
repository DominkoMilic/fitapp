import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ChartLine, Dumbbell, House, User, Users } from 'lucide-react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useMilestoneEngine } from '@/features/milestones/api';
import { useNotificationEngine } from '@/features/notifications/useNotificationEngine';
import { useFeatures } from '@/features/profile/features';
import { usePushRegistration } from '@/features/social/push';
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

/** Social push token (dormant until Phase 8B-2). */
function PushRegistration({ socialOn }: { socialOn: boolean }) {
  usePushRegistration(socialOn);
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
      <NotificationEngine />
      <PushRegistration socialOn={features.social} />
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
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>
    </>
  );
}
