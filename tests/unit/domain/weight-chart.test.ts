import { dailyLinePaths, linearScale } from '@/domain/charts/scale';
import { timeTicks } from '@/domain/charts/time';
import { rangeStart } from '@/domain/weight/ranges';
import { clampOffset } from '@/components/ui/Screen';

describe('rangeStart', () => {
  const today = '2026-11-12'; // a Thursday
  it('uses calendar periods', () => {
    expect(rangeStart('Week', today)).toBe('2026-11-09'); // Monday
    expect(rangeStart('Week', today, 7)).toBe('2026-11-08'); // Sunday
    expect(rangeStart('Month', today)).toBe('2026-11-01');
    expect(rangeStart('Year', today)).toBe('2026-01-01');
    expect(rangeStart('All', today)).toBeNull();
  });
  it('keeps the rolling 30 days for the overview cards', () => {
    expect(rangeStart('30D', today)).toBe('2026-10-14');
  });
  it('a week starting today is just today', () => {
    expect(rangeStart('Week', '2026-11-09')).toBe('2026-11-09');
  });
});

describe('timeTicks', () => {
  it('labels days for a week', () => {
    expect(timeTicks('2026-11-09', '2026-11-12', 10).map((t) => t.label)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
    ]);
  });
  it('labels dates early in a month (not weekday names)', () => {
    expect(timeTicks('2026-11-01', '2026-11-10', 4).map((t) => t.label)).toEqual([
      '1 Nov',
      '4 Nov',
      '7 Nov',
      '10 Nov',
    ]);
  });
  it('labels Mondays for a month', () => {
    expect(timeTicks('2026-11-01', '2026-11-30').map((t) => t.label)).toEqual([
      '2 Nov',
      '9 Nov',
      '16 Nov',
      '23 Nov',
      '30 Nov',
    ]);
  });
  it('labels month starts for a year, with the year on January', () => {
    const t = timeTicks('2026-09-15', '2027-03-01', 12);
    expect(t.map((x) => x.label)).toEqual(['Oct', 'Nov', 'Dec', 'Jan 2027', 'Feb', 'Mar']);
    expect(t[0]!.date).toBe('2026-10-01');
  });
  it('labels years for long histories', () => {
    expect(timeTicks('2023-05-01', '2026-11-12').map((t) => t.label)).toEqual([
      '2024',
      '2025',
      '2026',
    ]);
  });
  it('never returns more labels than asked for', () => {
    expect(timeTicks('2026-01-01', '2026-12-31', 4).length).toBeLessThanOrEqual(4);
  });
});

describe('dailyLinePaths', () => {
  const x = linearScale([0, 100], [0, 100]);
  const y = linearScale([0, 100], [0, 100]);
  it('joins consecutive days with a solid line', () => {
    const p = dailyLinePaths(
      [
        { day: 0, value: 10 },
        { day: 1, value: 20 },
        { day: 3, value: 15 },
      ],
      x,
      y,
    );
    expect(p.solid).toBe('M0.0,10.0 L1.0,20.0 L3.0,15.0');
    expect(p.dashed).toBe('');
  });
  it('dashes a gap longer than 7 days instead of drawing it as data', () => {
    const p = dailyLinePaths(
      [
        { day: 0, value: 10 },
        { day: 10, value: 20 },
        { day: 11, value: 25 },
      ],
      x,
      y,
    );
    expect(p.solid).toBe('M0.0,10.0 M10.0,20.0 L11.0,25.0');
    expect(p.dashed).toBe('M0.0,10.0 L10.0,20.0');
  });
  it('handles a single point and no points', () => {
    expect(dailyLinePaths([{ day: 5, value: 1 }], x, y)).toEqual({ solid: 'M5.0,1.0', dashed: '' });
    expect(dailyLinePaths([], x, y)).toEqual({ solid: '', dashed: '' });
  });
});

describe('clampOffset', () => {
  it('pulls the scroll back when the content got shorter than the offset', () => {
    expect(clampOffset(900, 1200, 600)).toBe(600);
    expect(clampOffset(400, 500, 600)).toBe(0);
  });
  it('leaves a valid offset alone', () => {
    expect(clampOffset(300, 1200, 600)).toBeNull();
    expect(clampOffset(600, 1200, 600)).toBeNull();
  });
});
