import { useState } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { haptics, motion, useTheme } from '@/theme';

export type PressFeedback = 'button' | 'row';
export type PressHaptic = 'selection' | 'light' | null;

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How much it shrinks while pressed: buttons more, rows and cards less. */
  feedback?: PressFeedback;
  haptic?: PressHaptic;
  /** Drawn at half opacity (disabled look); press feedback still applies on top. */
  dimmed?: boolean;
}

/**
 * The app's one pressable (spec 23.4): a quick, non-bouncy scale and a slight dim while the
 * finger is down, plus an optional haptic on press. With "reduce motion" only the dim remains.
 * Runs on the native driver, so it stays smooth while JavaScript is busy.
 */
export function PressableScale({
  style,
  feedback = 'button',
  haptic = null,
  dimmed = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const { reduceMotion } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));
  const to = (s: number, o: number) => {
    Animated.parallel([
      reduceMotion
        ? Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true })
        : Animated.spring(scale, { toValue: s, ...motion.press.spring, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: o, duration: motion.fast / 2, useNativeDriver: true }),
    ]).start();
  };
  const pressedScale = feedback === 'row' ? motion.press.scaleRow : motion.press.scaleButton;
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[
        style,
        { transform: [{ scale }], opacity: dimmed ? Animated.multiply(opacity, 0.5) : opacity },
      ]}
      onPressIn={(e) => {
        to(pressedScale, motion.press.pressedOpacity);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1, 1);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic === 'selection') haptics.selection();
        else if (haptic === 'light') haptics.light();
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
