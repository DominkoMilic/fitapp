import {
  greetingFor,
  hourInTimezone,
  nextEvent,
  parsePattern,
  targetFor,
  todaysSession,
  upcomingEvents,
} from '@/features/dashboard/today';

describe('greeting', () => {
  it.each([
    [4, 'Good evening'],
    [5, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('%i:00 → %s', (h, g) => expect(greetingFor(h)).toBe(g));

  it('uses the user timezone', () => {
    const instant = new Date('2026-11-08T06:30:00Z');
    expect(hourInTimezone(instant, 'Europe/Zagreb')).toBe(7);
    expect(hourInTimezone(instant, 'America/New_York')).toBe(1);
  });
});

describe('weekly pattern JSON', () => {
  it('ignores malformed entries instead of crashing', () => {
    const days = parsePattern([
      { weekday: 1, kind: 'rest', title: 'Rest' },
      null,
      'x',
      { weekday: 'Mon' },
      { weekday: 2, kind: 'recovery', title: 'Walk', notes: [1, 'ok'] },
    ]);
    expect(days).toHaveLength(2);
    expect(days[1]?.notes).toEqual(['ok']);
    expect(parsePattern(null)).toEqual([]);
  });
  it("finds today's session by ISO weekday", () => {
    const days = parsePattern([{ weekday: 7, kind: 'recovery', title: 'Sunday walk' }]);
    expect(todaysSession(days, '2026-11-08')?.title).toBe('Sunday walk');
    expect(todaysSession(days, '2026-11-09')).toBeNull();
  });
});

describe('upcoming events', () => {
  const base = {
    local_time: '18:00:00',
    category: 'futsal_match',
    starts_on: '2026-11-01',
    ends_on: null,
    active: true,
  };
  it('lists the next occurrences in order, today included', () => {
    const r = upcomingEvents(
      [
        { ...base, title: 'League match', weekday: 6 },
        {
          ...base,
          title: 'Practice',
          weekday: 2,
          local_time: '20:00:00',
          category: 'futsal_practice',
        },
      ],
      '2026-11-10', // Tuesday
    );
    expect(r.map((e) => `${e.date} ${e.title} ${e.localTime}`)).toEqual([
      '2026-11-10 Practice 20:00',
      '2026-11-14 League match 18:00',
    ]);
  });
  it('respects start/end dates and inactive events', () => {
    const r = upcomingEvents(
      [
        { ...base, title: 'Future', weekday: 6, starts_on: '2026-12-01' },
        { ...base, title: 'Ended', weekday: 6, ends_on: '2026-11-01' },
        { ...base, title: 'Off', weekday: 6, active: false },
      ],
      '2026-11-10',
    );
    expect(r).toEqual([]);
  });
});

describe('target versions (spec 20.6)', () => {
  const v = [
    { effective_from: '2026-11-08', kcal: 2720 },
    { effective_from: '2026-11-22', kcal: 2620 },
  ];
  it('picks the latest version effective on the date', () => {
    expect(targetFor(v, '2026-11-08')?.kcal).toBe(2720);
    expect(targetFor(v, '2026-11-21')?.kcal).toBe(2720);
    expect(targetFor(v, '2026-11-22')?.kcal).toBe(2620);
  });
  it('returns null before the first version', () => expect(targetFor(v, '2026-11-01')).toBeNull());
});

describe('nextEvent', () => {
  const ev = (date: string, title: string) => ({
    date,
    title,
    localTime: '20:00',
    category: 'football_practice',
  });
  it("skips the event that is already today's plan", () => {
    const up = [ev('2026-11-10', 'Practice match'), ev('2026-11-14', 'League match')];
    expect(nextEvent(up, '2026-11-10', 'Practice match')?.title).toBe('League match');
  });
  it('keeps a different event today', () => {
    const up = [ev('2026-11-10', 'Evening run')];
    expect(nextEvent(up, '2026-11-10', 'Strength A')?.title).toBe('Evening run');
  });
  it('returns null when nothing else is coming', () => {
    expect(nextEvent([ev('2026-11-10', 'Practice match')], '2026-11-10', 'Practice match')).toBe(
      null,
    );
  });
});
