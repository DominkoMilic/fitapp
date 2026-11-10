import { router } from 'expo-router';
import { Search, Share2 } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, Screen, SectionHeader } from '@/components/ui';
import { groupFriendships, SOCIAL_ERRORS } from '@/domain/social';
import {
  errorCode,
  type FriendRow,
  useAcceptFriendRequest,
  useFriendships,
  useOnline,
  useRemoveFriend,
} from '@/features/social/api';
import { OfflineNote } from '@/features/social/components/OfflineNote';
import { PersonRow } from '@/features/social/components/PersonRow';
import { spacing, useTheme } from '@/theme';

export const inviteMessage = (handle: string) =>
  `Train with me on PACE. Add me: @${handle}\npace://add/${handle}`;

/** Friends part of the Social tab (spec 33.5): requests, friends, sent requests, invite. */
export function FriendsSection({ header, handle }: { header: ReactNode; handle: string }) {
  const { colors } = useTheme();
  const list = useFriendships();
  const online = useOnline();
  const accept = useAcceptFriendRequest();
  const remove = useRemoveFriend();
  const showToast = useToast((s) => s.show);
  const [busy, setBusy] = useState<string | null>(null);

  const act = (row: FriendRow, kind: 'accept' | 'decline' | 'cancel') => {
    setBusy(row.user_id);
    const done = {
      onSuccess: () =>
        showToast(
          kind === 'accept'
            ? `You and ${row.display_name} are friends`
            : kind === 'decline'
              ? 'Request declined'
              : 'Request cancelled',
        ),
      onError: (e: unknown) => showToast(SOCIAL_ERRORS[errorCode(e)]),
      onSettled: () => setBusy(null),
    };
    if (kind === 'accept') accept.mutate(row.user_id, done);
    else remove.mutate(row.user_id, done);
  };

  const invite = () => {
    void Share.share({ message: inviteMessage(handle) }).catch(() => undefined);
  };

  if (list.isPending)
    return (
      <Screen edges={['top']}>
        {header}
        <LoadingState />
      </Screen>
    );
  if (list.isError)
    return (
      <Screen edges={['top']}>
        {header}
        <ErrorState
          message="Your friends couldn’t be loaded."
          onRetry={() => void list.refetch()}
        />
      </Screen>
    );

  const g = groupFriendships(list.data ?? []);
  const go = (handle: string) =>
    router.push({ pathname: '/social/user/[handle]', params: { handle } });

  return (
    <Screen edges={['top']}>
      {header}
      {!online ? <OfflineNote /> : null}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title="Add friends"
            variant="secondary"
            icon={<Search size={18} color={colors.textPrimary} />}
            onPress={() => router.push('/social/search')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title="Invite"
            variant="secondary"
            icon={<Share2 size={18} color={colors.textPrimary} />}
            onPress={invite}
          />
        </View>
      </View>

      {g.incoming.length > 0 ? (
        <>
          <SectionHeader title={`Requests (${g.incoming.length})`} />
          {g.incoming.map((r) => (
            <PersonRow
              key={r.user_id}
              name={r.display_name}
              handle={r.handle}
              color={r.avatar_color}
              onPress={() => go(r.handle)}
              actions={
                <>
                  <Button
                    title="Accept"
                    fullWidth={false}
                    disabled={!online}
                    loading={busy === r.user_id && accept.isPending}
                    onPress={() => act(r, 'accept')}
                    accessibilityLabel={`Accept ${r.display_name}`}
                  />
                  <Button
                    title="Decline"
                    variant="ghost"
                    fullWidth={false}
                    disabled={!online || busy === r.user_id}
                    onPress={() => act(r, 'decline')}
                    accessibilityLabel={`Decline ${r.display_name}`}
                  />
                </>
              }
            />
          ))}
        </>
      ) : null}

      <SectionHeader title={g.friends.length > 0 ? `Friends (${g.friends.length})` : 'Friends'} />
      {g.friends.length === 0 ? (
        <EmptyState
          title="Train together"
          message="Add a friend by their handle or send them an invite. You'll see what they choose to share once the friends feed arrives."
        />
      ) : (
        g.friends.map((r) => (
          <PersonRow
            key={r.user_id}
            name={r.display_name}
            handle={r.handle}
            color={r.avatar_color}
            onPress={() => go(r.handle)}
          />
        ))
      )}

      {g.outgoing.length > 0 ? (
        <>
          <SectionHeader title="Sent requests" />
          {g.outgoing.map((r) => (
            <PersonRow
              key={r.user_id}
              name={r.display_name}
              handle={r.handle}
              color={r.avatar_color}
              detail="Waiting"
              onPress={() => go(r.handle)}
              actions={
                <Button
                  title="Cancel"
                  variant="ghost"
                  fullWidth={false}
                  disabled={!online}
                  loading={busy === r.user_id && remove.isPending}
                  onPress={() => act(r, 'cancel')}
                  accessibilityLabel={`Cancel request to ${r.display_name}`}
                />
              }
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
