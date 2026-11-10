import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion, radius, useTheme } from '@/theme';

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 26;
const PAD = (TRACK_H - THUMB) / 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

/**
 * The switch drawn inside `Toggle`: the thumb slides and the track fades between off and on
 * (instantly with reduce motion). Visual only — the Toggle row handles touch and accessibility,
 * so the native switch's jump when its value changes from outside is gone.
 */
export function AnimatedSwitch({ value }: { value: boolean }) {
  const { colors, reduceMotion } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(
      reduceMotion
        ? value
          ? 1
          : 0
        : withTiming(value ? 1 : 0, {
            duration: motion.normal,
            easing: Easing.out(Easing.cubic),
          }),
    );
  }, [value, reduceMotion, progress]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.border, colors.accent]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * TRAVEL }],
  }));

  return (
    <Animated.View
      style={[styles.track, track]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={value ? 'switch-on' : 'switch-off'}
    >
      <Animated.View style={[styles.thumb, thumb]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radius.pill,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
