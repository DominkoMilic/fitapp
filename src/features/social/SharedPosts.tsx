import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/feedback';
import { SectionHeader, Text } from '@/components/ui';
import { useToday } from '@/features/dashboard/useToday';
import { spacing } from '@/theme';

import { useFeed } from './api';
import { FeedCard } from './components/FeedCard';
import { usePostActions } from './usePostActions';

const SHOWN = 5;

/** A person's most recent shared posts, on their profile (friends and yourself only). */
export function SharedPosts({ ownerId, isMe }: { ownerId: string; isMe: boolean }) {
  const { today } = useToday();
  const feed = useFeed(ownerId);
  const actions = usePostActions();
  const rows = (feed.data?.pages.flat() ?? []).slice(0, SHOWN);
  return (
    <View style={styles.gap}>
      <SectionHeader title={isMe ? 'Your recent posts' : 'Recent posts'} />
      {feed.isPending ? (
        <Skeleton height={140} />
      ) : rows.length === 0 ? (
        <Text variant="small" color="textSecondary">
          {isMe
            ? 'Nothing shared yet. Choose what friends see in Settings → Social and privacy.'
            : 'Nothing shared yet.'}
        </Text>
      ) : (
        rows.map((row) => (
          <FeedCard
            key={row.id}
            row={row}
            today={today}
            onCheer={actions.onCheer}
            onPickCheer={actions.onPickCheer}
            onMore={actions.onMore}
          />
        ))
      )}
      {actions.sheets}
    </View>
  );
}

const styles = StyleSheet.create({ gap: { gap: spacing.sm } });
