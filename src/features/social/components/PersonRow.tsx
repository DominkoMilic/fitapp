import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { spacing, TOUCH_TARGET } from '@/theme';

import { Avatar } from './Avatar';

/** One person in a list: avatar, name and @handle, with optional actions on the right. */
export function PersonRow({
  name,
  handle,
  color,
  detail,
  onPress,
  actions,
}: {
  name: string;
  handle: string;
  color: string;
  detail?: string;
  onPress?: () => void;
  actions?: ReactNode;
}) {
  const body = (
    <View style={styles.body}>
      <Avatar name={name} color={color} />
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          @{handle}
          {detail ? ` · ${detail}` : ''}
        </Text>
      </View>
    </View>
  );
  return (
    <View style={styles.row}>
      {onPress ? (
        <PressableScale
          feedback="row"
          accessibilityRole="button"
          accessibilityLabel={`${name}, @${handle}${detail ? `, ${detail}` : ''}`}
          accessibilityHint="Opens their profile"
          onPress={onPress}
          style={styles.flex}
        >
          {body}
        </PressableScale>
      ) : (
        <View style={styles.flex}>{body}</View>
      )}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET },
  flex: { flex: 1 },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
