import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { Screen, SegmentedControl, Text } from '@/components/ui';
import { groupFriendships } from '@/domain/social';
import { useFriendships, useMySocialProfile } from '@/features/social/api';
import { FeedSection } from '@/features/social/FeedSection';
import { FriendsSection } from '@/features/social/FriendsSection';
import { spacing, useTheme } from '@/theme';

export { inviteMessage } from '@/features/social/FriendsSection';

type Part = 'feed' | 'friends';

/**
 * Social tab (spec 33.5): Feed · Friends. The title and the switch stay in place and both parts
 * stay mounted (the hidden one with display: none), so switching slides the pill without the
 * screen rebuilding or jumping, and each part keeps its scroll position.
 */
export default function SocialTab() {
  const { colors } = useTheme();
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

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
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
      </View>
      <View style={[styles.fill, part !== 'feed' && styles.hidden]}>
        <FeedSection header={null} friendCount={g.friends.length} />
      </View>
      <View style={[styles.fill, part !== 'friends' && styles.hidden]}>
        <FriendsSection header={null} handle={me.data.handle} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
});
