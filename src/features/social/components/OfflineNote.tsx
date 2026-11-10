import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/** Social changes need the server (spec 33.1), so offline they are paused with this note. */
export function OfflineNote() {
  const { colors } = useTheme();
  return (
    <Card tone="muted">
      <View style={styles.row} accessibilityRole="alert">
        <WifiOff size={18} color={colors.textSecondary} />
        <Text variant="small" color="textSecondary" style={styles.flex}>
          Social needs a connection. You can look, but changes wait until you’re back online.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
