import {
  isTimeOfDay,
  pickerHours,
  pickerMinutes,
  snapTime,
  timeOf,
} from '@/domain/calculations/time-of-day';

describe('time of day picker', () => {
  it('validates and formats HH:MM', () => {
    expect(isTimeOfDay('07:30')).toBe(true);
    expect(isTimeOfDay('7:30')).toBe(false);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(timeOf(6 * 60 + 5)).toBe('06:05');
    expect(timeOf(1440 + 30)).toBe('00:30');
  });

  it('offers every hour and 5-minute steps without limits', () => {
    expect(pickerHours()).toHaveLength(24);
    expect(pickerMinutes(10)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  it('keeps reminders out of quiet hours (06:00–21:55)', () => {
    expect(pickerHours('06:00', '21:55')).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
    expect(pickerMinutes(21, '06:00', '21:55')).toContain(55);
    expect(pickerMinutes(6, '06:30', null)[0]).toBe(30);
  });

  it('starts the picker at the nearest pickable time', () => {
    expect(snapTime('07:32')).toBe('07:30');
    expect(snapTime('07:33')).toBe('07:35');
    expect(snapTime(null, null, null, '18:00')).toBe('18:00');
    expect(snapTime('05:10', '06:00', '21:55')).toBe('06:00');
    expect(snapTime('23:10', '06:00', '21:55')).toBe('21:55');
  });
});
