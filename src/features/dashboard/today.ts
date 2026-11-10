import { addDays, isoWeekday, type IsoDate } from '@/domain/calculations/dates';

export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening';

/** Greeting by local hour (spec Home: "greeting based on local time"). */
export function greetingFor(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Hour (0–23) in an IANA timezone. */
export function hourInTimezone(instant: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  return Number(h) % 24;
}

export interface PatternDay {
  weekday: number;
  kind: string;
  title: string;
  intensity: string;
  minutes: number;
  template_slug: string | null;
  notes: string[];
}

/** Safely reads the weekly_pattern JSON stored on training_plans. */
export function parsePattern(value: unknown): PatternDay[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((d) => {
    if (!d || typeof d !== 'object') return [];
    const r = d as Record<string, unknown>;
    if (typeof r.weekday !== 'number' || typeof r.title !== 'string' || typeof r.kind !== 'string')
      return [];
    return [
      {
        weekday: r.weekday,
        kind: r.kind,
        title: r.title,
        intensity: typeof r.intensity === 'string' ? r.intensity : 'moderate',
        minutes: typeof r.minutes === 'number' ? r.minutes : 0,
        template_slug: typeof r.template_slug === 'string' ? r.template_slug : null,
        notes: Array.isArray(r.notes)
          ? r.notes.filter((n): n is string => typeof n === 'string')
          : [],
      },
    ];
  });
}

export function todaysSession(pattern: readonly PatternDay[], today: IsoDate): PatternDay | null {
  return pattern.find((d) => d.weekday === isoWeekday(today)) ?? null;
}

export interface UpcomingEvent {
  date: IsoDate;
  title: string;
  localTime: string;
  category: string;
}

/** Next occurrences of recurring commitments within the next `days` days (today included). */
export function upcomingEvents(
  events: readonly {
    title: string;
    weekday: number;
    local_time: string;
    category: string;
    starts_on: string;
    ends_on: string | null;
    active: boolean;
  }[],
  today: IsoDate,
  days = 7,
  limit = 3,
): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const wd = isoWeekday(date);
    for (const e of events) {
      if (!e.active || e.weekday !== wd || date < e.starts_on || (e.ends_on && date > e.ends_on))
        continue;
      out.push({ date, title: e.title, localTime: e.local_time.slice(0, 5), category: e.category });
    }
  }
  return out
    .sort((a, b) => (a.date + a.localTime).localeCompare(b.date + b.localTime))
    .slice(0, limit);
}

/** The "Next: …" line on Home's Today card: skips an event that is already today's plan. */
export function nextEvent(
  upcoming: readonly UpcomingEvent[],
  today: IsoDate,
  sessionTitle: string | null,
): UpcomingEvent | null {
  return upcoming.find((e) => !(e.date === today && e.title === sessionTitle)) ?? null;
}
