import { Inbox } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { spacing, useTheme } from '@/theme';

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessibilityRole="summary">
      {icon ?? <Inbox size={36} color={colors.textSecondary} />}
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} fullWidth={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
});
