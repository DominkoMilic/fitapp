import { goBack } from '@/navigation/back';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  useToast,
} from '@/components/feedback';
import { Button, Card, Screen, Text } from '@/components/ui';
import { normaliseHandle, primaryAction, RELATIONSHIP_LABEL, SOCIAL_ERRORS } from '@/domain/social';
import {
  errorCode,
  useAcceptFriendRequest,
  useBlockUser,
  useMySocialProfile,
  useOnline,
  useRemoveFriend,
  useSendFriendRequest,
  useSocialProfile,
  useUnblockUser,
} from '@/features/social/api';
import { ActionSheet, type SheetAction } from '@/features/social/components/ActionSheet';
import { Avatar } from '@/features/social/components/Avatar';
import { OfflineNote } from '@/features/social/components/OfflineNote';
import { ReportSheet } from '@/features/social/components/ReportSheet';
import { spacing, TOUCH_TARGET, useTheme } from '@/theme';

type Confirm = 'remove' | 'block' | null;

/** Another person's social profile (spec 33.5): one main action, plus remove, block, report. */
export default function SocialUser() {
  const { colors } = useTheme();
  const { handle: raw = '' } = useLocalSearchParams<{ handle: string }>();
  const handle = normaliseHandle(raw);
  const me = useMySocialProfile();
  const profile = useSocialProfile(handle);
  const online = useOnline();
  const showToast = useToast((s) => s.show);
  const send = useSendFriendRequest();
  const accept = useAcceptFriendRequest();
  const remove = useRemoveFriend();
  const block = useBlockUser();
  const unblock = useUnblockUser();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reporting, setReporting] = useState(false);

  const onError = (e: unknown) => showToast(SOCIAL_ERRORS[errorCode(e)]);

  if (profile.isPending)
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  if (profile.isError)
    return (
      <Screen edges={['bottom']}>
        <ErrorState
          message={SOCIAL_ERRORS[errorCode(profile.error)]}
          onRetry={() => void profile.refetch()}
        />
      </Screen>
    );
  const p = profile.data;
  if (!p)
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="Profile not found"
          message="This person doesn’t exist, isn’t on social, or can’t be shown."
          actionLabel="Back"
          onAction={() => goBack('/social')}
        />
      </Screen>
    );

  const isMe = me.data?.user_id === p.user_id;
  const action = isMe ? 'none' : primaryAction(p.relationship);
  const busy = send.isPending || accept.isPending || remove.isPending || unblock.isPending;

  const menuActions: SheetAction[] = [
    ...(p.relationship === 'friends'
      ? [{ label: 'Remove friend', onPress: () => setConfirm('remove') }]
      : []),
    ...(p.relationship === 'blocked'
      ? []
      : [{ label: 'Block', destructive: true, onPress: () => setConfirm('block') }]),
    { label: 'Report', destructive: true, onPress: () => setReporting(true) },
  ];

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: p.display_name,
          headerRight: isMe
            ? undefined
            : () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                  onPress={() => setMenu(true)}
                  hitSlop={8}
                  style={styles.more}
                >
                  <MoreHorizontal color={colors.textPrimary} size={24} />
                </Pressable>
              ),
        }}
      />
      {!online ? <OfflineNote /> : null}
      <View style={styles.head}>
        <Avatar name={p.display_name} color={p.avatar_color} size={72} />
        <Text variant="heading" accessibilityRole="header">
          {p.display_name}
        </Text>
        <Text variant="body" color="textSecondary">
          @{p.handle}
          {RELATIONSHIP_LABEL[p.relationship] ? ` · ${RELATIONSHIP_LABEL[p.relationship]}` : ''}
        </Text>
        <Text variant="small" color="textSecondary">
          {p.friend_count === 1 ? '1 friend' : `${p.friend_count} friends`}
        </Text>
      </View>
      {p.bio ? (
        <Card>
          <Text variant="body">{p.bio}</Text>
        </Card>
      ) : null}

      {action === 'add' ? (
        <Button
          title="Add friend"
          disabled={!online}
          loading={busy}
          onPress={() =>
            send.mutate(p.handle, {
              onSuccess: (rel) =>
                showToast(
                  rel === 'friends' ? `You and ${p.display_name} are friends` : 'Request sent',
                ),
              onError,
            })
          }
        />
      ) : action === 'accept' ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              title="Accept"
              disabled={!online}
              loading={accept.isPending}
              onPress={() =>
                accept.mutate(p.user_id, {
                  onSuccess: () => showToast(`You and ${p.display_name} are friends`),
                  onError,
                })
              }
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Decline"
              variant="secondary"
              disabled={!online || busy}
              onPress={() =>
                remove.mutate(p.user_id, {
                  onSuccess: () => showToast('Request declined'),
                  onError,
                })
              }
            />
          </View>
        </View>
      ) : action === 'cancel' ? (
        <Button
          title="Cancel request"
          variant="secondary"
          disabled={!online}
          loading={remove.isPending}
          onPress={() =>
            remove.mutate(p.user_id, { onSuccess: () => showToast('Request cancelled'), onError })
          }
        />
      ) : action === 'unblock' ? (
        <Button
          title="Unblock"
          variant="secondary"
          disabled={!online}
          loading={unblock.isPending}
          onPress={() =>
            unblock.mutate(p.user_id, { onSuccess: () => showToast('Unblocked'), onError })
          }
        />
      ) : null}

      <Card tone="muted">
        <Text variant="small" color="textSecondary">
          {isMe
            ? 'This is how friends see you. Change it in Settings → Social and privacy.'
            : p.relationship === 'friends'
              ? 'What they choose to share will appear here when the friends feed arrives.'
              : 'Friends see only what each person chooses to share. Weight and health are never shared.'}
        </Text>
      </Card>

      <ActionSheet
        visible={menu}
        title={p.display_name}
        actions={menuActions}
        onClose={() => setMenu(false)}
      />
      <ConfirmDialog
        visible={confirm === 'remove'}
        title={`Remove ${p.display_name}?`}
        message="You’ll stop being friends. They aren’t told, but they’ll no longer see what you share."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          remove.mutate(p.user_id, {
            onSuccess: () => showToast('Friend removed'),
            onError,
            onSettled: () => setConfirm(null),
          })
        }
      />
      <ConfirmDialog
        visible={confirm === 'block'}
        title={`Block ${p.display_name}?`}
        message="Any friendship or request between you ends, and you won’t see each other anywhere in PACE. They can’t find you or send requests. They aren’t told. You can unblock in Settings → Social and privacy."
        confirmLabel="Block"
        destructive
        loading={block.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          block.mutate(p.user_id, {
            onSuccess: () => {
              showToast(`${p.display_name} is blocked`);
              goBack('/social');
            },
            onError,
            onSettled: () => setConfirm(null),
          })
        }
      />
      <ReportSheet
        visible={reporting}
        targetType="profile"
        targetId={p.user_id}
        targetName={p.display_name}
        onClose={() => setReporting(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: spacing.xxs, paddingVertical: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  more: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
