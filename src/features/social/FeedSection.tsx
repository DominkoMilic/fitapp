import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, Skeleton } from '@/components/feedback';
import { ListScreen } from '@/components/ui';
import { SOCIAL_ERRORS } from '@/domain/social';
import { useToday } from '@/features/dashboard/useToday';
import { spacing } from '@/theme';

import { errorCode, type FeedRow, useFeed, useOnline, useSocialSettings } from './api';
import { FeedCard } from './components/FeedCard';
import { OfflineNote } from './components/OfflineNote';
import { usePostActions } from './usePostActions';

/**
 * Feed part of the Social tab (spec 33.5): your and your friends' shared training, paged. The tab
 * draws the title, safe area and Feed · Friends switch above it.
 */
export function FeedSection({ header, friendCount }: { header: ReactNode; friendCount: number }) {
  const { today } = useToday();
  const feed = useFeed();
  const online = useOnline();
  const settings = useSocialSettings();
  const actions = usePostActions();
  const rows: FeedRow[] = feed.data?.pages.flat() ?? [];
  const sharesNothing =
    !!settings.data &&
    settings.data.workouts_audience === 'private' &&
    settings.data.activities_audience === 'private' &&
    settings.data.milestones_audience === 'private';

  const top = (
    <>
      {header}
      {!online ? <OfflineNote /> : null}
      {feed.isError && rows.length > 0 ? (
        <ErrorState
          message={SOCIAL_ERRORS[errorCode(feed.error)]}
          onRetry={() => void feed.refetch()}
        />
      ) : null}
    </>
  );

  const empty = feed.isPending ? (
    <View style={styles.gap}>
      <Skeleton height={140} />
      <Skeleton height={140} />
    </View>
  ) : feed.isError ? (
    <ErrorState
      message={SOCIAL_ERRORS[errorCode(feed.error)]}
      onRetry={() => void feed.refetch()}
    />
  ) : friendCount === 0 ? (
    <EmptyState
      title="Your feed is empty"
      message="Add a friend to see the training they choose to share."
      actionLabel="Add friends"
      onAction={() => router.push('/social/search')}
    />
  ) : (
    <EmptyState
      title="Nothing shared yet"
      message={
        sharesNothing
          ? "Your friends haven't shared anything yet. You can share your workouts, walks and runs in Settings → Social and privacy."
          : "Your friends haven't shared anything yet. Your own shared workouts and activities appear here too."
      }
      actionLabel={sharesNothing ? 'Choose what to share' : undefined}
      onAction={sharesNothing ? () => router.push('/settings/social') : undefined}
    />
  );

  return (
    <ListScreen
      edges={[]}
      data={rows}
      keyExtractor={(r) => r.id}
      header={top}
      empty={empty}
      renderItem={(row) => (
        <View style={styles.item}>
          <FeedCard
            row={row}
            today={today}
            onCheer={actions.onCheer}
            onPickCheer={actions.onPickCheer}
            onMore={actions.onMore}
          />
        </View>
      )}
      onLoadMore={feed.hasNextPage ? () => void feed.fetchNextPage() : undefined}
      loadingMore={feed.isFetchingNextPage}
      onRefresh={() => void feed.refetch()}
      refreshing={feed.isRefetching && !feed.isFetchingNextPage}
      overlay={actions.sheets}
    />
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  item: { marginBottom: spacing.md },
});
