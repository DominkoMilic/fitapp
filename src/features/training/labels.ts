import { isoWeekday } from '@/domain/calculations/dates';

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const dayLabel = (date: string, today: string) =>
  date === today
    ? 'Today'
    : `${WEEKDAY_SHORT[isoWeekday(date) - 1]} ${new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

export const STATUS_LABEL: Record<string, string> = {
  planned: '',
  completed: 'Done',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

export const isSport = (category: string) =>
  /_(match|practice)$/.test(category) || category === 'other';
