import { addDays, type IsoDate } from '@/domain/calculations/dates';
import { weekStartOf } from '@/domain/training/records';

/**
 * Weight chart ranges. The chart offers calendar periods (this week, this month, this year,
 * everything); `30D` is the rolling window used by the overview cards (Home, Progress).
 */
export type RangeKey = '30D' | 'Week' | 'Month' | 'Year' | 'All';

export const CHART_RANGES = ['Week', 'Month', 'Year', 'All'] as const satisfies readonly RangeKey[];

/** First day included in `range` (inclusive), or null for everything. Pure. */
export function rangeStart(
  range: RangeKey,
  today: IsoDate,
  weekStartsOn: 1 | 7 = 1,
): IsoDate | null {
  switch (range) {
    case '30D':
      return addDays(today, -29);
    case 'Week':
      return weekStartOf(today, weekStartsOn);
    case 'Month':
      return `${today.slice(0, 7)}-01`;
    case 'Year':
      return `${today.slice(0, 4)}-01-01`;
    case 'All':
      return null;
  }
}
