import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, ConfirmDialog } from '@/components/feedback';
import { Card, ListItem, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFeatures } from '@/features/profile/features';
import { useProfile } from '@/features/profile/api';
import { useSyncActions, useSyncStatus } from '@/features/sync/SyncProvider';
import { plural } from '@/domain/format';

export default function ProfileTab() {
  const { session, signOut } = useAuth();
  const features = useFeatures();
  const profile = useProfile();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const sync = useSyncStatus();
  const { flush } = useSyncActions();
  const unsynced = sync.pending + sync.failed;

  return (
    <Screen edges={['top']}>
      <Text variant="heading" accessibilityRole="header">
        Profile
      </Text>
      <Card>
        <Text variant="title">
          {profile.data?.display_name ?? (profile.isPending ? 'Loading…' : 'Your profile')}
        </Text>
        <Text variant="small" color="textSecondary">
          {session?.user.email}
        </Text>
      </Card>
      {profile.isError ? (
        <Banner
          tone="warning"
          message="Your profile couldn't be loaded. Settings may show older values until you're back online."
        />
      ) : null}

      <SectionHeader title="You" />
      <ListItem title="Personal information" onPress={() => router.push('/settings/personal')} />
      {features.nutrition ? (
        <ListItem
          title="Goal and targets"
          subtitle="Calories, macros and how they were calculated"
          onPress={() => router.push('/settings/targets')}
        />
      ) : (
        <ListItem
          title="Goal"
          subtitle="Your goal and target weight"
          onPress={() => router.push('/settings/goal')}
        />
      )}
      <ListItem title="Health and injuries" onPress={() => router.push('/settings/health')} />

      <SectionHeader title="Preferences" />
      <ListItem
        title="Training setup"
        subtitle="Sports, schedule and equipment"
        onPress={() => router.push('/settings/training-setup')}
      />
      <ListItem
        title="App features"
        subtitle={features.nutrition ? 'Nutrition is on' : 'Nutrition is off'}
        onPress={() => router.push('/settings/features')}
      />
      <ListItem title="Reminders" onPress={() => router.push('/settings/notifications')} />
      <ListItem title="Appearance" onPress={() => router.push('/settings/appearance')} />

      <SectionHeader title="Account" />
      <ListItem
        title="Data and privacy"
        subtitle="Export, delete, privacy policy and terms"
        onPress={() => router.push('/settings/data')}
      />
      {/* Only worth a row when something is waiting or failed. */}
      {unsynced ? (
        <ListItem
          title="Sync status"
          value={`${unsynced} waiting`}
          onPress={() => router.push('/settings/sync')}
        />
      ) : null}
      <ListItem
        title="Sign out"
        destructive
        onPress={() => {
          void flush();
          setConfirmSignOut(true);
        }}
      />
      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message={
          unsynced
            ? `${plural(unsynced, 'change')} ${unsynced === 1 ? 'is' : 'are'} not synced yet. They stay safely on this phone and sync when you sign in again with this account.`
            : 'Your data stays in your account. You can sign in again at any time.'
        }
        confirmLabel={unsynced ? 'Sign out anyway' : 'Sign out'}
        cancelLabel={unsynced ? 'Cancel' : undefined}
        loading={signingOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={async () => {
          setSigningOut(true);
          try {
            await signOut();
            router.replace('/welcome');
          } finally {
            setSigningOut(false);
            setConfirmSignOut(false);
          }
        }}
      />
    </Screen>
  );
}
