import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { parseAuthCallback } from '@/features/auth/deep-link';
import { requireSupabase } from '@/integrations/supabase/client';

/**
 * Handles email confirmation and password-reset links (pace://auth/callback?...).
 * Works on cold start: the URL is read once the router and auth provider are ready.
 * After a link signs someone in, the account is shown before continuing, so a link crafted to sign
 * a person into somebody else's account is noticed ("This isn't my account" signs out).
 */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const params = useLocalSearchParams<Record<string, string>>();
  const { completeCallback, initializing, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string | null; next: string | null } | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (initializing || handled.current) return;
    const fromParams = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string'),
    ).toString();
    const candidate =
      url && url.includes('auth/callback') ? url : `pace://auth/callback?${fromParams}`;
    const callback = parseAuthCallback(candidate);
    handled.current = true;
    void completeCallback(callback).then(async (r) => {
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      const next = 'next' in callback ? callback.next : null;
      const { data } = await requireSupabase().auth.getSession();
      setDone({ email: data.session?.user.email ?? null, next });
    });
  }, [completeCallback, initializing, params, url]);

  if (error) {
    return (
      <Screen>
        <ErrorState title="This link didn't work" message={error} />
        <Button title="Go to sign in" onPress={() => router.replace('/sign-in')} />
        <Button
          title="Request a new reset link"
          variant="ghost"
          onPress={() => router.replace('/forgot-password')}
        />
      </Screen>
    );
  }
  if (done) {
    return (
      <Screen>
        <Card>
          <Text variant="title" accessibilityRole="header">
            {done.next === 'reset-password' ? 'Reset your password' : 'Email confirmed'}
          </Text>
          <Text color="textSecondary">You&apos;re signed in as</Text>
          <Text variant="bodyStrong">{done.email ?? 'your account'}</Text>
        </Card>
        <Button
          title="Continue"
          onPress={() => router.replace(done.next === 'reset-password' ? '/reset-password' : '/')}
        />
        <Button
          title="This isn't my account"
          variant="ghost"
          onPress={() => void signOut().finally(() => router.replace('/welcome'))}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <LoadingState label="Confirming your link" />
    </Screen>
  );
}
