import { getCalendars } from 'expo-localization';
import { useMemo } from 'react';

import { localDateInTimezone } from '@/domain/calculations/dates';

import { useOnboardingDraft } from './draft-store';

export function detectTimezone(): string {
  try {
    return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Today's date in the user's timezone: the `asOf` for every onboarding calculation. */
export function useAsOf(): string {
  const tz = useOnboardingDraft((s) => s.personal?.timezone) ?? detectTimezone();
  return useMemo(() => localDateInTimezone(new Date(), tz), [tz]);
}
