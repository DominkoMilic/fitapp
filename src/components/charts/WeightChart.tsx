import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui/Text';
import { addDays, dayNumber, type IsoDate } from '@/domain/calculations/dates';
import {
  dailyLinePaths,
  linearScale,
  niceDomain,
  segments,
  spreadLabels,
  weightYDomain,
} from '@/domain/charts/scale';
import { timeTicks } from '@/domain/charts/time';
import type { DailyValue } from '@/domain/weight/trend';
import { averageSeries } from '@/domain/weight/trend';
import { motion, spacing, useTheme } from '@/theme';
import { formatDayMonth } from '@/domain/format';

export interface ReferenceLine {
  label: string;
  kg: number;
  kind: 'start' | 'target' | 'secondary';
}

const HEIGHT = 220;
const PAD = { left: 58, right: 30, top: 16, bottom: 26 };
/** Above this many days in view, the daily line is drawn without a dot on every day. */
const MAX_DOTS = 45;
/** Roughly how much room one x-axis label needs. */
const LABEL_WIDTH = 56;
/** Height of a two-line y-axis tag ("Start" over "108.0"). */
const TAG_HEIGHT = 26;

/**
 * Weight chart, kept deliberately quiet: daily weights as a line (dashed across gaps of more than
 * 7 days), the 7-day average on top, and no lines across the plot. The y-axis runs from the target
 * (bottom) to about the start (top), growing when a weight goes past either; only "Start" and
 * "Target" are tagged on the left. The x-axis labels follow the span. `daily` must already be
 * filtered to the selected range; the axis runs from the first value in view (at least a week
 * back, never before `from`) to `to`. Tap or drag to read a day. Values in `toDisplay` units.
 */
export function WeightChart({
  daily,
  allDaily,
  references,
  toDisplay,
  unitLabel,
  summary,
  from,
  to,
}: {
  daily: readonly DailyValue[];
  /** Full history, so averages at the start of the range use earlier days. */
  allDaily: readonly DailyValue[];
  references: readonly ReferenceLine[];
  toDisplay: (kg: number) => number;
  unitLabel: string;
  summary: string;
  from?: IsoDate | null;
  to?: IsoDate | null;
}) {
  const { colors, reduceMotion } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!daily.length || width === 0) return null;
    const lastDate = to && to > daily[daily.length - 1]!.date ? to : daily[daily.length - 1]!.date;
    // Start at the first weigh-in in the period (not e.g. 1 January when tracking began in
    // August), so the data fills the chart; but always show at least a week.
    const weekBack = addDays(lastDate, -6);
    const firstDate =
      daily[0]!.date <= weekBack ? daily[0]!.date : from && from > weekBack ? from : weekBack;
    const d0 = dayNumber(firstDate);
    const d1 = dayNumber(lastDate);
    const avgByDate = new Map(averageSeries(allDaily).map((p) => [p.date, p.avg]));
    const avgPoints = daily.map((d) => ({ date: d.date, avg: avgByDate.get(d.date) ?? null }));
    const values = [
      ...daily.map((d) => toDisplay(d.kg)),
      ...avgPoints.flatMap((p) => (p.avg === null ? [] : [toDisplay(p.avg)])),
    ];
    const ref = (kind: ReferenceLine['kind']) => {
      const r = references.find((x) => x.kind === kind);
      return r ? toDisplay(r.kg) : null;
    };
    const [lo, hi] = weightYDomain({
      values,
      startKg: ref('start'),
      targetKg: ref('target'),
      secondaryKg: ref('secondary'),
    });
    // Round steps for the scale (e.g. 85 · 90 · … · 110 for target 87 and start 108).
    const scale = niceDomain(lo, hi, 7);
    const [y0, y1] = [scale.min, scale.max];
    const x = linearScale(d0 === d1 ? [d0 - 1, d1 + 1] : [d0, d1], [PAD.left, width - PAD.right]);
    const y = linearScale([y0, y1], [HEIGHT - PAD.bottom, PAD.top]);

    // Y-axis tags: the goal's start and target (and 2nd target); without a goal, the lowest and
    // highest weight in view.
    const rawTags = references.length
      ? references.map((r) => ({
          name: r.kind === 'start' ? 'Start' : r.kind === 'target' ? 'Target' : '2nd',
          value: toDisplay(r.kg),
          kind: r.kind,
        }))
      : [
          { name: 'High', value: Math.max(...values), kind: 'start' as const },
          { name: 'Low', value: Math.min(...values), kind: 'target' as const },
        ];
    const tagYs = spreadLabels(
      rawTags.map((t) => y(t.value)),
      TAG_HEIGHT,
      PAD.top + TAG_HEIGHT / 2 - 6,
      HEIGHT - PAD.bottom - TAG_HEIGHT / 2 + 6,
    );
    const tags = rawTags.map((t, i) => ({ ...t, axisY: y(t.value), labelY: tagYs[i]! }));

    const line = dailyLinePaths(
      daily.map((d) => ({ day: dayNumber(d.date), value: toDisplay(d.kg) })),
      x,
      y,
    );
    const avgSegments = segments(avgPoints, (p) => p.avg === null);
    // Single-point segments can't be drawn as a line; show them as dots.
    const avgDots = avgSegments
      .filter((seg) => seg.length === 1)
      .map((seg) => ({ x: x(dayNumber(seg[0]!.date)), y: y(toDisplay(seg[0]!.avg as number)) }));
    const avgPaths = avgSegments
      .filter((seg) => seg.length > 1)
      .map((seg) =>
        seg
          .map(
            (p, i) =>
              `${i === 0 ? 'M' : 'L'}${x(dayNumber(p.date)).toFixed(1)},${y(toDisplay(p.avg as number)).toFixed(1)}`,
          )
          .join(' '),
      );
    const maxLabels = Math.max(2, Math.floor((width - PAD.left - PAD.right) / LABEL_WIDTH));
    return {
      x,
      y,
      tags,
      yTicks: scale.ticks,
      xTicks: timeTicks(firstDate, lastDate, maxLabels),
      line,
      avgPaths,
      avgDots,
      avgByDate,
    };
  }, [daily, allDaily, references, toDisplay, width, from, to]);

  /** Nearest day to a horizontal position; only updates state when the day changes. */
  const selectAt = (px: number) => {
    if (!model) return;
    let best: DailyValue | null = null;
    for (const d of daily) {
      if (
        !best ||
        Math.abs(model.x(dayNumber(d.date)) - px) < Math.abs(model.x(dayNumber(best.date)) - px)
      )
        best = d;
    }
    if (best && best.date !== selected) setSelected(best.date);
  };
  // Gesture callbacks run on the UI thread and call back through a stable function, which always
  // uses the latest scales and data.
  const selectRef = useRef(selectAt);
  useEffect(() => {
    selectRef.current = selectAt;
  });
  const select = useCallback((px: number) => selectRef.current(px), []);

  // Horizontal drag owns the gesture once it starts, so the screen can't steal it halfway (it
  // used to stop mid-drag); a vertical drag still scrolls the screen. A tap selects one day.
  const pan = usePanGesture({
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onActivate: (e) => {
      'worklet';
      scheduleOnRN(select, e.x);
    },
    onUpdate: (e) => {
      'worklet';
      scheduleOnRN(select, e.x);
    },
  });
  const tap = useTapGesture({
    onActivate: (e) => {
      'worklet';
      scheduleOnRN(select, e.x);
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const sel = selected ? daily.find((d) => d.date === selected) : undefined;
  const selAvg = sel && model ? model.avgByDate.get(sel.date) : null;
  const fmt = (kg: number) => `${toDisplay(kg).toFixed(1)} ${unitLabel}`;
  const showDots = daily.length <= MAX_DOTS;
  const tagColor = (kind: ReferenceLine['kind']) =>
    kind === 'start' ? colors.textSecondary : colors.info;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} onLayout={onLayout}>
      <Text variant="small" color="textSecondary" style={styles.readout}>
        {sel
          ? `${formatDayMonth(sel.date)}: ${fmt(sel.kg)}${
              selAvg != null ? ` · 7-day avg ${fmt(selAvg)}` : ''
            }`
          : 'Tap or drag along the chart to see a day'}
      </Text>
      <GestureDetector gesture={gesture}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View
            // Fades in when the period changes (Week → Month …).
            key={`${from ?? 'all'}-${to ?? ''}`}
            entering={reduceMotion ? undefined : FadeIn.duration(motion.normal)}
          >
            <Svg width={width} height={HEIGHT}>
              {model ? (
                <>
                  {/* Grid at each round value, numbers on the right (the left holds Start/Target). */}
                  {model.yTicks.map((t) => (
                    <G key={`y-${t}`}>
                      <Line
                        x1={PAD.left}
                        x2={width - PAD.right}
                        y1={model.y(t)}
                        y2={model.y(t)}
                        stroke={colors.border}
                        strokeWidth={1}
                        opacity={0.7}
                      />
                      <SvgText
                        x={width - PAD.right + 4}
                        y={model.y(t) + 4}
                        fontSize={10}
                        fill={colors.textSecondary}
                        textAnchor="start"
                      >
                        {Number.isInteger(t) ? t : t.toFixed(1)}
                      </SvgText>
                    </G>
                  ))}
                  {/* Baseline under the data. */}
                  <Line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={HEIGHT - PAD.bottom}
                    y2={HEIGHT - PAD.bottom}
                    stroke={colors.border}
                    strokeWidth={1}
                  />
                  {model.tags.map((t) => (
                    <G key={t.name}>
                      <Line
                        x1={PAD.left - 4}
                        x2={PAD.left + 4}
                        y1={t.axisY}
                        y2={t.axisY}
                        stroke={tagColor(t.kind)}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                      <SvgText
                        x={PAD.left - 8}
                        y={t.labelY - 3}
                        fontSize={10}
                        fill={tagColor(t.kind)}
                        textAnchor="end"
                      >
                        {t.name}
                      </SvgText>
                      <SvgText
                        x={PAD.left - 8}
                        y={t.labelY + 10}
                        fontSize={11}
                        fontWeight="600"
                        fill={tagColor(t.kind)}
                        textAnchor="end"
                      >
                        {t.value.toFixed(1)}
                      </SvgText>
                    </G>
                  ))}
                  {model.xTicks.map((t) => {
                    const tx = model.x(dayNumber(t.date));
                    // Labels near an edge align inward so they are never cut off.
                    const half = (t.label.length * 6.2) / 2;
                    const anchor = tx + half > width ? 'end' : tx - half < 0 ? 'start' : 'middle';
                    return (
                      <G key={t.date}>
                        <Line
                          x1={tx}
                          x2={tx}
                          y1={HEIGHT - PAD.bottom}
                          y2={HEIGHT - PAD.bottom + 4}
                          stroke={colors.border}
                          strokeWidth={1}
                        />
                        <SvgText
                          x={anchor === 'end' ? width - 1 : anchor === 'start' ? 1 : tx}
                          y={HEIGHT - 6}
                          fontSize={11}
                          fill={colors.textSecondary}
                          textAnchor={anchor}
                        >
                          {t.label}
                        </SvgText>
                      </G>
                    );
                  })}
                  {sel ? (
                    <Line
                      x1={model.x(dayNumber(sel.date))}
                      x2={model.x(dayNumber(sel.date))}
                      y1={PAD.top}
                      y2={HEIGHT - PAD.bottom}
                      stroke={colors.textSecondary}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  ) : null}
                  {/* Daily weights: the up-and-down line (dashed across long gaps). */}
                  {model.line.dashed ? (
                    <Path
                      d={model.line.dashed}
                      stroke={colors.textSecondary}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="none"
                      opacity={0.7}
                    />
                  ) : null}
                  {model.line.solid ? (
                    <Path
                      d={model.line.solid}
                      stroke={colors.textSecondary}
                      strokeWidth={1.5}
                      fill="none"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity={0.85}
                    />
                  ) : null}
                  {showDots
                    ? daily.map((d) => (
                        <Circle
                          key={d.date}
                          cx={model.x(dayNumber(d.date))}
                          cy={model.y(toDisplay(d.kg))}
                          r={2.75}
                          fill={colors.textSecondary}
                        />
                      ))
                    : null}
                  {/* 7-day average on top: the real trend. */}
                  {model.avgDots.map((d, i) => (
                    <Circle key={`avg-${i}`} cx={d.x} cy={d.y} r={4.5} fill={colors.accent} />
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
                  {sel ? (
                    <Circle
                      cx={model.x(dayNumber(sel.date))}
                      cy={model.y(toDisplay(sel.kg))}
                      r={5.5}
                      fill={colors.textPrimary}
                      stroke={colors.surface}
                      strokeWidth={2}
                    />
                  ) : null}
                </>
              ) : null}
            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.legend}>
        <View style={[styles.dailyLine, { backgroundColor: colors.textSecondary }]}>
          <View style={[styles.dailyDot, { backgroundColor: colors.textSecondary }]} />
        </View>
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
  dailyLine: { width: 16, height: 1.5, alignItems: 'center', justifyContent: 'center' },
  dailyDot: { width: 6, height: 6, borderRadius: 3 },
  line: { width: 16, height: 3, borderRadius: 2, marginLeft: spacing.sm },
});
