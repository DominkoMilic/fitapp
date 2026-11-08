import { fromZonedTime } from 'date-fns-tz';

import { localDateInTimezone } from '@/domain/calculations/dates';

/**
 * Timestamp + local date for a user event (spec 3.2 #4). For today, "now"; for a past day,
 * 08:00 local time that day (a typical morning weigh-in), converted to UTC.
 */
export function eventTime(
  localDate: string,
  timezone: string,
  now: Date = new Date(),
): { measuredAt: string; localDate: string } {
  const today = localDateInTimezone(now, timezone);
  if (localDate === today) return { measuredAt: now.toISOString(), localDate };
  return { measuredAt: fromZonedTime(`${localDate}T08:00:00`, timezone).toISOString(), localDate };
}
