import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, ConfirmDialog } from '@/components/feedback';
import { Card, ListItem, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { useSyncActions, useSyncStatus } from '@/features/sync/SyncProvider';
import { plural } from '@/domain/format';

export default function ProfileTab() {
  const { session, signOut } = useAuth();
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
      <ListItem
        title="Goal and targets"
        subtitle="Calories, macros and how they were calculated"
        onPress={() => router.push('/settings/targets')}
      />
      <ListItem title="Health and injuries" onPress={() => router.push('/settings/health')} />

      <SectionHeader title="Preferences" />
      <ListItem
        title="Sports"
        subtitle="The sports you play, or none"
        onPress={() => router.push('/settings/sports')}
      />
      <ListItem
        title="Training"
        subtitle="Days, session length"
        onPress={() => router.push('/settings/training')}
      />
      <ListItem
        title="Nutrition"
        subtitle="Diet, allergies, meals"
        onPress={() => router.push('/settings/nutrition')}
      />
      <ListItem title="Equipment" onPress={() => router.push('/settings/equipment')} />
      <ListItem title="Reminders" onPress={() => router.push('/settings/notifications')} />
      <ListItem title="Appearance" onPress={() => router.push('/settings/appearance')} />

      <SectionHeader title="Your data and privacy" />
      <ListItem
        title="Your data"
        subtitle="Export, or delete your account"
        onPress={() => router.push('/settings/data')}
      />
      <ListItem title="Privacy policy" onPress={() => router.push('/legal/privacy')} />
      <ListItem title="Terms of use" onPress={() => router.push('/legal/terms')} />
      <ListItem title="Health disclaimer" onPress={() => router.push('/legal/disclaimer')} />
      <ListItem title="Data sources and licences" onPress={() => router.push('/legal/licences')} />

      <SectionHeader title="Account" />
      <ListItem
        title="Sync status"
        value={unsynced ? `${unsynced} waiting` : 'All synced'}
        onPress={() => router.push('/settings/sync')}
      />
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
