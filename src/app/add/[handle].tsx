import { Redirect, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui';
import { LoadingState } from '@/components/feedback';
import { normaliseHandle } from '@/domain/social';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMySocialProfile } from '@/features/social/api';
import { useFeatures } from '@/features/profile/features';

/** Invite link `pace://add/<handle>`: opens that person, after sign-in and social setup. */
export default function AddFriendLink() {
  const { handle = '' } = useLocalSearchParams<{ handle: string }>();
  const { session, initializing } = useAuth();
  const features = useFeatures();
  const me = useMySocialProfile();
  const h = normaliseHandle(handle);

  if (!initializing && !session) return <Redirect href="/welcome" />;
  if (initializing || !features.loaded || me.isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (!me.data || !features.social)
    return <Redirect href={{ pathname: '/social/setup', params: { then: h } }} />;
  return <Redirect href={{ pathname: '/social/user/[handle]', params: { handle: h } }} />;
}
