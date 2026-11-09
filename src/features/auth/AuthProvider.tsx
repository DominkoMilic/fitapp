import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { supabase } from '@/integrations/supabase/client';

import { type AuthCallback } from './deep-link';
import { type FriendlyAuthError, toFriendlyAuthError } from './errors';

type Result = { ok: true } | { ok: false; error: FriendlyAuthError };

interface AuthContextValue {
  /** True until the persisted session has been read from storage. */
  initializing: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<Result>;
  /** Always resolves to "check your email" on success, whether or not the email existed. */
  signUp: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<Result>;
  resendConfirmation: (email: string) => Promise<Result>;
  requestPasswordReset: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  completeCallback: (callback: AuthCallback) => Promise<Result>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const callbackUrl = (next?: string) =>
  Linking.createURL('auth/callback', next ? { queryParams: { next } } : undefined);

const ok: Result = { ok: true };
const fail = (e: unknown): Result => ({
  ok: false,
  error: toFriendlyAuthError(e && typeof e === 'object' ? (e as Record<string, never>) : {}),
});

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(supabase !== null);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session);
          lastUserId.current = data.session?.user.id ?? null;
        }
      })
      .finally(() => {
        if (mounted) setInitializing(false);
      });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      const previousUser = lastUserId.current;
      lastUserId.current = next?.user.id ?? null;
      setSession(next);
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        // Stop GPS, cancel reminders, drop drafts (audit: sign-out hygiene). Loaded lazily so the
        // auth module doesn't depend on every feature at startup.
        if (previousUser)
          void import('@/features/account/local-data').then((m) =>
            m.clearLocalData(previousUser, 'sign-out'),
          );
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const client = supabase;
    const guard = async (fn: () => Promise<{ error: unknown }>): Promise<Result> => {
      if (!client) return fail({ message: 'not configured' });
      try {
        const { error } = await fn();
        return error ? fail(error) : ok;
      } catch (e) {
        return fail(e);
      }
    };
    return {
      initializing,
      session,
      signIn: (email, password) =>
        guard(() => client!.auth.signInWithPassword({ email: email.trim(), password })),
      signUp: (email, password) =>
        guard(() =>
          client!.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: callbackUrl() },
          }),
        ),
      signOut: () => guard(() => client!.auth.signOut()),
      resendConfirmation: (email) =>
        guard(() =>
          client!.auth.resend({
            type: 'signup',
            email: email.trim(),
            options: { emailRedirectTo: callbackUrl() },
          }),
        ),
      requestPasswordReset: (email) =>
        guard(() =>
          client!.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: callbackUrl('reset-password'),
          }),
        ),
      updatePassword: (password) => guard(() => client!.auth.updateUser({ password })),
      completeCallback: async (callback) => {
        switch (callback.kind) {
          case 'code':
            return guard(() => client!.auth.exchangeCodeForSession(callback.code));
          case 'token_hash':
            return guard(() =>
              client!.auth.verifyOtp({ token_hash: callback.tokenHash, type: callback.type }),
            );
          case 'error':
            return fail({ code: callback.code, message: callback.message });
          case 'none':
            return fail({ code: 'flow_state_not_found', message: 'expired' });
        }
      },
    };
  }, [initializing, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
