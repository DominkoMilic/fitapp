import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { envResult } from '@/config/env';
import { createTimeoutFetch } from '@/services/network/timeout-fetch';

import type { Database } from './database.types';
import { sessionStorage } from './session-storage';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * The only Supabase client in the app. Uses the publishable (anon) key; RLS protects data.
 * Session storage: the OS keychain on phones (chunked, see chunked-storage.ts), localStorage on web.
 */
export const supabase: TypedSupabaseClient | null = envResult.ok
  ? createClient<Database>(envResult.env.supabaseUrl, envResult.env.supabaseAnonKey, {
      auth: {
        storage: sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      // Requests can't hang forever on a bad connection (audit fix).
      global: { fetch: createTimeoutFetch() },
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
