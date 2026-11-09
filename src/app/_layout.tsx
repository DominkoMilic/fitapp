import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigErrorScreen } from '@/components/feedback/ConfigErrorScreen';
import { ToastHost } from '@/components/feedback/Toast';
import { envResult } from '@/config/env';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { useRestTimerNotification } from '@/features/notifications/useRestTimerNotification';
import { SyncProvider } from '@/features/sync/SyncProvider';
import '@/services/location/location-task';
import { connectQueryOnlineState, createQueryClient } from '@/services/query-client';
import { stackAnimation, ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
connectQueryOnlineState();

/** A crashing screen shows a friendly retry page instead of a blank/red screen (audit fix). */
export { AppErrorBoundary as ErrorBoundary } from '@/components/feedback/AppErrorBoundary';

function RestTimerNotification() {
  useRestTimerNotification();
  return null;
}

function RootStack() {
  const { colors, scheme, reduceMotion } = useTheme();
  const { initializing } = useAuth();

  useEffect(() => {
    if (!initializing) void SplashScreen.hideAsync().catch(() => undefined);
  }, [initializing]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          ...stackAnimation(reduceMotion),
        }}
      />
      <ToastHost />
      <RestTimerNotification />
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {envResult.ok ? (
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <SyncProvider>
                  <RootStack />
                </SyncProvider>
              </AuthProvider>
            </QueryClientProvider>
          ) : (
            <ConfigErrorScreen />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
