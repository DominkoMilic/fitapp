import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Text } from './Text';

/**
 * Section title. With an `icon`, the icon and title are drawn in the accent colour so groups of
 * settings stand apart from the rows below them.
 */
export function SectionHeader({
  title,
  action,
  icon: Icon,
}: {
  title: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.title}>
        {Icon ? <Icon size={18} color={colors.accent} accessibilityElementsHidden /> : null}
        <Text variant="title" accessibilityRole="header" color={Icon ? 'accent' : undefined}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
