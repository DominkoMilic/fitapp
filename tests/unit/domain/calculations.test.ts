/**
 * Calculation test vectors from spec section 29.2 (C11–C13, C14–C16).
 * These are normative: if one fails, the implementation is wrong, not the test.
 */
import {
  ageOn,
  bmi,
  feetInchesToCm,
  kgToLb,
  projectGoalDate,
  toStoredCm,
  weightAtBmi,
} from '@/domain/calculations';

describe('units and age', () => {
  it('C11 6 ft 2 in = 187.96 cm, stored 188.0; 108 kg = 238.1 lb', () => {
    expect(feetInchesToCm(6, 2)).toBeCloseTo(187.96, 6);
    expect(toStoredCm(feetInchesToCm(6, 2))).toBe(188);
    expect(Math.round(kgToLb(108) * 10) / 10).toBe(238.1);
  });
  it('C12 the day before a birthday', () => expect(ageOn('2003-11-09', '2026-11-08')).toBe(22));
  it('C13 Feb 29 birthday counts on Mar 1 in non-leap years', () => {
    expect(ageOn('2000-02-29', '2025-03-01')).toBe(25);
    expect(ageOn('2000-02-29', '2025-02-28')).toBe(24);
    expect(ageOn('2000-02-29', '2024-02-29')).toBe(24);
  });
});

describe('BMI', () => {
  it('108 kg at 187 cm ≈ 30.9; BMI 18.5 at 187 cm ≈ 64.7 kg', () => {
    expect(bmi(108, 187)).toBeCloseTo(30.88, 2);
    expect(weightAtBmi(18.5, 187)).toBeCloseTo(64.69, 2);
  });
});

describe('goal date (weekly rate)', () => {
  it('C14 108 → 90 kg at 0.5 %/week: 0.54 kg/week, ≈33 weeks, range 27–44 weeks', () => {
    const p = projectGoalDate({
      currentWeightKg: 108,
      targetWeightKg: 90,
      weeklyRatePct: 0.5,
      asOf: '2026-11-09',
    })!;
    expect(p.expectedRateKgPerWeek).toBeCloseTo(0.54, 6);
    expect(p.weeks.mid).toBeCloseTo(33.33, 2);
    expect(p.weeks.fast).toBeCloseTo(26.67, 2);
    expect(p.weeks.slow).toBeCloseTo(44.44, 2);
    expect(p.dates.mid).toBe('2027-06-30');
    expect(p.dates.earliest < p.dates.mid && p.dates.mid < p.dates.latest).toBe(true);
  });

  it('C15 no date without a target, a rate, or anything left to lose', () => {
    const base = { currentWeightKg: 80, asOf: '2026-11-09' };
    expect(projectGoalDate({ ...base, targetWeightKg: null, weeklyRatePct: 0.5 })).toBeNull();
    expect(projectGoalDate({ ...base, targetWeightKg: 75, weeklyRatePct: null })).toBeNull();
    expect(projectGoalDate({ ...base, targetWeightKg: 75, weeklyRatePct: 0 })).toBeNull();
    expect(projectGoalDate({ ...base, targetWeightKg: 80, weeklyRatePct: 0.5 })).toBeNull();
    expect(projectGoalDate({ ...base, targetWeightKg: 85, weeklyRatePct: 0.5 })).toBeNull();
  });

  it('C16 a faster rate gives an earlier date', () => {
    const at = (rate: number) =>
      projectGoalDate({
        currentWeightKg: 90,
        targetWeightKg: 80,
        weeklyRatePct: rate,
        asOf: '2026-11-09',
      })!.dates.mid;
    expect(at(1.0) < at(0.5)).toBe(true);
  });
});
