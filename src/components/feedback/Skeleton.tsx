import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

export function Skeleton({
  width = '100%',
  height = 16,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  const { colors, reduceMotion } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width,
          height,
          backgroundColor: colors.surfaceRaised,
          opacity: reduceMotion ? 0.7 : opacity,
        },
      ]}
    />
  );
}

/** Generic loading placeholder for a screen of cards. */
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View
      style={styles.stack}
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
    >
      <Skeleton height={28} width="60%" />
      <Skeleton height={96} />
      <Skeleton height={96} />
      <Skeleton height={64} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.input },
  stack: { gap: spacing.md, paddingVertical: spacing.md },
});
