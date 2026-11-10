import {
  clampMonth,
  formatLongDate,
  monthGrid,
  shiftMonth,
  spokenDate,
  weekdayLabels,
} from '@/domain/calculations/calendar';

describe('monthGrid', () => {
  it('starts on Monday and always has 42 cells', () => {
    const g = monthGrid(2026, 11, 1); // 1 Nov 2026 is a Sunday
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ date: '2026-10-26', day: 26, inMonth: false });
    expect(g[6]).toEqual({ date: '2026-11-01', day: 1, inMonth: true });
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
  });
  it('can start on Sunday', () => {
    expect(monthGrid(2026, 11, 7)[0]).toEqual({ date: '2026-11-01', day: 1, inMonth: true });
  });
  it('handles leap years', () => {
    expect(monthGrid(2028, 2).filter((c) => c.inMonth)).toHaveLength(29);
    expect(monthGrid(2027, 2).filter((c) => c.inMonth)).toHaveLength(28);
  });
});

describe('month helpers', () => {
  it('shifts across years', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 5, -24)).toEqual({ year: 2024, month: 5 });
  });
  it('clamps to the allowed range', () => {
    expect(clampMonth({ year: 2027, month: 3 }, null, '2026-11-10')).toEqual({
      year: 2026,
      month: 11,
    });
    expect(clampMonth({ year: 1900, month: 1 }, '1926-11-10', null)).toEqual({
      year: 1926,
      month: 11,
    });
  });
  it('formats dates', () => {
    expect(formatLongDate('2026-11-10')).toBe('Tue, 10 Nov 2026');
    expect(spokenDate('2026-11-10')).toBe('10 November 2026');
    expect(weekdayLabels(7)[0]).toBe('Sun');
  });
});
