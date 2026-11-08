import { addDays } from '@/domain/calculations/dates';
import { linearScale, niceTicks, segments, yDomain } from '@/domain/charts/scale';
import {
  averageChange,
  averageSeries,
  currentWeight,
  dailyValues,
  estimateTargetDates,
  goalProgressPct,
  isSuspiciousWeight,
  observedTdee,
  rollingAverageAt,
  trendLast21Days,
} from '@/domain/weight/trend';

const series = (start: string, values: number[]) =>
  values.map((kg, i) => ({ local_date: addDays(start, i), weight_kg: kg }));

describe('weight vectors (spec 29.3)', () => {
  it('W1 7-day average = 107.67', () => {
    const d = dailyValues(series('2026-11-01', [108.0, 107.6, 108.2, 107.4, 107.8, 107.2, 107.5]));
    expect(rollingAverageAt(d, '2026-11-07')).toBeCloseTo(107.6714, 4);
    expect(Math.round(rollingAverageAt(d, '2026-11-07')! * 100) / 100).toBe(107.67);
  });
  it('W2 two entries on one day → daily value 107.5', () => {
    const d = dailyValues([
      { local_date: '2026-11-01', weight_kg: 108 },
      { local_date: '2026-11-01', weight_kg: '107.00' },
    ]);
    expect(d).toEqual([{ date: '2026-11-01', kg: 107.5, count: 2 }]);
  });
  it('W3 only two days → no average', () => {
    const d = dailyValues(series('2026-11-01', [108, 107.8]));
    expect(rollingAverageAt(d, '2026-11-02')).toBeNull();
    expect(currentWeight(d)).toEqual({ kg: 107.8, date: '2026-11-02', basis: 'single' });
  });
  it('W4 21 values falling 0.1 kg/day → slope −0.7 kg/week', () => {
    const d = dailyValues(
      series(
        '2026-11-01',
        Array.from({ length: 21 }, (_, i) => 108 - 0.1 * i),
      ),
    );
    expect(trendLast21Days(d, '2026-11-21')!.slopeKgPerWeek).toBeCloseTo(-0.7, 9);
  });
  it('W5 observed TDEE from intake and trend', () => {
    expect(observedTdee(2700, -0.2)).toBeCloseTo(2920, 6);
  });
});

describe('averages and gaps', () => {
  it('gaps longer than a week break the average line', () => {
    const d = dailyValues([
      ...series('2026-10-01', [100, 100, 100]),
      ...series('2026-10-20', [99]),
    ]);
    expect(averageSeries(d).map((p) => p.avg)).toEqual([null, null, 100, null]);
    expect(segments(averageSeries(d), (p) => p.avg === null)).toHaveLength(1);
  });
  it('change over 7 days needs averages at both ends (no data ≠ zero)', () => {
    const d = dailyValues(
      series(
        '2026-11-01',
        Array.from({ length: 14 }, (_, i) => 108 - 0.1 * i),
      ),
    );
    expect(averageChange(d, 7)).toBeCloseTo(-0.7, 9);
    expect(averageChange(d, 30)).toBeNull();
  });
  it('trend needs ≥ 10 values spanning ≥ 14 days', () => {
    expect(
      trendLast21Days(dailyValues(series('2026-11-01', Array(9).fill(100))), '2026-11-21'),
    ).toBeNull();
    expect(
      trendLast21Days(dailyValues(series('2026-11-08', Array(12).fill(100))), '2026-11-21'),
    ).toBeNull(); // 11-day span
  });
});

describe('goal statistics', () => {
  it('progress is clamped to 0–100 %', () => {
    expect(goalProgressPct(108, 103.5, 90)).toBeCloseTo(25, 9);
    expect(goalProgressPct(108, 110, 90)).toBe(0);
    expect(goalProgressPct(108, 85, 90)).toBe(100);
  });
  it('target date range only with a downward trend', () => {
    const trend = { slopeKgPerWeek: -0.5, values: 15, spanDays: 20 };
    expect(
      estimateTargetDates({ currentKg: 100, targetKg: 90, trend, today: '2026-11-08' }),
    ).toEqual({
      earliest: addDays('2026-11-08', 112),
      latest: addDays('2026-11-08', 187),
    });
    expect(
      estimateTargetDates({
        currentKg: 100,
        targetKg: 90,
        trend: { ...trend, slopeKgPerWeek: 0.1 },
        today: '2026-11-08',
      }),
    ).toBeNull();
    expect(
      estimateTargetDates({ currentKg: 100, targetKg: 90, trend: null, today: '2026-11-08' }),
    ).toBeNull();
  });
  it('flags likely typos (spec 28.4 #3)', () => {
    expect(isSuspiciousWeight(180, 108)).toBe(true);
    expect(isSuspiciousWeight(104.5, 108)).toBe(true);
    expect(isSuspiciousWeight(107.2, 108)).toBe(false);
    expect(isSuspiciousWeight(70, null)).toBe(false);
  });
});

describe('chart scales', () => {
  it('maps linearly', () => {
    const s = linearScale([100, 110], [200, 0]);
    expect(s(100)).toBe(200);
    expect(s(105)).toBe(100);
  });
  it('produces round ticks', () => {
    expect(niceTicks(87.3, 108.6, 4)).toEqual([90, 95, 100, 105]);
    expect(niceTicks(5, 5)).toEqual([5]);
  });
  it('pads tiny ranges', () => {
    const [lo, hi] = yDomain([100, 100.2]);
    expect(hi - lo).toBeGreaterThanOrEqual(2);
  });
});
