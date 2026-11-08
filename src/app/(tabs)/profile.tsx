import { router } from 'expo-router';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/feedback';
import { Card, ListItem, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';

export default function ProfileTab() {
  const { session, signOut } = useAuth();
  const profile = useProfile();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Screen edges={['top']}>
      <Text variant="heading" accessibilityRole="header">
        Profile
      </Text>
      <Card>
        <Text variant="title">{profile.data?.display_name ?? ''}</Text>
        <Text variant="small" color="textSecondary">
          {session?.user.email}
        </Text>
      </Card>

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
      <ListItem title="Appearance" onPress={() => router.push('/settings/appearance')} />

      <SectionHeader title="Privacy" />
      <ListItem title="Privacy policy" onPress={() => router.push('/legal/privacy')} />
      <ListItem title="Terms of use" onPress={() => router.push('/legal/terms')} />
      <ListItem title="Health disclaimer" onPress={() => router.push('/legal/disclaimer')} />
      <ListItem title="Export my data" subtitle="Available before public release" />
      <ListItem title="Delete my account" subtitle="Available before public release" />

      <ListItem title="Sign out" destructive onPress={() => setConfirmSignOut(true)} />
      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="Your data stays in your account. You can sign in again at any time."
        confirmLabel="Sign out"
        loading={signingOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          setConfirmSignOut(false);
          router.replace('/welcome');
        }}
      />
    </Screen>
  );
}
