import { useMemo } from 'react';

import { localDateInTimezone } from '@/domain/calculations/dates';
import { useProfile } from '@/features/profile/api';

/** Today's local date and hour in the user's saved timezone. */
export function useToday(): { today: string; hour: number; timezone: string } {
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';
  return useMemo(() => {
    const now = new Date();
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    return { today: localDateInTimezone(now, timezone), hour: hour % 24, timezone };
  }, [timezone]);
}
