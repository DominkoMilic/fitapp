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
import { SyncProvider } from '@/features/sync/SyncProvider';
import { createQueryClient } from '@/services/query-client';
import { ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootStack() {
  const { colors, scheme } = useTheme();
  const { initializing } = useAuth();

  useEffect(() => {
    if (!initializing) void SplashScreen.hideAsync().catch(() => undefined);
  }, [initializing]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      />
      <ToastHost />
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
