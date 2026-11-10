import { ErrorState, LoadingState } from '@/components/feedback';
import { router } from 'expo-router';

import { ListItem, Screen, Text, Toggle } from '@/components/ui';
import { usePreferences } from '@/features/profile/api';
import { SOCIAL_ERRORS } from '@/domain/social';
import { errorCode, useMySocialProfile, useSetSocialEnabled } from '@/features/social/api';

/** Optional parts of PACE (spec 6.5): social. */
export default function AppFeatures() {
  const prefs = usePreferences();
  const socialProfile = useMySocialProfile();
  const setSocial = useSetSocialEnabled();
  if (prefs.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (prefs.isError || !prefs.data)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message="Your settings couldn't be loaded."
          onRetry={() => void prefs.refetch()}
        />
      </Screen>
    );
  const socialOn = setSocial.isPending
    ? (setSocial.variables ?? prefs.data.social_enabled)
    : prefs.data.social_enabled;
  return (
    <Screen edges={['bottom']}>
      <Toggle
        label="Social"
        description="Friends, and later a feed, clubs and challenges. Nothing is shared until you choose."
        value={socialOn}
        onChange={(v) => {
          // The first time, turning it on means choosing a handle and what to share.
          if (v && !socialProfile.data) router.push('/social/setup');
          else setSocial.mutate(v);
        }}
      />
      {setSocial.isError ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {SOCIAL_ERRORS[errorCode(setSocial.error)]}
        </Text>
      ) : null}
      {socialProfile.data ? (
        <ListItem
          title="Social and privacy"
          subtitle="Your profile, what friends see, blocked people"
          onPress={() => router.push('/settings/social')}
        />
      ) : null}
    </Screen>
  );
}
