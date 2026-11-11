import { z } from 'zod';

import { DEFAULT_PREFS, type NotificationPrefs } from '@/domain/notifications/planner';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Stored in user_preferences.notification_preferences; anything missing or invalid gets the default. */
const schema = z.object({
  workout: z
    .object({ on: z.boolean(), minutesBefore: z.number().int().min(0).max(240) })
    .catch(DEFAULT_PREFS.workout),
  match: z.object({ on: z.boolean() }).catch(DEFAULT_PREFS.match),
  weighIn: z.object({ on: z.boolean(), time }).catch(DEFAULT_PREFS.weighIn),
  weeklyReport: z.object({ on: z.boolean() }).catch(DEFAULT_PREFS.weeklyReport),
});

export function readPrefs(raw: unknown): NotificationPrefs {
  const r = schema.safeParse(raw && typeof raw === 'object' ? raw : {});
  return r.success ? r.data : DEFAULT_PREFS;
}

/** Times reminders may be set to (quiet hours 22:00–06:00 excluded). */
export const isAllowedTime = (t: string) => t >= '06:00' && t < '22:00';
