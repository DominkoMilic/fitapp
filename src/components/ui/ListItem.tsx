import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { spacing, TOUCH_TARGET, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function ListItem({
  title,
  subtitle,
  value,
  onPress,
  icon,
  destructive,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      feedback="row"
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, value, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      {icon}
      <View style={styles.text}>
        <Text variant="body" color={destructive ? 'danger' : 'textPrimary'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="small" color="textSecondary">
          {value}
        </Text>
      ) : null}
      {onPress ? <ChevronRight size={18} color={colors.textSecondary} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET + 8,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
});
