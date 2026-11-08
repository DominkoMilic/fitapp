import { CloudOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { spacing, useTheme } from '@/theme';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessibilityRole="alert">
      <CloudOff size={36} color={colors.danger} />
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        {message}
      </Text>
      {onRetry ? (
        <Button title="Try again" variant="secondary" onPress={onRetry} fullWidth={false} />
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
