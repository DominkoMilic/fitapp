import { kgToLb } from '@/domain/calculations/units';
import { formatShown, shownChange, shownWeight } from '@/domain/weight/display';
import { goalJourney } from '@/domain/weight/tone';

describe('shown weights add up', () => {
  it('start 107, 7-day average 106.25: shows 106.3 and a change of -0.7 (not -0.8)', () => {
    expect(formatShown(shownWeight(107, 'metric'))).toBe('107.0');
    expect(formatShown(shownWeight(106.25, 'metric'))).toBe('106.3');
    expect(formatShown(shownChange(107, 106.25, 'metric'), true)).toBe('-0.7');
  });

  it('the shown change always equals the difference of the shown values', () => {
    for (let a = 100; a < 101; a += 0.013)
      for (let b = 99; b < 100; b += 0.017) {
        const diff = shownWeight(b, 'metric') - shownWeight(a, 'metric');
        expect(shownChange(a, b, 'metric')).toBeCloseTo(diff, 9);
      }
  });

  it('works in pounds from the converted, rounded values', () => {
    const start = 107;
    const avg = 106.25;
    const shownStart = Math.round(kgToLb(start) * 10) / 10;
    const shownAvg = Math.round(kgToLb(avg) * 10) / 10;
    expect(shownChange(start, avg, 'imperial')).toBeCloseTo(shownAvg - shownStart, 9);
  });

  it('never shows "-0.0" or "+0.0"', () => {
    expect(formatShown(shownChange(107.02, 106.98, 'metric'), true)).toBe('0.0');
    expect(formatShown(-0, true)).toBe('0.0');
    expect(formatShown(null)).toBe('—');
  });

  it('home journey from shown values matches the change tile', () => {
    const j = goalJourney(shownWeight(107, 'metric'), shownWeight(106.25, 'metric'), 95);
    expect(j.moved.toFixed(1)).toBe('0.7');
    expect(j.toGo?.toFixed(1)).toBe('11.3');
  });
});
