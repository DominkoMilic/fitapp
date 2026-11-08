import { useMemo, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { linearScale, niceTicks, segments, yDomain } from '@/domain/charts/scale';
import type { DailyValue } from '@/domain/weight/trend';
import { averageSeries } from '@/domain/weight/trend';
import { spacing, useTheme } from '@/theme';

export interface ReferenceLine {
  label: string;
  kg: number;
  kind: 'start' | 'target' | 'secondary';
}

const HEIGHT = 220;
const PAD = { left: 40, right: 12, top: 12, bottom: 24 };
const dayNum = (d: string) =>
  Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;

/**
 * Weight chart: daily values (points), 7-day average (line, broken across gaps), and reference
 * lines. `daily` must already be filtered to the selected range. Values are shown in `toDisplay`
 * units (kg or lb).
 */
export function WeightChart({
  daily,
  allDaily,
  references,
  toDisplay,
  unitLabel,
  summary,
}: {
  daily: readonly DailyValue[];
  /** Full history, so averages at the start of the range use earlier days. */
  allDaily: readonly DailyValue[];
  references: readonly ReferenceLine[];
  toDisplay: (kg: number) => number;
  unitLabel: string;
  summary: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!daily.length || width === 0) return null;
    const first = daily[0]!.date;
    const last = daily[daily.length - 1]!.date;
    const avgByDate = new Map(averageSeries(allDaily).map((p) => [p.date, p.avg]));
    const avgPoints = daily.map((d) => ({ date: d.date, avg: avgByDate.get(d.date) ?? null }));
    const refs = references.map((r) => toDisplay(r.kg));
    const values = [...daily.map((d) => toDisplay(d.kg)), ...refs];
    const [y0, y1] = yDomain(values, 2);
    const x = linearScale(
      first === last ? [dayNum(first) - 1, dayNum(last) + 1] : [dayNum(first), dayNum(last)],
      [PAD.left, width - PAD.right],
    );
    const y = linearScale([y0, y1], [HEIGHT - PAD.bottom, PAD.top]);
    const avgPaths = segments(avgPoints, (p) => p.avg === null).map((seg) =>
      seg
        .map(
          (p, i) =>
            `${i === 0 ? 'M' : 'L'}${x(dayNum(p.date)).toFixed(1)},${y(toDisplay(p.avg as number)).toFixed(1)}`,
        )
        .join(' '),
    );
    return { x, y, ticks: niceTicks(y0, y1, 4), avgPaths, avgByDate, first, last };
  }, [daily, allDaily, references, toDisplay, width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onPress = (e: GestureResponderEvent) => {
    if (!model) return;
    const px = e.nativeEvent.locationX;
    let best: DailyValue | null = null;
    for (const d of daily) {
      if (
        !best ||
        Math.abs(model.x(dayNum(d.date)) - px) < Math.abs(model.x(dayNum(best.date)) - px)
      )
        best = d;
    }
    setSelected(best?.date ?? null);
  };

  const sel = selected ? daily.find((d) => d.date === selected) : undefined;
  const selAvg = sel && model ? model.avgByDate.get(sel.date) : null;
  const fmt = (kg: number) => `${toDisplay(kg).toFixed(1)} ${unitLabel}`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} onLayout={onLayout}>
      <Text variant="small" color="textSecondary" style={styles.readout}>
        {sel
          ? `${new Date(`${sel.date}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${fmt(sel.kg)}${
              selAvg != null ? ` · 7-day avg ${fmt(selAvg)}` : ''
            }`
          : 'Tap the chart to see a day'}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={width} height={HEIGHT}>
          {model ? (
            <>
              {model.ticks.map((t) => (
                <G key={t}>
                  <Line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={model.y(t)}
                    y2={model.y(t)}
                    stroke={colors.border}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={PAD.left - 6}
                    y={model.y(t) + 4}
                    fontSize={11}
                    fill={colors.textSecondary}
                    textAnchor="end"
                  >
                    {Number.isInteger(t) ? t : t.toFixed(1)}
                  </SvgText>
                </G>
              ))}
              {references.map((r) => (
                <G key={r.kind}>
                  <Line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={model.y(toDisplay(r.kg))}
                    y2={model.y(toDisplay(r.kg))}
                    stroke={r.kind === 'start' ? colors.textSecondary : colors.info}
                    strokeWidth={1.5}
                    strokeDasharray={
                      r.kind === 'start' ? undefined : r.kind === 'target' ? '6 4' : '2 4'
                    }
                  />
                  <SvgText
                    x={width - PAD.right}
                    y={model.y(toDisplay(r.kg)) - 4}
                    fontSize={10}
                    fill={r.kind === 'start' ? colors.textSecondary : colors.info}
                    textAnchor="end"
                  >
                    {r.label}
                  </SvgText>
                </G>
              ))}
              {daily.map((d) => (
                <Circle
                  key={d.date}
                  cx={model.x(dayNum(d.date))}
                  cy={model.y(toDisplay(d.kg))}
                  r={d.date === selected ? 5 : 3}
                  fill={d.date === selected ? colors.textPrimary : colors.textSecondary}
                  opacity={0.9}
                />
              ))}
              {model.avgPaths.map((p, i) => (
                <Path
                  key={i}
                  d={p}
                  stroke={colors.accent}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              <SvgText x={PAD.left} y={HEIGHT - 6} fontSize={11} fill={colors.textSecondary}>
                {model.first}
              </SvgText>
              <SvgText
                x={width - PAD.right}
                y={HEIGHT - 6}
                fontSize={11}
                fill={colors.textSecondary}
                textAnchor="end"
              >
                {model.last}
              </SvgText>
            </>
          ) : null}
        </Svg>
      </Pressable>
      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: colors.textSecondary }]} />
        <Text variant="caption" color="textSecondary">
          Daily weight
        </Text>
        <View style={[styles.line, { backgroundColor: colors.accent }]} />
        <Text variant="caption" color="textSecondary">
          7-day average
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { minHeight: 20 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 16, height: 3, borderRadius: 2, marginLeft: spacing.sm },
});
