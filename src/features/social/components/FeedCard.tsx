import { router } from 'expo-router';
import { Activity, Dumbbell, MessageCircle, MoreHorizontal, Trophy } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { cheerEmoji, cheerTotal, feedDetail, feedTitle, relativeDay } from '@/domain/social';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/theme';

import type { FeedRow } from '../api';
import { Avatar } from './Avatar';

const KIND_ICON = { workout: Dumbbell, activity: Activity, milestone: Trophy } as const;

/**
 * One shared item (spec 33.5): who, when, what (from the whitelisted snapshot only), cheers and
 * comments. Tap the cheer to applaud, long-press it to pick another cheer.
 */
export function FeedCard({
  row,
  today,
  onCheer,
  onPickCheer,
  onMore,
  openable = true,
}: {
  row: FeedRow;
  today: string;
  onCheer: (row: FeedRow) => void;
  onPickCheer: (row: FeedRow) => void;
  onMore: (row: FeedRow) => void;
  /** False on the item screen itself. */
  openable?: boolean;
}) {
  const { colors } = useTheme();
  const Icon = KIND_ICON[row.kind as keyof typeof KIND_ICON] ?? Activity;
  const title = feedTitle(row.kind, row.snapshot);
  const detail = feedDetail(row.kind, row.snapshot);
  const day = relativeDay(row.local_date, today);
  const total = cheerTotal(row.cheers);
  const kinds = Object.keys(row.cheers).filter((k) => (row.cheers[k] ?? 0) > 0);
  const open = () => router.push({ pathname: '/social/item/[id]', params: { id: row.id } });
  const name = row.is_mine ? 'You' : row.display_name;

  const body = (
    <>
      <View style={styles.head}>
        <Avatar name={row.display_name} color={row.avatar_color} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            @{row.handle} · {day}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${title}`}
          onPress={() => onMore(row)}
          hitSlop={8}
          style={styles.iconButton}
        >
          <MoreHorizontal color={colors.textSecondary} size={22} />
        </Pressable>
      </View>
      <View style={styles.what}>
        <View style={[styles.kindIcon, { backgroundColor: colors.successSurface }]}>
          <Icon size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="title">{title}</Text>
          {detail ? (
            <Text variant="small" color="textSecondary">
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={`${name}, ${title}${detail ? `, ${detail}` : ''}, ${day}`}
    >
      {openable ? (
        <PressableScale
          feedback="row"
          accessibilityRole="button"
          accessibilityLabel={`${name}: ${title}, ${day}`}
          accessibilityHint="Opens the post with comments"
          onPress={open}
        >
          {body}
        </PressableScale>
      ) : (
        body
      )}
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        {row.is_mine ? (
          <View style={styles.action} accessibilityLabel={`${total} cheers`}>
            <Text variant="body">{kinds.length ? kinds.map(cheerEmoji).join('') : '👏'}</Text>
            <Text variant="small" color="textSecondary">
              {total ? `${total}` : 'No cheers yet'}
            </Text>
          </View>
        ) : (
          <PressableScale
            feedback="button"
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={row.my_cheer ? 'Remove your cheer' : 'Cheer'}
            accessibilityHint="Long press to choose a different cheer"
            accessibilityState={{ selected: !!row.my_cheer }}
            onPress={() => onCheer(row)}
            onLongPress={() => onPickCheer(row)}
            style={[
              styles.action,
              styles.cheer,
              {
                backgroundColor: row.my_cheer ? colors.successSurface : 'transparent',
                borderColor: row.my_cheer ? colors.accent : colors.border,
              },
            ]}
          >
            <Text variant="body">{row.my_cheer ? cheerEmoji(row.my_cheer) : '👏'}</Text>
            <Text variant="small" color={row.my_cheer ? 'accent' : 'textSecondary'}>
              {total ? String(total) : 'Cheer'}
            </Text>
          </PressableScale>
        )}
        {/* Comments turned off by the owner: only cheers remain. */}
        {row.comments_off ? null : (
          <PressableScale
            feedback="button"
            accessibilityRole="button"
            accessibilityLabel={`${row.comment_count} comments`}
            onPress={openable ? open : undefined}
            disabled={!openable}
            style={styles.action}
          >
            <MessageCircle size={18} color={colors.textSecondary} />
            <Text variant="small" color="textSecondary">
              {row.comment_count ? String(row.comment_count) : 'Comment'}
            </Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  iconButton: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  what: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  kindIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
  },
  cheer: { borderWidth: 1, borderRadius: radius.pill },
});
