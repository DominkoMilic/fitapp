import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ChartLine, Dumbbell, House, User, Utensils } from 'lucide-react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useMilestoneEngine } from '@/features/milestones/api';
import { useTheme } from '@/theme';

function MilestoneEngine() {
  useMilestoneEngine();
  return null;
}

export default function TabsLayout() {
  const { session, initializing } = useAuth();
  const { colors } = useTheme();
  if (!initializing && !session) return <Redirect href="/welcome" />;

  return (
    <>
      <MilestoneEngine />
      <Tabs
        screenOptions={{
          headerShown: false,
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
