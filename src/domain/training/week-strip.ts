import { addDays, type IsoDate } from '@/domain/calculations/dates';

/** What a day in the Training week strip shows under its date. */
export type DayMark = 'none' | 'rest' | 'planned' | 'done' | 'skipped' | 'progress';

export interface StripItem {
  id: string;
  scheduled_date: string;
  status: string;
  kind: string;
}

/** Most telling first: a workout in progress, then something still to do, then what happened. */
const RANK: Record<DayMark, number> = {
  progress: 5,
  planned: 4,
  done: 3,
  skipped: 2,
  rest: 1,
  none: 0,
};

function markOf(item: StripItem, activeScheduledId: string | null): DayMark {
  if (item.status === 'cancelled') return 'none';
  if (item.status === 'completed') return 'done';
  if (item.status === 'skipped') return 'skipped';
  if (item.id === activeScheduledId) return 'progress';
  return item.kind === 'rest' ? 'rest' : 'planned';
}

/** One mark per day of the week starting at `weekStart` (7 entries). Pure. */
export function dayMarks(
  weekStart: IsoDate,
  items: readonly StripItem[],
  activeScheduledId: string | null,
): { date: IsoDate; mark: DayMark; count: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const day = items.filter((r) => r.scheduled_date === date && r.status !== 'cancelled');
    const mark = day
      .map((r) => markOf(r, activeScheduledId))
      .reduce<DayMark>((best, m) => (RANK[m] > RANK[best] ? m : best), 'none');
    return { date, mark, count: day.filter((r) => r.kind !== 'rest').length };
  });
}

/** The day selected when a week is opened: today in the current week, else its first day. */
export const defaultDay = (weekStart: IsoDate, today: IsoDate): IsoDate =>
  today >= weekStart && today <= addDays(weekStart, 6) ? today : weekStart;
