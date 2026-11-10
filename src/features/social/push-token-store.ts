import AsyncStorage from '@react-native-async-storage/async-storage';

import { requireSupabase } from '@/integrations/supabase/client';

/** Where this device remembers its registered push token (to remove it on sign-out). */
export const TOKEN_KEY = 'pace.push-token';

/** Removes this device's token (sign-out); a failure never blocks signing out. */
export async function forgetPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await requireSupabase().from('push_tokens').delete().eq('token', token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Offline: the server drops tokens Expo reports as invalid (8B-2).
  }
}
