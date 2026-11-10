/**
 * Weight trend maths (spec 8.9, 13.2, 13.3). Pure; dates are ISO local dates.
 */
import { addDays, dayNumber, type IsoDate } from '@/domain/calculations/dates';

export interface WeightEntryLike {
  local_date: IsoDate;
  weight_kg: number | string;
}

export interface DailyValue {
  date: IsoDate;
  kg: number;
  /** Number of raw entries that day. */
  count: number;
}

export const ROLLING_WINDOW_DAYS = 7;
export const MIN_VALUES_FOR_AVERAGE = 3;

/** One value per local day: the mean of that day's entries (spec 8.9). */
export function dailyValues(entries: readonly WeightEntryLike[]): DailyValue[] {
  const byDate = new Map<IsoDate, number[]>();
  for (const e of entries) {
    const kg = Number(e.weight_kg);
    if (!Number.isFinite(kg)) continue;
    byDate.set(e.local_date, [...(byDate.get(e.local_date) ?? []), kg]);
  }
  return [...byDate.entries()]
    .map(([date, values]) => ({
      date,
      kg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 7-day rolling average ending on `date`: mean of daily values in [date-6, date], ≥ 3 values. */
export function rollingAverageAt(daily: readonly DailyValue[], date: IsoDate): number | null {
  const from = addDays(date, -(ROLLING_WINDOW_DAYS - 1));
  const window = daily.filter((d) => d.date >= from && d.date <= date);
  if (window.length < MIN_VALUES_FOR_AVERAGE) return null;
  return window.reduce((a, d) => a + d.kg, 0) / window.length;
}

/** Average line for the chart: one point per day with data; null breaks the line. */
export function averageSeries(
  daily: readonly DailyValue[],
): { date: IsoDate; avg: number | null }[] {
  return daily.map((d) => ({ date: d.date, avg: rollingAverageAt(daily, d.date) }));
}

export interface CurrentWeight {
  kg: number;
  date: IsoDate;
  basis: 'average' | 'single';
}

/** Best current estimate: 7-day average at the latest entry, else the latest daily value. */
export function currentWeight(daily: readonly DailyValue[]): CurrentWeight | null {
  const last = daily[daily.length - 1];
  if (!last) return null;
  const avg = rollingAverageAt(daily, last.date);
  return avg === null
    ? { kg: last.kg, date: last.date, basis: 'single' }
    : { kg: avg, date: last.date, basis: 'average' };
}

/**
 * Change of the 7-day average over `days` (e.g. 7 or 30), ending at the latest entry.
 * Null when either end has no average (missing data is not zero).
 */
export function averageChange(daily: readonly DailyValue[], days: number): number | null {
  const last = daily[daily.length - 1];
  if (!last) return null;
  const end = rollingAverageAt(daily, last.date);
  const start = rollingAverageAt(daily, addDays(last.date, -days));
  return end === null || start === null ? null : end - start;
}

export interface Trend {
  slopeKgPerWeek: number;
  values: number;
  spanDays: number;
}

/** OLS slope of daily values over the last 21 days; needs ≥ 10 values spanning ≥ 14 days. */
export function trendLast21Days(daily: readonly DailyValue[], today: IsoDate): Trend | null {
  const from = addDays(today, -20);
  const pts = daily.filter((d) => d.date >= from && d.date <= today);
  if (pts.length < 10) return null;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const spanDays = dayNumber(last.date) - dayNumber(first.date);
  if (spanDays < 14) return null;
  const xs = pts.map((p) => dayNumber(p.date));
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i]! - my);
    den += (x - mx) ** 2;
  });
  if (den === 0) return null;
  return { slopeKgPerWeek: (num / den) * 7, values: pts.length, spanDays };
}

/** Goal progress 0–100 % (spec 13.3). */
export function goalProgressPct(startKg: number, currentKg: number, targetKg: number): number {
  if (startKg === targetKg) return 100;
  const pct = ((startKg - currentKg) / (startKg - targetKg)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** Estimated date range to reach the target from the observed trend; null without a downward trend. */
export function estimateTargetDates(input: {
  currentKg: number;
  targetKg: number;
  trend: Trend | null;
  today: IsoDate;
}): { earliest: IsoDate; latest: IsoDate } | null {
  const { trend } = input;
  if (!trend || trend.slopeKgPerWeek >= -0.05) return null;
  const toLose = input.currentKg - input.targetKg;
  if (toLose <= 0) return null;
  const rate = -trend.slopeKgPerWeek;
  return {
    earliest: addDays(input.today, Math.round((toLose / (rate * 1.25)) * 7)),
    latest: addDays(input.today, Math.round((toLose / (rate * 0.75)) * 7)),
  };
}

/** True when a new weight is far from the recent average (likely typo: 180 vs 108). */
export function isSuspiciousWeight(newKg: number, referenceKg: number | null): boolean {
  if (referenceKg === null) return false;
  const diff = Math.abs(newKg - referenceKg);
  return diff > 3 || diff / referenceKg > 0.03;
}
