import { formatShortDate } from '@/domain/format';

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** "Today" or "Wed 11 Nov" (day before month, whatever the phone's locale). */
export const dayLabel = (date: string, today: string) =>
  date === today ? 'Today' : formatShortDate(date);

export const STATUS_LABEL: Record<string, string> = {
  planned: '',
  completed: 'Done',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

export const isSport = (category: string) =>
  /_(match|practice)$/.test(category) || category === 'other';
