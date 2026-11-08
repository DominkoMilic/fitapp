import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { envResult } from '@/config/env';

import type { Database } from './database.types';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * The only Supabase client in the app. Uses the publishable (anon) key; RLS protects data.
 * Session storage: AsyncStorage (SecureStore has a ~2 KB value limit on iOS, and Supabase
 * sessions are larger than that).
 */
export const supabase: TypedSupabaseClient | null = envResult.ok
  ? createClient<Database>(envResult.env.supabaseUrl, envResult.env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

export function requireSupabase(): TypedSupabaseClient {
  if (!supabase)
    throw new Error('Supabase is not configured. Check EXPO_PUBLIC_SUPABASE_* variables.');
  return supabase;
}

// Refresh tokens only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
