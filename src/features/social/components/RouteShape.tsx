import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { radius, useTheme } from '@/theme';

/**
 * The line of a shared route (spec 33): no map, streets or location behind it, only the shape in
 * a 0–1000 box, scaled to fit. Start dot hollow, finish dot filled.
 */
export function RouteShape({ shape, height = 120 }: { shape: number[][][]; height?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const pad = 10;
  const pts = shape.flat();
  const maxX = Math.max(...pts.map((p) => p[0]!));
  const maxY = Math.max(...pts.map((p) => p[1]!));
  const s = width ? Math.min((width - 2 * pad) / (maxX || 1), (height - 2 * pad) / (maxY || 1)) : 0;
  const ox = (width - maxX * s) / 2;
  const oy = (height - maxY * s) / 2;
  const at = (p: number[]) => ({ x: ox + p[0]! * s, y: oy + p[1]! * s });
  const first = pts[0] ? at(pts[0]) : null;
  const last = pts[pts.length - 1] ? at(pts[pts.length - 1]!) : null;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.box, { height, backgroundColor: colors.background }]}
      accessible
      accessibilityLabel="Route shape"
    >
      {width ? (
        <Svg width={width} height={height}>
          {shape.map((piece, i) => (
            <Polyline
              key={i}
              points={piece.map((p) => `${at(p).x},${at(p).y}`).join(' ')}
              fill="none"
              stroke={colors.accent}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {first ? (
            <Circle
              cx={first.x}
              cy={first.y}
              r={4}
              fill={colors.background}
              stroke={colors.accent}
              strokeWidth={2}
            />
          ) : null}
          {last ? <Circle cx={last.x} cy={last.y} r={4} fill={colors.accent} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ box: { borderRadius: radius.input, overflow: 'hidden' } });
