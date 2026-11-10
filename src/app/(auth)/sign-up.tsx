import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Banner } from '@/components/feedback';
import { ControlledTextField } from '@/components/forms/ControlledTextField';
import { PasswordChecklist } from '@/components/forms/PasswordChecklist';
import { Button, Screen, Text } from '@/components/ui';
import { signUpSchema, type SignUpValues } from '@/domain/validation/auth';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SignUp() {
  const { signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await signUp(values.email, values.password);
    // Success looks the same whether or not the email was already registered (no enumeration).
    if (result.ok)
      router.replace({ pathname: '/verify-email', params: { email: values.email.trim() } });
    else setError(result.error.message);
  });

  return (
    <Screen>
      <Text variant="heading" accessibilityRole="header">
        Create your account
      </Text>
      <Text variant="body" color="textSecondary">
        PACE is for people aged 18 and over.
      </Text>
      {error ? <Banner tone="danger" message={error} /> : null}
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
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordChecklist password={password} showErrors={formState.isSubmitted} />
      <ControlledTextField
        control={control}
        name="confirmPassword"
        label="Confirm password"
        onSubmitEditing={() => void onSubmit()}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Button
        title="Create account"
        loading={formState.isSubmitting}
        onPress={() => void onSubmit()}
      />
    </Screen>
  );
}
