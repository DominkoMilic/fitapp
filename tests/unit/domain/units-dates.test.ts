import {
  addDays,
  cmToFeetInches,
  formatHeight,
  formatWeight,
  isoWeekday,
  isValidIsoDate,
  localDateInTimezone,
  parseDecimal,
} from '@/domain/calculations';

describe('parseDecimal', () => {
  it.each([
    ['108,5', 108.5],
    ['108.5', 108.5],
    [' 72 ', 72],
    ['.5', 0.5],
  ])('%s → %d', (input, expected) => expect(parseDecimal(input)).toBe(expected));
  it.each(['', 'abc', '1,2,3', '12kg', '1e5'])('rejects %s', (input) =>
    expect(parseDecimal(input)).toBeNull(),
  );
});

describe('imperial round trip', () => {
  it('6 ft 2 in survives cm storage', () => {
    expect(cmToFeetInches(188)).toEqual({ feet: 6, inches: 2 });
    expect(formatHeight(188, 'imperial')).toBe('6 ft 2 in');
  });
  it('carries 12 inches into feet', () => {
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
  });
  it('formats weights', () => {
    expect(formatWeight(108, 'metric')).toBe('108.0 kg');
    expect(formatWeight(108, 'imperial')).toBe('238.1 lb');
  });
});

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
  });
  it('adds days across months and DST', () => {
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
  it('ISO weekday (Mon = 1, Sun = 7)', () => {
    expect(isoWeekday('2026-11-09')).toBe(1);
    expect(isoWeekday('2026-11-08')).toBe(7);
  });
  it('local date depends on timezone', () => {
    const instant = new Date('2026-11-08T23:30:00Z');
    expect(localDateInTimezone(instant, 'UTC')).toBe('2026-11-08');
    expect(localDateInTimezone(instant, 'Europe/Zagreb')).toBe('2026-11-09');
    expect(localDateInTimezone(instant, 'America/New_York')).toBe('2026-11-08');
  });
});
