import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Banner } from '@/components/feedback';
import { ControlledTextField } from '@/components/forms/ControlledTextField';
import { Button, Screen, Text } from '@/components/ui';
import { signInSchema, type SignInValues } from '@/domain/validation/auth';
import { useAuth } from '@/features/auth/AuthProvider';
import { type FriendlyAuthError } from '@/features/auth/errors';

export default function SignIn() {
  const { signIn } = useAuth();
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  const { control, handleSubmit, formState, getValues } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await signIn(values.email, values.password);
    if (result.ok) router.replace('/');
    else setError(result.error);
  });

  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">
        Sign in
      </Text>
      {error ? <Banner tone="danger" message={error.message} /> : null}
      {error?.kind === 'email_not_confirmed' ? (
        <Button
          title="Resend confirmation email"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/verify-email', params: { email: getValues('email') } })
          }
        />
      ) : null}
      <ControlledTextField
        control={control}
        name="email"
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <ControlledTextField
        control={control}
        name="password"
        label="Password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void onSubmit()}
      />
      <Button title="Sign in" loading={formState.isSubmitting} onPress={() => void onSubmit()} />
      <Link href="/forgot-password" accessibilityRole="link">
        <Text variant="body" color="accent">
          Forgot your password?
        </Text>
      </Link>
    </Screen>
  );
}
