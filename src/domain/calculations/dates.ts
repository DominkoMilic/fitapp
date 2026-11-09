/**
 * Calendar-date helpers on ISO 'YYYY-MM-DD' strings. Pure and timezone-independent:
 * a "local date" is computed once (in the user's timezone) and then treated as a plain date.
 */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: IsoDate): { y: number; m: number; d: number } {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return { y, m, d };
}

export function isValidIsoDate(value: string): boolean {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const { y, m, d } = parseIsoDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Whole days since 1970-01-01 for an ISO date (for day differences). */
export const dayNumber = (date: IsoDate) =>
  Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000;

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(date: IsoDate): number {
  const { y, m, d } = parseIsoDate(date);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Full years between dateOfBirth and asOf (spec 8.1).
 * Feb 29 birthdays are celebrated on Mar 1 in non-leap years.
 */
export function ageOn(dateOfBirth: IsoDate, asOf: IsoDate): number {
  const b = parseIsoDate(dateOfBirth);
  const a = parseIsoDate(asOf);
  let birthdayMonth = b.m;
  let birthdayDay = b.d;
  if (b.m === 2 && b.d === 29 && !isLeap(a.y)) {
    birthdayMonth = 3;
    birthdayDay = 1;
  }
  let age = a.y - b.y;
  if (a.m < birthdayMonth || (a.m === birthdayMonth && a.d < birthdayDay)) age -= 1;
  return age;
}

/** Today's calendar date in an IANA timezone, as 'YYYY-MM-DD'. */
export function localDateInTimezone(instant: Date, timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Offset of a timezone from UTC at an instant, in minutes (e.g. +60 for Zagreb in winter). */
function offsetMinutes(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
  );
  return Math.round((asUtc - Math.floor(instantMs / 60_000) * 60_000) / 60_000);
}

/**
 * The instant of a local wall-clock time (date + minutes after midnight) in a timezone. Handles DST:
 * a time skipped by a spring-forward resolves to the hour after; an ambiguous one to the first.
 */
export function instantFromLocal(date: IsoDate, minuteOfDay: number, timeZone: string): number {
  const { y, m, d } = parseIsoDate(date);
  const wall = Date.UTC(y, m - 1, d, 0, minuteOfDay);
  let t = wall - offsetMinutes(wall, timeZone) * 60_000;
  t = wall - offsetMinutes(t, timeZone) * 60_000;
  return t;
}
