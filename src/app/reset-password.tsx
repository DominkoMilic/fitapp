import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Banner } from '@/components/feedback';
import { ControlledTextField } from '@/components/forms/ControlledTextField';
import { Button, Screen, Text } from '@/components/ui';
import { resetPasswordSchema, type ResetPasswordValues } from '@/domain/validation/auth';
import { useAuth } from '@/features/auth/AuthProvider';

/** Reached from the password-reset link, which signs the user in with a recovery session. */
export default function ResetPassword() {
  const { session, initializing, updatePassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!initializing && !session) return <Redirect href="/forgot-password" />;

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    const r = await updatePassword(password);
    if (r.ok) router.replace('/');
    else setError(r.error.message);
  });

  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">
        Choose a new password
      </Text>
      {error ? <Banner tone="danger" message={error} /> : null}
      <ControlledTextField
        control={control}
        name="password"
        label="New password"
        hint="At least 8 characters, with letters and numbers"
        secureTextEntry
        autoComplete="new-password"
      />
      <ControlledTextField
        control={control}
        name="confirmPassword"
        label="Confirm new password"
        secureTextEntry
      />
      <Button
        title="Save password"
        loading={formState.isSubmitting}
        onPress={() => void onSubmit()}
      />
    </Screen>
  );
}
