import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Screen, SegmentedControl, Text } from '@/components/ui';
import { groupFriendships } from '@/domain/social';
import { useFriendships, useMySocialProfile } from '@/features/social/api';
import { FeedSection } from '@/features/social/FeedSection';
import { FriendsSection } from '@/features/social/FriendsSection';

export { inviteMessage } from '@/features/social/FriendsSection';

type Part = 'feed' | 'friends';

/** Social tab (spec 33.5): Feed · Friends. Clubs and challenges join in 8C–8D. */
export default function SocialTab() {
  const me = useMySocialProfile();
  const friends = useFriendships(!!me.data);
  const [part, setPart] = useState<Part>('feed');

  if (me.isPending)
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  if (me.isError)
    return (
      <Screen edges={['top']}>
        <ErrorState message="Social couldn’t be loaded." onRetry={() => void me.refetch()} />
      </Screen>
    );
  if (!me.data)
    return (
      <Screen edges={['top']}>
        <EmptyState
          title="Set up social"
          message="Choose a handle so friends can find you. Nothing is shared until you choose."
          actionLabel="Set up"
          onAction={() => router.push('/social/setup')}
        />
      </Screen>
    );

  const g = groupFriendships(friends.data ?? []);
  const requests = g.incoming.length;
  const header = (
    <>
      <View>
        <Text variant="heading" accessibilityRole="header">
          Social
        </Text>
        <Text variant="small" color="textSecondary">
          You are @{me.data.handle}
        </Text>
      </View>
      <SegmentedControl<Part>
        accessibilityLabel="Social section"
        options={[
          { value: 'feed', label: 'Feed' },
          { value: 'friends', label: requests ? `Friends (${requests})` : 'Friends' },
        ]}
        value={part}
        onChange={setPart}
      />
    </>
  );

  return part === 'feed' ? (
    <FeedSection header={header} friendCount={g.friends.length} />
  ) : (
    <FriendsSection header={header} handle={me.data.handle} />
  );
}
