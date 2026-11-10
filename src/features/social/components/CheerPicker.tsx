import { CHEER_KINDS } from '@/domain/social';

import { ActionSheet } from './ActionSheet';

/** Long-press on a cheer: choose 👏 🔥 💪 ⭐, or remove your cheer. */
export function CheerPicker({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: string | null;
  onPick: (kind: string | null) => void;
  onClose: () => void;
}) {
  return (
    <ActionSheet
      visible={visible}
      title="Cheer"
      onClose={onClose}
      actions={[
        ...CHEER_KINDS.map((c) => ({
          label: `${c.emoji}  ${c.label}${current === c.kind ? ' ✓' : ''}`,
          onPress: () => onPick(c.kind),
        })),
        ...(current
          ? [{ label: 'Remove my cheer', destructive: true, onPress: () => onPick(null) }]
          : []),
      ]}
    />
  );
}
