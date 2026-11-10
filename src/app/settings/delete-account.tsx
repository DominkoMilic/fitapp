import { router } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/navigation/back';
import { Banner, useToast } from '@/components/feedback';
import { Button, Card, Screen, Text, TextField } from '@/components/ui';
import { clearLocalData, requestAccountDeletion } from '@/features/account/delete-account';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSyncActions, useSyncStatus } from '@/features/sync/SyncProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import { plural } from '@/domain/format';
import { useFieldErrors } from '@/hooks/useFieldErrors';

const ERRORS = {
  reauthentication_required: 'Please enter your password again.',
  network: 'No connection. Your account was not deleted. Try again when you are online.',
  retry: 'Deletion did not finish. It is safe to try again.',
  unknown: 'Something went wrong. Your account was not deleted.',
} as const;

/** Permanent account deletion (spec 19): password, type DELETE, then the server deletes everything. */
export default function DeleteAccount() {
  const { session, signIn } = useAuth();
  const sync = useSyncStatus();
  const { clearLocal } = useSyncActions();
  const showToast = useToast((s) => s.show);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsynced = sync.pending + sync.failed;
  const email = session?.user.email ?? '';
  const ready = password.length > 0 && confirm === 'DELETE' && !!email;

  const fields = useFieldErrors<'password'>();
  const onDelete = async () => {
    if (!ready || !session) return;
    setBusy(true);
    setError(null);
    const userId = session.user.id;
    const auth = await signIn(email, password);
    if (!auth.ok) {
      setBusy(false);
      // A wrong password belongs on the password field; anything else is a general error.
      if (auth.error.kind === 'invalid_credentials')
        fields.show({ password: 'That password is not correct' });
      else setError(auth.error.message);
      return;
    }
    const res = await requestAccountDeletion();
    if (!res.ok) {
      setBusy(false);
      setError(ERRORS[res.error === 'wrong_password' ? 'unknown' : res.error]);
      return;
    }
    await clearLocalData(userId, 'delete', clearLocal);
    await requireSupabase()
      .auth.signOut({ scope: 'local' })
      .catch(() => undefined);
    showToast('Your account and all your data were deleted.');
    router.replace('/welcome');
  };

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading">Delete your account</Text>
      <Card>
        <Text>This permanently deletes:</Text>
        <Text variant="small" color="textSecondary">
          • your account ({email}){'\n'}• your profile, goals, targets and reviews{'\n'}• weights,
          measurements, check-ins and health information{'\n'}• workouts, activities and GPS routes
          {'\n'}• food logs, recipes, plans and shopping lists{'\n'}• milestones and reports
        </Text>
        <Text variant="small" color="textSecondary">
          It can&apos;t be undone. Our hosting provider&apos;s backups expire on their own schedule
          (see the privacy policy). Consider exporting your data first.
        </Text>
      </Card>
      {unsynced ? (
        <Banner
          tone="warning"
          message={`${plural(unsynced, 'change')} on this phone ${unsynced === 1 ? 'has' : 'have'} not synced and will be deleted too.`}
        />
      ) : null}
      <TextField
        label="Password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          fields.clear('password');
        }}
        error={fields.errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <TextField
        label="Type DELETE to confirm"
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
        // Destructive: Enter only closes the keyboard, it never deletes.
        onSubmitEditing={() => undefined}
      />
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button
        title="Delete my account permanently"
        variant="destructive"
        disabled={!ready}
        loading={busy}
        onPress={() => void onDelete()}
      />
      <Button title="Cancel" variant="ghost" onPress={() => goBack('/settings/data')} />
    </Screen>
  );
}
