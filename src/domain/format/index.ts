/**
 * Display formatting (audit fix: raw ISO dates, enum values and naive plurals reached the UI).
 * Pure. Dates are ISO local dates ('YYYY-MM-DD'); they are formatted at noon UTC so the calendar
 * day never shifts with the device timezone.
 */
import type { IsoDate } from '../calculations/dates';
import { sportEventLabel } from '../sports/catalogue';

const at = (iso: IsoDate) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
/** Dates read day-month everywhere ("9 Nov"), whatever the phone's locale (user decision). */
export const DATE_LOCALE = 'en-GB';
const fmt = (opts: Intl.DateTimeFormatOptions, locale: string = DATE_LOCALE) =>
  new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' });

/** "9 Nov 2026" (or the locale's equivalent). */
export const formatDate = (iso: IsoDate, locale?: string) =>
  fmt({ day: 'numeric', month: 'short', year: 'numeric' }, locale).format(at(iso));

/** "Mon 9 Nov" — for dates within the current year. */
export const formatShortDate = (iso: IsoDate, locale?: string) =>
  fmt({ weekday: 'short', day: 'numeric', month: 'short' }, locale).format(at(iso));

/** "9 Nov" */
export const formatDayMonth = (iso: IsoDate, locale?: string) =>
  fmt({ day: 'numeric', month: 'short' }, locale).format(at(iso));

/** "Tuesday 10 November" */
export const formatLongWeekday = (iso: IsoDate, locale?: string) =>
  fmt({ weekday: 'long', day: 'numeric', month: 'long' }, locale).format(at(iso));

/** "November 2026" (or "Nov 2026" with `short`). */
export const formatMonthYear = (iso: IsoDate, short = false, locale?: string) =>
  fmt({ month: short ? 'short' : 'long', year: 'numeric' }, locale).format(at(iso));

/**
 * "9 – 15 Nov 2026", "30 Oct – 5 Nov 2026", "29 Dec 2026 – 4 Jan 2027".
 * With `year: false`: "9 – 15 Nov", "30 Oct – 5 Nov", "29 Dec – 4 Jan" (e.g. a week heading).
 */
export function formatDateRange(
  from: IsoDate,
  to: IsoDate,
  locale?: string,
  { year = true }: { year?: boolean } = {},
): string {
  const a = at(from);
  const b = at(to);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  const left = fmt(
    sameMonth
      ? { day: 'numeric' }
      : sameYear || !year
        ? { day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short', year: 'numeric' },
    locale,
  ).format(a);
  return `${left} – ${year ? formatDate(to, locale) : formatDayMonth(to, locale)}`;
}

/** "Week of 2 Nov" */
export const formatWeekOf = (weekStart: IsoDate, locale?: string) =>
  `Week of ${fmt({ day: 'numeric', month: 'short' }, locale).format(at(weekStart))}`;

/** Whole numbers with the locale's grouping: 12,500. */
export const formatInt = (n: number, locale?: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(n));

/** "1 change", "3 changes". `many` defaults to `one + 's'`. */
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatInt(n)} ${n === 1 ? one : many}`;

/** Human labels for stored enum values. Unknown values fall back to a readable form. */
export const humanize = (value: string) =>
  value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const label = (map: Record<string, string>) => (value: string | null | undefined) =>
  value ? (map[value] ?? humanize(value)) : '';

export const completionLabel = label({
  completed: 'Completed',
  partial: 'Partly done',
  abandoned: 'Stopped early',
});

export const intensityLabel = label({
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  rest: 'Rest',
});

export const difficultyLabel = label({
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
});

const baseCategoryLabel = label({
  strength: 'Strength',
  core: 'Core',
  mobility: 'Mobility',
  conditioning: 'Conditioning',
  cardio: 'Cardio',
  football: 'Football',
  futsal: 'Futsal',
  recovery: 'Recovery',
  sport_skills: 'Sport drills',
  workout: 'Workout',
  run: 'Run',
  walk: 'Walk',
  cycle: 'Ride',
  rest: 'Rest',
  other: 'Other',
});

/** Exercise/session categories; sport events read from the sports catalogue ("Basketball game"). */
export const categoryLabel = (value: string | null | undefined) =>
  (value && sportEventLabel(value)) || baseCategoryLabel(value);

export const muscleLabel = (m: string) => humanize(m).toLowerCase();
