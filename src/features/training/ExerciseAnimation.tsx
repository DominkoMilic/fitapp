import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import {
  BONES,
  FLOOR_Y,
  motionFor,
  poseAt,
  skeletonOf,
  skeletonPaths,
} from '@/domain/training/motion/poses';
import { radius, useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** Box height ÷ width: wide enough for floor exercises, tall enough for standing ones. */
const BOX_ASPECT = 0.8;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** True when the exercise has an animation (so callers can lay out around it). */
export const hasExerciseAnimation = (slug: string): boolean => motionFor(slug) !== null;

/**
 * Looping stick-figure demo of an exercise (2026-11-12). Fixed size, so it never shifts the
 * layout mid-workout. Tap to pause or play. With Reduce Motion on, it shows the working pose
 * still. Renders nothing for exercises without a pattern (never a misleading animation).
 */
export function ExerciseAnimation({
  slug,
  size = 140,
  name,
}: {
  slug: string;
  size?: number;
  /** For the accessibility label. */
  name?: string;
}) {
  const motion = useMemo(() => motionFor(slug), [slug]);
  const { colors, reduceMotion } = useTheme();
  const [paused, setPaused] = useState(false);
  const t = useSharedValue(reduceMotion ? 1 : 0);

  const n = motion?.keys.length ?? 1;
  const tempo = motion?.pattern.tempoMs ?? 1000;
  const still = reduceMotion || paused;
  useEffect(() => {
    if (!motion) return;
    if (still) {
      cancelAnimation(t);
      if (reduceMotion) t.set(1); // the working pose (bottom of a squat, top of a raise)
      return;
    }
    // Continue from where it paused, then loop 0 → n forever.
    const start = t.get() % n;
    const left = ((n - start) / n) * tempo;
    t.set(
      withTiming(n, { duration: left, easing: Easing.linear }, (done) => {
        if (done) {
          t.set(0);
          t.set(withRepeat(withTiming(n, { duration: tempo, easing: Easing.linear }), -1, false));
        }
      }),
    );
    return () => cancelAnimation(t);
  }, [motion, still, reduceMotion, n, tempo, t]);

  const keys = motion?.keys ?? [];
  const anchorJoint = motion?.anchorJoint ?? 0;
  const anchorX = motion?.anchorX ?? 0;
  const anchorY = motion?.anchorY ?? null;

  const nearProps = useAnimatedProps(() => {
    if (!keys.length) return { d: '' };
    const s = skeletonOf(poseAt(keys, t.get()), anchorJoint, anchorX, anchorY);
    return { d: skeletonPaths(s).near };
  });
  const farProps = useAnimatedProps(() => {
    if (!keys.length) return { d: '' };
    const s = skeletonOf(poseAt(keys, t.get()), anchorJoint, anchorX, anchorY);
    return { d: skeletonPaths(s).far };
  });
  const headProps = useAnimatedProps(() => {
    if (!keys.length) return { cx: 0, cy: 0 };
    const s = skeletonOf(poseAt(keys, t.get()), anchorJoint, anchorX, anchorY);
    return { cx: s.head[0], cy: s.head[1] };
  });

  if (!motion) return null;
  const f = motion.frame;
  // Line widths in view units: keep them about the same on screen whatever the zoom.
  const stroke = Math.max(3, Math.min(4.6, f.h / 30));
  const label = `Animation of ${name ?? 'the exercise'}${still ? ', paused' : ''}. Tap to ${paused ? 'play' : 'pause'}.`;
  return (
    <Pressable
      onPress={() => setPaused((p) => !p)}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={reduceMotion}
      style={[
        styles.box,
        {
          width: size,
          height: Math.round(size * BOX_ASPECT),
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
        },
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`}
        preserveAspectRatio="xMidYMax meet"
      >
        <Line
          x1={Math.min(f.x, f.x + f.w / 2 - f.h / BOX_ASPECT / 2)}
          x2={Math.max(f.x + f.w, f.x + f.w / 2 + f.h / BOX_ASPECT / 2)}
          y1={FLOOR_Y + stroke / 2}
          y2={FLOOR_Y + stroke / 2}
          stroke={colors.border}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {motion.pattern.prop === 'bar' && motion.anchorY !== null ? (
          <Line
            x1={f.x + 4}
            x2={f.x + f.w - 4}
            y1={motion.anchorY}
            y2={motion.anchorY}
            stroke={colors.textSecondary}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}
        <AnimatedPath
          animatedProps={farProps}
          stroke={colors.accent}
          strokeOpacity={0.4}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <AnimatedPath
          animatedProps={nearProps}
          stroke={colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <AnimatedCircle animatedProps={headProps} r={BONES.headR} fill={colors.accent} />
      </Svg>
      {paused ? (
        <View style={[styles.pausedDot, { backgroundColor: colors.textSecondary }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pausedDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
});
