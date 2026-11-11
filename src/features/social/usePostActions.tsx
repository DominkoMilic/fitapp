import { useState } from 'react';

import { ConfirmDialog, useToast } from '@/components/feedback';
import { SOCIAL_ERRORS } from '@/domain/social';

import {
  errorCode,
  type FeedRow,
  useBlockUser,
  useCheer,
  useHideFeedItem,
  useSetCommentsOff,
} from './api';
import { ActionSheet } from './components/ActionSheet';
import { CheerPicker } from './components/CheerPicker';
import { ReportSheet } from './components/ReportSheet';

/**
 * Everything a feed card can do besides opening: cheer (tap / long-press), and the ⋯ menu —
 * Report and Block for other people's posts; for your own, turn comments off or on and Remove from
 * feed (spec 33.5).
 */
export function usePostActions(onRemoved?: () => void) {
  const showToast = useToast((s) => s.show);
  const cheer = useCheer();
  const hide = useHideFeedItem();
  const block = useBlockUser();
  const commentsOff = useSetCommentsOff();
  const [menu, setMenu] = useState<FeedRow | null>(null);
  const [picker, setPicker] = useState<FeedRow | null>(null);
  const [report, setReport] = useState<FeedRow | null>(null);
  const [confirm, setConfirm] = useState<{
    row: FeedRow;
    what: 'hide' | 'block' | 'comments_off';
  } | null>(null);
  const onError = (e: unknown) => showToast(SOCIAL_ERRORS[errorCode(e)]);

  const toggleCheer = (row: FeedRow) =>
    cheer.mutate({ row, kind: row.my_cheer ? null : 'clap' }, { onError });

  const sheets = (
    <>
      <ActionSheet
        visible={!!menu}
        title={menu?.is_mine ? 'Your post' : (menu?.display_name ?? '')}
        onClose={() => setMenu(null)}
        actions={
          menu?.is_mine
            ? [
                menu.comments_off
                  ? {
                      label: 'Turn comments back on',
                      onPress: () =>
                        commentsOff.mutate(
                          { id: menu.id, off: false },
                          { onSuccess: () => showToast('Comments are on again'), onError },
                        ),
                    }
                  : {
                      label: 'Turn off comments',
                      onPress: () => setConfirm({ row: menu, what: 'comments_off' }),
                    },
                {
                  label: 'Remove from feed',
                  destructive: true,
                  onPress: () => setConfirm({ row: menu, what: 'hide' }),
                },
              ]
            : menu
              ? [
                  { label: 'Report post', caution: true, onPress: () => setReport(menu) },
                  {
                    label: `Block ${menu.display_name}`,
                    destructive: true,
                    onPress: () => setConfirm({ row: menu, what: 'block' }),
                  },
                ]
              : []
        }
      />
      <CheerPicker
        visible={!!picker}
        current={picker?.my_cheer ?? null}
        onClose={() => setPicker(null)}
        onPick={(kind) => picker && cheer.mutate({ row: picker, kind }, { onError })}
      />
      <ReportSheet
        visible={!!report}
        targetType="feed_item"
        targetId={report?.id ?? ''}
        targetName="this post"
        onClose={() => setReport(null)}
      />
      <ConfirmDialog
        visible={confirm?.what === 'hide'}
        title="Remove from your feed?"
        message="Friends won't see this post any more. Your workout or activity itself stays in your history."
        confirmLabel="Remove"
        destructive
        loading={hide.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm &&
          hide.mutate(confirm.row.id, {
            onSuccess: () => {
              showToast('Removed from your feed');
              onRemoved?.();
            },
            onError,
            onSettled: () => setConfirm(null),
          })
        }
      />
      <ConfirmDialog
        visible={confirm?.what === 'comments_off'}
        title="Turn off comments?"
        message="Comments on this post will be hidden and no one can add new ones. Cheers still work. You can turn them back on from ⋯ and the hidden comments come back."
        confirmLabel="Turn off"
        loading={commentsOff.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm &&
          commentsOff.mutate(
            { id: confirm.row.id, off: true },
            {
              onSuccess: () => showToast('Comments are off for this post'),
              onError,
              onSettled: () => setConfirm(null),
            },
          )
        }
      />
      <ConfirmDialog
        visible={confirm?.what === 'block'}
        title={`Block ${confirm?.row.display_name ?? ''}?`}
        message="Any friendship or request between you ends, and you won't see each other anywhere in PACE. They aren't told."
        confirmLabel="Block"
        destructive
        loading={block.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm &&
          block.mutate(confirm.row.owner, {
            onSuccess: () => {
              showToast(`${confirm.row.display_name} is blocked`);
              onRemoved?.();
            },
            onError,
            onSettled: () => setConfirm(null),
          })
        }
      />
    </>
  );

  return {
    onCheer: toggleCheer,
    onPickCheer: (row: FeedRow) => setPicker(row),
    onMore: (row: FeedRow) => setMenu(row),
    sheets,
  };
}
