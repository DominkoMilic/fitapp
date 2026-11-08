import { addDays } from '@/domain/calculations/dates';
import {
  evaluateMilestones,
  firstDenseWindow,
  goalReached,
  longestStreak,
  milestoneCatalogue,
} from '@/domain/milestones/evaluate';
import { dailyValues } from '@/domain/weight/trend';

const goal = { goalType: 'lose_weight', startKg: 108, targetKg: 90, secondaryKg: 87 };
const days = (start: string, values: number[]) =>
  dailyValues(values.map((kg, i) => ({ local_date: addDays(start, i), weight_kg: kg })));
const keys = (u: { key: string }[]) => u.map((m) => m.key);

describe('weight milestones use the 7-day average (spec 14.1)', () => {
  it('a single low weigh-in does not unlock anything', () => {
    const u = evaluateMilestones({
      goal,
      daily: days('2026-11-01', [108, 108, 106.5]),
      logDates: [],
      unlockedKeys: new Set(),
    });
    expect(keys(u)).toEqual([]); // average 107.5 > 107
  });
  it('unlocks when the average crosses the threshold', () => {
    const u = evaluateMilestones({
      goal,
      daily: days('2026-11-01', [107.2, 106.9, 106.8]),
      logDates: [],
      unlockedKeys: new Set(),
    });
    expect(keys(u)).toEqual(['weight_lost_1']);
    expect(u[0]?.value).toBeCloseTo(106.97, 2);
    expect(u[0]?.achievedOn).toBe('2026-11-03');
  });
  it('bulk history unlocks several at once (spec 28.8 #2)', () => {
    const values = Array.from({ length: 60 }, (_, i) => 108 - i * 0.15); // 108 → ~99.2
    const u = evaluateMilestones({
      goal,
      daily: days('2026-09-01', values),
      logDates: [],
      unlockedKeys: new Set(),
    });
    expect(keys(u)).toEqual([
      'weight_lost_1',
      'weight_lost_3',
      'weight_lost_5',
      'weight_reached_100',
      'weigh_in_30',
    ]);
  });
  it('is idempotent: already unlocked milestones are not returned again', () => {
    const daily = days('2026-11-01', [107.2, 106.9, 106.8]);
    expect(
      evaluateMilestones({ goal, daily, logDates: [], unlockedKeys: new Set(['weight_lost_1']) }),
    ).toEqual([]);
  });
  it('regaining weight never revokes (nothing to revoke: pure unlock list)', () => {
    const daily = days('2026-11-01', [107.2, 106.9, 106.8, 108, 108.5, 109]);
    expect(
      keys(evaluateMilestones({ goal, daily, logDates: [], unlockedKeys: new Set() })),
    ).toEqual(['weight_lost_1']);
  });
  it('no weight milestones for maintenance goals', () => {
    const m = { ...goal, goalType: 'maintain', targetKg: null, secondaryKg: null };
    expect(milestoneCatalogue(m).some((c) => c.category === 'weight')).toBe(false);
  });
});

describe('consistency milestones', () => {
  it('longest streak ignores duplicates and order', () => {
    expect(
      longestStreak(['2026-11-03', '2026-11-01', '2026-11-02', '2026-11-02', '2026-11-05']),
    ).toEqual({ length: 3, endsOn: '2026-11-03' });
    expect(longestStreak([])).toEqual({ length: 0, endsOn: null });
  });
  it('7 consecutive logging days unlock the streak milestone', () => {
    const logDates = Array.from({ length: 7 }, (_, i) => addDays('2026-11-01', i));
    const u = evaluateMilestones({ goal: null, daily: [], logDates, unlockedKeys: new Set() });
    expect(keys(u)).toEqual(['logging_streak_7']);
    expect(u[0]?.achievedOn).toBe('2026-11-07');
  });
  it('30 weigh-in days within 45 days', () => {
    const every3rdSkipped = Array.from({ length: 45 }, (_, i) => addDays('2026-10-01', i)).filter(
      (_, i) => i % 3 !== 2,
    );
    expect(firstDenseWindow(every3rdSkipped, 30, 45)).toBe(every3rdSkipped[29]);
    expect(firstDenseWindow(every3rdSkipped.slice(0, 29), 30, 45)).toBeNull();
    const spread = Array.from({ length: 30 }, (_, i) => addDays('2026-01-01', i * 2)); // 59 days
    expect(firstDenseWindow(spread, 30, 45)).toBeNull();
  });
});

describe('goal reached (spec 13.4)', () => {
  it('needs a 7-day average at or below the target', () => {
    expect(goalReached(goal, { kg: 89.9, basis: 'average' })).toBe(true);
    expect(goalReached(goal, { kg: 90, basis: 'average' })).toBe(true);
    expect(goalReached(goal, { kg: 89, basis: 'single' })).toBe(false);
    expect(goalReached(goal, { kg: 90.1, basis: 'average' })).toBe(false);
    expect(goalReached({ ...goal, goalType: 'maintain' }, { kg: 80, basis: 'average' })).toBe(
      false,
    );
  });
});
