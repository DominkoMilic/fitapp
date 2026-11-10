import { useState } from 'react';

import { ConfirmDialog, useToast } from '@/components/feedback';
import { SOCIAL_ERRORS } from '@/domain/social';

import { errorCode, type FeedRow, useBlockUser, useCheer, useHideFeedItem } from './api';
import { ActionSheet } from './components/ActionSheet';
import { CheerPicker } from './components/CheerPicker';
import { ReportSheet } from './components/ReportSheet';

/**
 * Everything a feed card can do besides opening: cheer (tap / long-press), and the ⋯ menu —
 * Report and Block for other people's posts, Remove from feed for your own (spec 33.5).
 */
export function usePostActions(onRemoved?: () => void) {
  const showToast = useToast((s) => s.show);
  const cheer = useCheer();
  const hide = useHideFeedItem();
  const block = useBlockUser();
  const [menu, setMenu] = useState<FeedRow | null>(null);
  const [picker, setPicker] = useState<FeedRow | null>(null);
  const [report, setReport] = useState<FeedRow | null>(null);
  const [confirm, setConfirm] = useState<{ row: FeedRow; what: 'hide' | 'block' } | null>(null);
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
                {
                  label: 'Remove from feed',
                  destructive: true,
                  onPress: () => setConfirm({ row: menu, what: 'hide' }),
                },
              ]
            : menu
              ? [
                  { label: 'Report post', destructive: true, onPress: () => setReport(menu) },
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
