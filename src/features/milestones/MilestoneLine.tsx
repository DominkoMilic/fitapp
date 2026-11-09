import { Medal } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/** One unlocked milestone: icon + title (the icon is decorative and not announced). */
export function MilestoneLine({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Medal size={18} color={colors.accent} />
      </View>
      <Text variant="small" style={styles.text}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: { flex: 1 },
});
