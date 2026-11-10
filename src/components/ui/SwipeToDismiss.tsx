import { type ReactNode, useCallback } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion, useTheme } from '@/theme';

/** Fraction of the screen width a swipe must travel (or a fast flick) to dismiss. */
const DISMISS_FRACTION = 0.35;
const FLICK_VELOCITY = 800;

/**
 * Swipe a card sideways to dismiss it; tapping its own Dismiss control (via the `dismiss`
 * argument) plays the same animation. The card slides out, then its height collapses so the
 * content below glides up instead of jumping. With "reduce motion" on, it is removed at once.
 *
 * `gap` is the parent's row gap, collapsed together with the card so nothing jumps at the end.
 * `above` (e.g. a section header) collapses with the card but doesn't move with the swipe.
 */
export function SwipeToDismiss({
  onDismiss,
  gap = 0,
  above,
  children,
}: {
  onDismiss: () => void;
  gap?: number;
  above?: ReactNode;
  children: (dismiss: () => void) => ReactNode;
}) {
  const { reduceMotion } = useTheme();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const height = useSharedValue(0);
  const collapse = useSharedValue(0);

  const slideOutAndCollapse = useCallback(
    (direction: number) => {
      'worklet';
      x.set(
        withTiming(direction * width, { duration: motion.normal }, (done) => {
          if (!done) return;
          collapse.set(
            withTiming(1, { duration: motion.normal }, (finished) => {
              if (finished) scheduleOnRN(onDismiss);
            }),
          );
        }),
      );
    },
    [collapse, onDismiss, width, x],
  );

  const dismiss = useCallback(() => {
    if (reduceMotion) onDismiss();
    else slideOutAndCollapse(1);
  }, [onDismiss, reduceMotion, slideOutAndCollapse]);

  const pan = usePanGesture({
    // Horizontal only: vertical movement keeps scrolling the screen.
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      x.set(e.translationX);
    },
    onDeactivate: (e) => {
      'worklet';
      const far =
        Math.abs(e.translationX) > width * DISMISS_FRACTION ||
        Math.abs(e.velocityX) > FLICK_VELOCITY;
      if (far) slideOutAndCollapse(Math.sign(e.translationX || e.velocityX) || 1);
      else x.set(withSpring(0, { damping: 22, stiffness: 240 }));
    },
  });

  const outer = useAnimatedStyle(() =>
    collapse.get() > 0
      ? {
          overflow: 'hidden',
          height: height.get() * (1 - collapse.get()),
          marginBottom: -gap * collapse.get(),
          opacity: 1 - collapse.get(),
        }
      : {},
  );
  const inner = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: 1 - Math.min(Math.abs(x.get()) / width, 1) * 0.7,
  }));

  return (
    <Animated.View
      style={[styles.stack, { gap }, outer]}
      onLayout={(e) => {
        if (collapse.get() === 0) height.set(e.nativeEvent.layout.height);
      }}
    >
      {above}
      <GestureDetector gesture={pan}>
        <Animated.View style={inner}>{children(dismiss)}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ stack: { flexDirection: 'column' } });
