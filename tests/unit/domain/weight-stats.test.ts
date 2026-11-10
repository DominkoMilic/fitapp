import { niceDomain, spreadLabels, weightYDomain } from '@/domain/charts/scale';
import { changePasswordSchema, passwordChecks } from '@/domain/validation/auth';
import { changeTone } from '@/domain/weight/tone';

describe('weightYDomain', () => {
  const within = ([lo, hi]: [number, number], a: number, b: number) => {
    expect(lo).toBeLessThanOrEqual(a);
    expect(hi).toBeGreaterThanOrEqual(b);
  };
  it('runs from the target at the bottom to the start at the top', () => {
    const d = weightYDomain({ values: [104, 103, 102], startKg: 108, targetKg: 90 });
    within(d, 90, 108);
    expect(d[0]).toBeGreaterThan(89); // little padding: the target sits near the bottom
    expect(d[1]).toBeLessThan(109);
  });
  it('grows when a weight goes past the start or below the target', () => {
    within(weightYDomain({ values: [110.4], startKg: 108, targetKg: 90 }), 90, 110.4);
    within(weightYDomain({ values: [88.5], startKg: 108, targetKg: 90 }), 88.5, 108);
  });
  it('works for muscle gain (target above start) and without a goal', () => {
    within(weightYDomain({ values: [72], startKg: 70, targetKg: 76 }), 70, 76);
    within(weightYDomain({ values: [80, 81] }), 80, 81);
  });
  it('keeps a minimum span and survives empty input', () => {
    const [lo, hi] = weightYDomain({ values: [80] });
    expect(hi - lo).toBeGreaterThanOrEqual(2);
    expect(weightYDomain({ values: [] })).toEqual([0, 1]);
  });
});

describe('spreadLabels', () => {
  it('pushes overlapping labels apart and keeps them in bounds', () => {
    const out = spreadLabels([100, 105], 26, 0, 200);
    expect(out[1]! - out[0]!).toBeGreaterThanOrEqual(26);
    expect(spreadLabels([195, 198], 26, 0, 200).every((y) => y <= 200)).toBe(true);
  });
  it('leaves well-spaced labels alone, in input order', () => {
    expect(spreadLabels([150, 20], 26, 0, 200)).toEqual([150, 20]);
  });
});

describe('changeTone', () => {
  it('losing weight is progress for a lose-weight goal', () => {
    expect(changeTone(-2.6, 'lose_weight')).toEqual({ direction: 'down', tone: 'toward' });
    expect(changeTone(1.2, 'lose_weight')).toEqual({ direction: 'up', tone: 'away' });
  });
  it('gaining is progress for a muscle-gain goal', () => {
    expect(changeTone(0.8, 'build_muscle')).toEqual({ direction: 'up', tone: 'toward' });
    expect(changeTone(-0.5, 'build_muscle')).toEqual({ direction: 'down', tone: 'away' });
  });
  it('is neutral for maintenance, small changes and no data', () => {
    expect(changeTone(-1, 'maintain').tone).toBe('neutral');
    expect(changeTone(0.05, 'lose_weight')).toEqual({ direction: 'flat', tone: 'neutral' });
    expect(changeTone(null, 'lose_weight')).toEqual({ direction: 'flat', tone: 'neutral' });
  });
});

describe('niceDomain', () => {
  it('keeps steps of 5 for a year of data (87–111 → 85 … 115)', () => {
    expect(niceDomain(86.1, 111.9, 7)).toMatchObject({ min: 85, max: 115, step: 5 });
  });
  it('rounds target 87 / start 108 to 85 … 110 in steps of 5', () => {
    const [lo, hi] = weightYDomain({ values: [104], startKg: 108, targetKg: 87 });
    expect(niceDomain(lo, hi)).toEqual({
      min: 85,
      max: 110,
      step: 5,
      ticks: [85, 90, 95, 100, 105, 110],
    });
  });
  it('uses smaller steps for narrow ranges', () => {
    const d = niceDomain(80.4, 83.1);
    expect(d.step).toBeLessThanOrEqual(1);
    expect(d.min).toBeLessThanOrEqual(80.4);
    expect(d.max).toBeGreaterThanOrEqual(83.1);
  });
  it('never exceeds the tick budget and survives odd input', () => {
    expect(niceDomain(0, 97, 6).ticks.length).toBeLessThanOrEqual(6);
    expect(niceDomain(90, 90).ticks.length).toBeGreaterThan(1);
    expect(niceDomain(110, 85).min).toBe(85);
  });
});

describe('passwordChecks', () => {
  it('ticks each rule separately', () => {
    expect(passwordChecks('')).toEqual({ length: false, upper: false, lower: false, digit: false });
    expect(passwordChecks('abc')).toMatchObject({ lower: true, upper: false });
    expect(passwordChecks('Abcdefg1')).toEqual({
      length: true,
      upper: true,
      lower: true,
      digit: true,
    });
  });
});

describe('changePasswordSchema', () => {
  const base = { current: 'Old12345', password: 'New12345', confirmPassword: 'New12345' };
  it('accepts a valid change', () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });
  it('rejects the same password, a mismatch or a weak password', () => {
    expect(
      changePasswordSchema.safeParse({ ...base, password: 'Old12345', confirmPassword: 'Old12345' })
        .success,
    ).toBe(false);
    expect(changePasswordSchema.safeParse({ ...base, confirmPassword: 'New12346' }).success).toBe(
      false,
    );
    expect(
      changePasswordSchema.safeParse({ ...base, password: 'new12345', confirmPassword: 'new12345' })
        .success,
    ).toBe(false);
  });
});

describe('goalJourney', () => {
  it('says how far you came and how far is left', async () => {
    const { goalJourney } =
      jest.requireActual<typeof import('@/domain/weight/tone')>('@/domain/weight/tone');
    expect(goalJourney(108, 105.3, 90)).toEqual({
      moved: expect.closeTo(2.7),
      direction: 'down',
      toGo: expect.closeTo(15.3),
    });
    expect(goalJourney(70, 72, 76)).toEqual({ moved: 2, direction: 'up', toGo: 4 });
    expect(goalJourney(108, 89, 90).toGo).toBe(0);
    expect(goalJourney(108, 106, null).toGo).toBeNull();
  });
});
