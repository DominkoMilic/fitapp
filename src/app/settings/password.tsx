import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable } from 'react-native';

import { Banner, useToast } from '@/components/feedback';
import { ControlledTextField } from '@/components/forms/ControlledTextField';
import { PasswordChecklist } from '@/components/forms/PasswordChecklist';
import { Button, Screen, Text } from '@/components/ui';
import { changePasswordSchema, type ChangePasswordValues } from '@/domain/validation/auth';
import { useAuth } from '@/features/auth/AuthProvider';
import { goBack } from '@/navigation/back';
import { TOUCH_TARGET } from '@/theme';

/** Change the password while signed in: confirm the current one first, then set a new one. */
export default function ChangePassword() {
  const { session, signIn, updatePassword, requestPasswordReset } = useAuth();
  const email = session?.user.email ?? '';
  const showToast = useToast((s) => s.show);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const {
    control,
    handleSubmit,
    formState,
    setError: setFieldError,
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: '', password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async ({ current, password: next }) => {
    setError(null);
    // Re-checking the current password also gives Supabase the "recent sign-in" it can require
    // before a password change.
    const check = await signIn(email, current);
    if (!check.ok) {
      setFieldError('current', { message: "That password isn't right" }, { shouldFocus: true });
      return;
    }
    const r = await updatePassword(next);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    showToast('Password changed');
    goBack('/profile');
  });

  const sendReset = async () => {
    setError(null);
    const r = await requestPasswordReset(email);
    if (r.ok) setResetSent(true);
    else setError(r.error.message);
  };

  return (
    <Screen locked={formState.isSubmitting} edges={['bottom']}>
      {error ? <Banner tone="danger" message={error} /> : null}
      {resetSent ? (
        <Banner
          tone="success"
          message={`A reset link is on its way to ${email}. Open it on this phone.`}
        />
      ) : null}
      <ControlledTextField
        control={control}
        name="current"
        label="Current password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <ControlledTextField
        control={control}
        name="password"
        label="New password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordChecklist password={password} showErrors={formState.isSubmitted} />
      <ControlledTextField
        control={control}
        name="confirmPassword"
        label="Confirm new password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void onSubmit()}
      />
      <Button
        title="Change password"
        loading={formState.isSubmitting}
        onPress={() => void onSubmit()}
      />
      <Pressable
        accessibilityRole="link"
        onPress={() => void sendReset()}
        disabled={resetSent || !email}
        style={{ minHeight: TOUCH_TARGET, justifyContent: 'center' }}
      >
        <Text variant="body" color="accent">
          Forgot your current password?
        </Text>
      </Pressable>
    </Screen>
  );
}
