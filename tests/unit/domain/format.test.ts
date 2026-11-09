import {
  categoryLabel,
  completionLabel,
  formatDate,
  formatDateRange,
  formatInt,
  formatShortDate,
  formatWeekOf,
  humanize,
  plural,
} from '@/domain/format';

describe('display formatting (audit: no raw ISO dates, enums or naive plurals)', () => {
  it('dates are readable and never shift a day', () => {
    expect(formatDate('2026-11-09', 'en-GB')).toBe('9 Nov 2026');
    expect(formatShortDate('2026-11-09', 'en-GB')).toBe('Mon 9 Nov');
    expect(formatWeekOf('2026-11-02', 'en-GB')).toBe('Week of 2 Nov');
    expect(formatDate('2026-01-01', 'en-US')).toBe('Jan 1, 2026');
  });
  it('ranges collapse the shared month and year', () => {
    expect(formatDateRange('2026-11-09', '2026-11-15', 'en-GB')).toBe('9 – 15 Nov 2026');
    expect(formatDateRange('2026-10-30', '2026-11-05', 'en-GB')).toBe('30 Oct – 5 Nov 2026');
    expect(formatDateRange('2026-12-29', '2027-01-04', 'en-GB')).toBe('29 Dec 2026 – 4 Jan 2027');
  });
  it('plurals and grouping', () => {
    expect(plural(1, 'change')).toBe('1 change');
    expect(plural(3, 'change')).toBe('3 changes');
    expect(plural(2, 'activity', 'activities')).toBe('2 activities');
    expect(formatInt(12500, 'en-GB')).toBe('12,500');
  });
  it('stored values become labels', () => {
    expect(completionLabel('abandoned')).toBe('Stopped early');
    expect(categoryLabel('futsal_match')).toBe('Futsal match');
    expect(categoryLabel('new_thing')).toBe('New thing');
    expect(humanize('cleared_training')).toBe('Cleared training');
    expect(completionLabel(null)).toBe('');
  });
});
