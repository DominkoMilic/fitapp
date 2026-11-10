import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion, radius, TOUCH_TARGET, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { labelProps, Text } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

type Box = { x: number; width: number };

/**
 * Single-choice row of segments. The selected highlight slides to the new segment instead of
 * jumping (no animation with reduce motion on).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const { colors, reduceMotion } = useTheme();
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const target = value === null ? undefined : boxes[value];
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  // Whether the indicator has been placed once (the first placement doesn't animate).
  const placed = useRef(false);

  useEffect(() => {
    if (!target) return;
    if (!placed.current || reduceMotion) {
      x.set(target.x);
      width.set(target.width);
      placed.current = true;
      return;
    }
    x.set(withTiming(target.x, { duration: motion.normal }));
    width.set(withTiming(target.width, { duration: motion.normal }));
  }, [target, reduceMotion, x, width]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    width: width.get(),
  }));
  // Until the segments are measured, the selected one keeps its own background.
  const sliding = !!target;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
    >
      {sliding ? (
        <Animated.View
          pointerEvents="none"
          testID="segment-indicator"
          style={[styles.indicator, { backgroundColor: colors.accent }, indicator]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic={selected ? null : 'selection'}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            onLayout={(e) => {
              const { x: bx, width: bw } = e.nativeEvent.layout;
              setBoxes((b) =>
                b[o.value]?.x === bx && b[o.value]?.width === bw
                  ? b
                  : { ...b, [o.value]: { x: bx, width: bw } },
              );
            }}
            style={[
              styles.segment,
              selected && !sliding ? { backgroundColor: colors.accent } : null,
            ]}
          >
            <Text
              variant="small"
              align="center"
              style={{ color: selected ? colors.onAccent : colors.textPrimary, fontWeight: '600' }}
              {...labelProps(o.label)}
            >
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: radius.button, borderWidth: 1, padding: 3, gap: 3 },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: radius.button - 3,
  },
  segment: {
    // Share the row by label length, so "Breakfast" gets more room than "Any".
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minHeight: TOUCH_TARGET,
    borderRadius: radius.button - 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
