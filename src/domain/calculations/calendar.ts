import { addDays, type IsoDate, isoWeekday } from './dates';

export interface CalendarCell {
  date: IsoDate;
  day: number;
  /** False for the leading/trailing days of the neighbouring months. */
  inMonth: boolean;
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const SHORT_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3));
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Weekday letters for the grid header, starting Monday (1) or Sunday (7). */
export function weekdayLabels(weekStartsOn: 1 | 7 = 1): string[] {
  return weekStartsOn === 1 ? SHORT_DAYS : [SHORT_DAYS[6]!, ...SHORT_DAYS.slice(0, 6)];
}

/**
 * The 6×7 day grid for a month (`month` 1–12): always 42 cells so the sheet never changes
 * height, starting on the week's first day. Pure.
 */
export function monthGrid(year: number, month: number, weekStartsOn: 1 | 7 = 1): CalendarCell[] {
  const first = iso(year, month, 1);
  const wd = isoWeekday(first); // 1 = Monday … 7 = Sunday
  const lead = weekStartsOn === 1 ? wd - 1 : wd % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, day: Number(date.slice(8, 10)), inMonth: Number(date.slice(5, 7)) === month };
  });
}

/** The month after/before (`delta` months), as { year, month }. Pure. */
export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Keeps a { year, month } inside [min, max] (ISO dates, either may be null). Pure. */
export function clampMonth(
  ym: { year: number; month: number },
  min: IsoDate | null,
  max: IsoDate | null,
) {
  const key = (y: number, m: number) => y * 12 + m;
  let { year, month } = ym;
  if (min && key(year, month) < key(+min.slice(0, 4), +min.slice(5, 7)))
    [year, month] = [+min.slice(0, 4), +min.slice(5, 7)];
  if (max && key(year, month) > key(+max.slice(0, 4), +max.slice(5, 7)))
    [year, month] = [+max.slice(0, 4), +max.slice(5, 7)];
  return { year, month };
}

/** "Tue, 10 Nov 2026" (fixed English, matching the rest of the UI). Pure. */
export function formatLongDate(date: IsoDate): string {
  const d = Number(date.slice(8, 10));
  const m = Number(date.slice(5, 7));
  return `${SHORT_DAYS[isoWeekday(date) - 1]}, ${d} ${SHORT_MONTHS[m - 1]} ${date.slice(0, 4)}`;
}

/** "10 November 2026", for screen readers. Pure. */
export function spokenDate(date: IsoDate): string {
  return `${Number(date.slice(8, 10))} ${MONTH_NAMES[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

/** The same day `years` years earlier (29 Feb → 28 Feb). Pure. */
export function yearsBefore(date: IsoDate, years: number): IsoDate {
  const y = Number(date.slice(0, 4)) - years;
  const md = date.slice(5) === '02-29' ? '02-28' : date.slice(5);
  return `${String(y).padStart(4, '0')}-${md}`;
}
