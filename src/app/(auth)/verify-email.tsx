import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Banner } from '@/components/feedback';
import { Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

const COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { resendConfirmation } = useAuth();
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email) return;
    setSending(true);
    const r = await resendConfirmation(email);
    setSending(false);
    setCooldown(COOLDOWN_SECONDS);
    setMessage(
      r.ok
        ? { tone: 'success', text: 'If an account exists, a new link is on its way.' }
        : { tone: 'danger', text: r.error.message },
    );
  };

  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">
        Check your email
      </Text>
      <Text variant="body" color="textSecondary">
        {email
          ? `We sent a confirmation link to ${email}. Open it on this phone to continue.`
          : 'Open the confirmation link we sent you on this phone to continue.'}
      </Text>
      {message ? <Banner tone={message.tone} message={message.text} /> : null}
      <Button
        title={cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
        variant="secondary"
        disabled={!email || cooldown > 0}
        loading={sending}
        onPress={() => void resend()}
      />
      <Button title="Back to sign in" variant="ghost" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
