import { router } from 'expo-router';
import { Search, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, LoadingState, useToast } from '@/components/feedback';
import { Button, Screen, SectionHeader, Text } from '@/components/ui';
import { groupFriendships, SOCIAL_ERRORS } from '@/domain/social';
import {
  errorCode,
  type FriendRow,
  useAcceptFriendRequest,
  useFriendships,
  useMySocialProfile,
  useOnline,
  useRemoveFriend,
} from '@/features/social/api';
import { OfflineNote } from '@/features/social/components/OfflineNote';
import { PersonRow } from '@/features/social/components/PersonRow';
import { spacing, useTheme } from '@/theme';

export const inviteMessage = (handle: string) =>
  `Train with me on PACE. Add me: @${handle}\npace://add/${handle}`;

/** Social tab (spec 33.5). In 8A it holds friends: requests, friends, sent requests, invite. */
export default function SocialTab() {
  const { colors } = useTheme();
  const me = useMySocialProfile();
  const list = useFriendships(!!me.data);
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
    if (!me.data) return;
    void Share.share({ message: inviteMessage(me.data.handle) }).catch(() => undefined);
  };

  if (me.isPending || (me.data && list.isPending))
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  if (me.isError || list.isError)
    return (
      <Screen edges={['top']}>
        <ErrorState
          message="Your friends couldn’t be loaded."
          onRetry={() => {
            void me.refetch();
            void list.refetch();
          }}
        />
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

  const g = groupFriendships(list.data ?? []);
  const go = (handle: string) =>
    router.push({ pathname: '/social/user/[handle]', params: { handle } });

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="heading" accessibilityRole="header">
            Friends
          </Text>
          <Text variant="small" color="textSecondary">
            You are @{me.data.handle}
          </Text>
        </View>
      </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
