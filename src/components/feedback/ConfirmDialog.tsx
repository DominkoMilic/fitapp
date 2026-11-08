import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius, spacing, useTheme } from '@/theme';

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
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onCancel}
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      >
        <Pressable
          style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityViewIsModal
          onPress={() => undefined}
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  dialog: { borderRadius: radius.sheet, borderWidth: 1, padding: spacing.xl, gap: spacing.sm },
  actions: { gap: spacing.xs, marginTop: spacing.sm },
});
