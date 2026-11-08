import { checkinGuidance, type CheckinValues, validateCheckin } from '@/domain/checkin/checkin';
import { isValidMeasurement, summarizeMeasurements } from '@/domain/measurements/measurements';

describe('measurements', () => {
  const row = (type: string, cm: number, date: string, at = `${date}T07:00:00Z`) => ({
    measurement_type: type,
    value_cm: cm,
    local_date: date,
    measured_at: at,
  });
  it('summarises latest value and change since first', () => {
    const s = summarizeMeasurements([
      row('waist', 110, '2026-11-01'),
      row('waist', 108.5, '2026-11-15'),
      row('waist', '107.0' as unknown as number, '2026-11-29'),
      row('neck', 43, '2026-11-01'),
    ]);
    const waist = s.find((x) => x.type === 'waist')!;
    expect(waist.latestCm).toBe(107);
    expect(waist.changeCm).toBeCloseTo(-3, 9);
    expect(waist.series).toHaveLength(3);
    expect(s.find((x) => x.type === 'neck')!.changeCm).toBeNull(); // one entry: no change, not zero
  });
  it('keeps the latest entry when a type is measured twice on one day', () => {
    const s = summarizeMeasurements([
      row('hips', 112, '2026-11-01', '2026-11-01T07:00:00Z'),
      row('hips', 111, '2026-11-01', '2026-11-01T08:00:00Z'),
    ]);
    expect(s[0]!.series).toEqual([{ date: '2026-11-01', cm: 111 }]);
  });
  it('ignores unknown types and validates the range', () => {
    expect(summarizeMeasurements([row('ankle', 30, '2026-11-01')])).toEqual([]);
    expect(isValidMeasurement(9.9)).toBe(false);
    expect(isValidMeasurement(104.5)).toBe(true);
    expect(isValidMeasurement(251)).toBe(false);
  });
});

describe('daily check-in', () => {
  const base: CheckinValues = {
    sleepHours: 7.5,
    fatigue: 2,
    soreness: 2,
    pain: 0,
    painArea: null,
    note: '',
  };
  it('accepts a normal check-in', () => {
    expect(validateCheckin(base)).toEqual([]);
    expect(checkinGuidance(base)).toBeNull();
  });
  it('pain needs a body area', () =>
    expect(validateCheckin({ ...base, pain: 3 })).toContain('pain_area_missing'));
  it('rejects out-of-range values and empty check-ins', () => {
    expect(validateCheckin({ ...base, sleepHours: 25 })).toContain('sleep_range');
    expect(validateCheckin({ ...base, fatigue: 6 })).toContain('fatigue_range');
    expect(
      validateCheckin({
        sleepHours: null,
        fatigue: null,
        soreness: null,
        pain: null,
        painArea: null,
        note: ' ',
      }),
    ).toContain('empty');
  });
  it('pain ≥ 4 → rest that area, never "push through" (spec 3.1 #8)', () => {
    const g = checkinGuidance({ ...base, pain: 4, painArea: 'ankle_foot' });
    expect(g?.tone).toBe('warning');
    expect(g?.message).toMatch(/Rest that area/);
    expect(g?.message.toLowerCase()).not.toMatch(/push through|train through/);
    expect(checkinGuidance({ ...base, pain: 3, painArea: 'knee' })).toBeNull();
  });
  it('tiredness suggests an easier session', () => {
    expect(checkinGuidance({ ...base, fatigue: 4 })?.tone).toBe('info');
    expect(checkinGuidance({ ...base, sleepHours: 5.5 })?.tone).toBe('info');
  });
});
