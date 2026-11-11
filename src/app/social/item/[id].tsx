import { Stack, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  useToast,
} from '@/components/feedback';
import { FormLock, ListScreen, Text, TextField } from '@/components/ui';
import { relativeDay, SOCIAL_ERRORS } from '@/domain/social';
import { useToday } from '@/features/dashboard/useToday';
import {
  type CommentRow,
  errorCode,
  useAddComment,
  useComments,
  useDeleteComment,
  useFeedItem,
  useOnline,
} from '@/features/social/api';
import { ActionSheet } from '@/features/social/components/ActionSheet';
import { Avatar } from '@/features/social/components/Avatar';
import { FeedCard } from '@/features/social/components/FeedCard';
import { OfflineNote } from '@/features/social/components/OfflineNote';
import { ReportSheet } from '@/features/social/components/ReportSheet';
import { usePostActions } from '@/features/social/usePostActions';
import { goBack } from '@/navigation/back';
import { spacing, TOUCH_TARGET, useTheme } from '@/theme';

const MAX = 280;

/** One shared post with its comments (spec 33.5); also where a push notification opens. */
export default function FeedItemScreen() {
  const { colors } = useTheme();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { today } = useToday();
  const item = useFeedItem(id);
  const comments = useComments(id);
  const add = useAddComment();
  const del = useDeleteComment();
  const online = useOnline();
  const showToast = useToast((s) => s.show);
  const actions = usePostActions(() => goBack('/social'));
  const [text, setText] = useState('');
  const [menu, setMenu] = useState<CommentRow | null>(null);
  const [reporting, setReporting] = useState<CommentRow | null>(null);
  const [removing, setRemoving] = useState<CommentRow | null>(null);

  if (item.isPending)
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <LoadingState />
      </View>
    );
  if (item.isError && errorCode(item.error) !== 'not_found')
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <ErrorState
          message={SOCIAL_ERRORS[errorCode(item.error)]}
          onRetry={() => void item.refetch()}
        />
      </View>
    );
  const row = item.data;
  if (!row)
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <EmptyState
          title="This post isn’t available"
          message="It was removed, or it’s no longer shared with you."
          actionLabel="Back"
          onAction={() => goBack('/social')}
        />
      </View>
    );

  const send = () => {
    const body = text.trim();
    if (!body) return;
    add.mutate(
      { itemId: row.id, body },
      {
        onSuccess: () => setText(''),
        onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]),
      },
    );
  };

  const list = comments.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: row.is_mine ? 'Your post' : row.display_name }} />
      <ListScreen
        data={list}
        keyExtractor={(c) => c.id}
        header={
          <>
            {!online ? <OfflineNote /> : null}
            <FeedCard
              row={row}
              today={today}
              openable={false}
              onCheer={actions.onCheer}
              onPickCheer={actions.onPickCheer}
              onMore={actions.onMore}
            />
            <Text variant="title" accessibilityRole="header">
              Comments
            </Text>
          </>
        }
        empty={
          comments.isPending ? (
            <LoadingState />
          ) : comments.isError ? (
            <ErrorState
              message="Comments couldn’t be loaded."
              onRetry={() => void comments.refetch()}
            />
          ) : (
            <Text variant="small" color="textSecondary">
              No comments yet. Say something encouraging.
            </Text>
          )
        }
        renderItem={(c) => (
          <Pressable
            onLongPress={() => !c.removed && setMenu(c)}
            accessibilityHint={c.removed ? undefined : 'Long press for options'}
            style={styles.comment}
          >
            <Avatar name={c.display_name} color={c.avatar_color} size={32} />
            <View style={styles.flex}>
              <Text variant="small" color="textSecondary">
                {c.display_name} · {relativeDay(c.created_at.slice(0, 10), today)}
              </Text>
              {c.removed ? (
                <Text variant="body" color="textSecondary" style={styles.removed}>
                  Comment removed
                </Text>
              ) : (
                <Text variant="body">{c.body}</Text>
              )}
            </View>
          </Pressable>
        )}
        footer={
          <View style={styles.composer}>
            <FormLock locked={add.isPending} style={styles.flex}>
              <TextField
                label="Add a comment"
                value={text}
                onChangeText={setText}
                maxLength={MAX}
                multiline
                hint={`${text.length}/${MAX}`}
              />
            </FormLock>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              accessibilityState={{ disabled: !text.trim() || !online || add.isPending }}
              disabled={!text.trim() || !online || add.isPending}
              onPress={send}
              style={[
                styles.send,
                { backgroundColor: text.trim() && online ? colors.accent : colors.surfaceRaised },
              ]}
            >
              <Send size={20} color={text.trim() && online ? '#0B0D10' : colors.textSecondary} />
            </Pressable>
          </View>
        }
        overlay={
          <>
            {actions.sheets}
            <ActionSheet
              visible={!!menu}
              title="Comment"
              onClose={() => setMenu(null)}
              actions={[
                ...(menu?.can_delete
                  ? [
                      {
                        label: 'Remove comment',
                        destructive: true,
                        onPress: () => setRemoving(menu),
                      },
                    ]
                  : []),
                ...(menu && !menu.can_delete
                  ? [
                      {
                        label: 'Report comment',
                        destructive: true,
                        onPress: () => setReporting(menu),
                      },
                    ]
                  : []),
              ]}
            />
            <ReportSheet
              visible={!!reporting}
              targetType="comment"
              targetId={reporting?.id ?? ''}
              targetName="this comment"
              onClose={() => setReporting(null)}
            />
            <ConfirmDialog
              visible={!!removing}
              title="Remove this comment?"
              message="It will show as “Comment removed” for everyone."
              confirmLabel="Remove"
              destructive
              loading={del.isPending}
              onCancel={() => setRemoving(null)}
              onConfirm={() =>
                removing &&
                del.mutate(removing.id, {
                  onError: (e) => showToast(SOCIAL_ERRORS[errorCode(e)]),
                  onSettled: () => setRemoving(null),
                })
              }
            />
          </>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  comment: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  removed: { fontStyle: 'italic' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  send: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
