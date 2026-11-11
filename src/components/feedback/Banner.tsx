import { ChevronRight, CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { motion, radius, spacing, useTheme } from '@/theme';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

/**
 * Inline message. Never relies on colour alone: always has an icon and text. Slides in gently
 * when it appears (no animation with reduce motion).
 */
export function Banner({
  tone = 'info',
  title,
  message,
  onPress,
  accessibilityHint,
}: {
  tone?: BannerTone;
  title?: string;
  message: string;
  /** Makes the banner a button (with a chevron) that opens where the issue can be fixed. */
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const { colors, reduceMotion } = useTheme();
  const color = {
    info: colors.info,
    warning: colors.warning,
    danger: colors.danger,
    success: colors.accent,
  }[tone];
  const Icon = tone === 'success' ? CircleCheck : tone === 'info' ? Info : TriangleAlert;
  const body = (
    <>
      <Icon size={20} color={color} />
      <View style={styles.text}>
        {title ? <Text variant="bodyStrong">{title}</Text> : null}
        <Text variant="small" color="textSecondary">
          {message}
        </Text>
      </View>
      {onPress ? <ChevronRight size={20} color={colors.textSecondary} /> : null}
    </>
  );
  const frame = [styles.banner, { borderColor: color, backgroundColor: colors.surface }];
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.normal)}>
      {onPress ? (
        <PressableScale
          feedback="row"
          accessibilityRole="button"
          accessibilityLabel={title ? `${title}. ${message}` : message}
          accessibilityHint={accessibilityHint}
          onPress={onPress}
          style={[frame, styles.pressable]}
        >
          {body}
        </PressableScale>
      ) : (
        <View
          accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'text'}
          style={frame}
        >
          {body}
        </View>
      )}
    </Animated.View>
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
  pressable: { alignItems: 'center' },
});
