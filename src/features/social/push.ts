import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import { devicePushToken } from '@/services/notifications/push-token';

import { TOKEN_KEY } from './push-token-store';

/**
 * Social push registration (spec 33.6). Dormant until Phase 8B-2: it does nothing unless the
 * build has an EAS projectId and the server switch app_config.push_enabled is on.
 */

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

async function pushEnabled(): Promise<boolean> {
  const { data } = await requireSupabase()
    .from('app_config')
    .select('value')
    .eq('key', 'push_enabled')
    .maybeSingle();
  return data?.value === true;
}

export async function registerPushToken(
  userId: string,
): Promise<'off' | 'no_permission' | 'registered'> {
  const id = projectId();
  if (!id || !(await pushEnabled())) return 'off';
  const device = await devicePushToken(id);
  if (!device) return 'no_permission';
  const { error } = await requireSupabase().from('push_tokens').upsert({
    token: device.token,
    user_id: userId,
    platform: device.platform,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, device.token);
  return 'registered';
}

/** Registers the token once per signed-in session while social is on. */
export function usePushRegistration(socialOn: boolean) {
  const userId = useAuth().session?.user.id;
  useEffect(() => {
    if (!userId || !socialOn) return;
    void registerPushToken(userId).catch(() => undefined);
  }, [userId, socialOn]);
}
