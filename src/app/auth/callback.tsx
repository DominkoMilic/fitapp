import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { parseAuthCallback } from '@/features/auth/deep-link';

/**
 * Handles email confirmation and password-reset links (pace://auth/callback?...).
 * Works on cold start: the URL is read once the router and auth provider are ready.
 */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const params = useLocalSearchParams<Record<string, string>>();
  const { completeCallback, initializing } = useAuth();
  const [error, setError] = useState<string | null>(null);
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
    void completeCallback(callback).then((r) => {
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      const next = 'next' in callback ? callback.next : null;
      router.replace(next === 'reset-password' ? '/reset-password' : '/');
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
  return (
    <Screen>
      <LoadingState label="Confirming your link" />
    </Screen>
  );
}
