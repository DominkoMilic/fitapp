import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Banner } from '@/components/feedback';
import { ControlledTextField } from '@/components/forms/ControlledTextField';
import { Button, Screen, Text } from '@/components/ui';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/domain/validation/auth';
import { useAuth } from '@/features/auth/AuthProvider';

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const { control, handleSubmit, formState } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    const r = await requestPasswordReset(email);
    setStatus(
      r.ok
        ? {
            tone: 'success',
            text: 'If an account exists for this email, a reset link is on its way. Open it on this phone.',
          }
        : { tone: 'danger', text: r.error.message },
    );
  });

  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">
        Reset your password
      </Text>
      {status ? <Banner tone={status.tone} message={status.text} /> : null}
      <ControlledTextField
        control={control}
        name="email"
        label="Email"
        onSubmitEditing={() => void onSubmit()}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Button
        title="Send reset link"
        loading={formState.isSubmitting}
        onPress={() => void onSubmit()}
      />
    </Screen>
  );
}
