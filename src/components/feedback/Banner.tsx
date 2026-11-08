import { CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing, useTheme } from '@/theme';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

/** Inline message. Never relies on colour alone: always has an icon and text. */
export function Banner({
  tone = 'info',
  title,
  message,
}: {
  tone?: BannerTone;
  title?: string;
  message: string;
}) {
  const { colors } = useTheme();
  const color = {
    info: colors.info,
    warning: colors.warning,
    danger: colors.danger,
    success: colors.accent,
  }[tone];
  const Icon = tone === 'success' ? CircleCheck : tone === 'info' ? Info : TriangleAlert;
  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'text'}
      style={[styles.banner, { borderColor: color, backgroundColor: colors.surface }]}
    >
      <Icon size={20} color={color} />
      <View style={styles.text}>
        {title ? <Text variant="bodyStrong">{title}</Text> : null}
        <Text variant="small" color="textSecondary">
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radius.input,
  },
  text: { flex: 1, gap: 2 },
});
