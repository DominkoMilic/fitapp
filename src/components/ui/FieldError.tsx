import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { motion, useTheme } from '@/theme';

import { Text } from './Text';

/**
 * A validation message under a field. It drops in from just above (and fades out when fixed)
 * instead of popping in; no animation with reduce motion on.
 */
export function FieldError({ message }: { message?: string | null }) {
  const { reduceMotion } = useTheme();
  if (!message) return null;
  return (
    <Animated.View
      key={message}
      entering={reduceMotion ? undefined : FadeInDown.duration(motion.normal)}
      exiting={reduceMotion ? undefined : FadeOut.duration(motion.fast)}
    >
      <Text
        variant="small"
        color="danger"
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        {message}
      </Text>
    </Animated.View>
  );
}
