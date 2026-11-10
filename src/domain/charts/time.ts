import { addDays, dayNumber, type IsoDate, isoWeekday } from '@/domain/calculations/dates';

export interface TimeTick {
  date: IsoDate;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const monthOf = (d: IsoDate) => Number(d.slice(5, 7));
const dayOf = (d: IsoDate) => Number(d.slice(8, 10));

function nextMonthStart(d: IsoDate): IsoDate {
  const y = Number(d.slice(0, 4));
  const m = monthOf(d);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/** Keeps at most `max` ticks, evenly thinned (always keeping the first). */
function thin(ticks: TimeTick[], max: number): TimeTick[] {
  if (ticks.length <= max) return ticks;
  const step = Math.ceil(ticks.length / max);
  return ticks.filter((_, i) => i % step === 0);
}

/**
 * X-axis labels for a weight chart spanning `first`…`last` (inclusive). Density follows the span:
 * weekdays ("Mon") within one week, dates ("4 Nov") up to 3 weeks, Mondays ("3 Nov") up to
 * ~2 months, months ("Feb", "Jan 2027" at a new year) up to 2 years, then years. At most `max`
 * labels. Pure.
 */
export function timeTicks(first: IsoDate, last: IsoDate, max = 6): TimeTick[] {
  const span = dayNumber(last) - dayNumber(first);
  const ticks: TimeTick[] = [];
  if (span <= 6) {
    for (let d = first; d <= last; d = addDays(d, 1))
      ticks.push({ date: d, label: WEEKDAYS[isoWeekday(d) - 1]! });
  } else if (span <= 20) {
    for (let d = first; d <= last; d = addDays(d, 1))
      ticks.push({ date: d, label: `${dayOf(d)} ${MONTHS[monthOf(d) - 1]}` });
  } else if (span <= 62) {
    // Mondays inside the range.
    let d = addDays(first, (8 - isoWeekday(first)) % 7);
    for (; d <= last; d = addDays(d, 7))
      ticks.push({ date: d, label: `${dayOf(d)} ${MONTHS[monthOf(d) - 1]}` });
  } else if (span <= 731) {
    let d = dayOf(first) === 1 ? first : nextMonthStart(first);
    for (; d <= last; d = nextMonthStart(d)) {
      const m = monthOf(d);
      ticks.push({ date: d, label: m === 1 ? `Jan ${d.slice(0, 4)}` : MONTHS[m - 1]! });
    }
  } else {
    let y = Number(first.slice(0, 4)) + (first.slice(5) === '01-01' ? 0 : 1);
    for (; `${y}-01-01` <= last; y += 1) ticks.push({ date: `${y}-01-01`, label: String(y) });
  }
  return thin(ticks, max);
}
