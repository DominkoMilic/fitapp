import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { linearScale, yDomain } from '@/domain/charts/scale';
import { useTheme } from '@/theme';

const dayNum = (d: string) =>
  Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;

/** Compact trend line for a dated series (e.g. a measurement). */
export function MiniLineChart({
  points,
  height = 64,
  summary,
}: {
  points: { date: string; value: number }[];
  height?: number;
  summary: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const pad = 6;
  let path = '';
  let dots: { x: number; y: number }[] = [];
  if (points.length && width) {
    const xs = points.map((p) => dayNum(p.date));
    const x = linearScale(
      xs.length > 1 ? [Math.min(...xs), Math.max(...xs)] : [xs[0]! - 1, xs[0]! + 1],
      [pad, width - pad],
    );
    const y = linearScale(
      yDomain(
        points.map((p) => p.value),
        1,
      ),
      [height - pad, pad],
    );
    dots = points.map((p) => ({ x: x(dayNum(p.date)), y: y(p.value) }));
    path = dots
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`)
      .join(' ');
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Svg width={width} height={height}>
        {path ? <Path d={path} stroke={colors.accent} strokeWidth={2} fill="none" /> : null}
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={2.5} fill={colors.accent} />
        ))}
      </Svg>
    </View>
  );
}
