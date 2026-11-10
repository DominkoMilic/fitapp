import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';
import { Text } from '@/components/ui/Text';
import { motion, radius, spacing, useTheme } from '@/theme';

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  return (
    <ModalShell
      visible={visible}
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      {/* The backdrop is a sibling, not a wrapper: buttons must not be nested inside a button. */}
      <View style={styles.backdrop}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.normal)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={loading ? undefined : onCancel}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
          />
        </Animated.View>
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.duration(motion.normal)}
          style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityViewIsModal
        >
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" color="textSecondary">
            {message}
          </Text>
          <View style={styles.actions}>
            <Button
              title={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              loading={loading}
              onPress={onConfirm}
            />
            <Button title={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} />
          </View>
        </Animated.View>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  dialog: { borderRadius: radius.sheet, borderWidth: 1, padding: spacing.xl, gap: spacing.sm },
  actions: { gap: spacing.xs, marginTop: spacing.sm },
});
