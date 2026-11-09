/**
 * Local notification plan (spec 17). Pure: produces what should be scheduled for the next 14 days;
 * the app cancels everything PACE scheduled and schedules this list. Times are local minutes.
 * Text never includes weight or health details (lock-screen privacy).
 */
import { addDays, type IsoDate } from '../calculations/dates';
import { isMatchCategory, sportEventLabel } from '../sports/catalogue';

export interface NotificationPrefs {
  workout: { on: boolean; minutesBefore: number };
  match: { on: boolean };
  weighIn: { on: boolean; time: string };
  meals: { on: boolean; times: string[] };
  water: { on: boolean; times: string[] };
  weeklyReport: { on: boolean };
}

export const DEFAULT_PREFS: NotificationPrefs = {
  workout: { on: true, minutesBefore: 60 },
  match: { on: true },
  weighIn: { on: false, time: '07:30' },
  meals: { on: false, times: ['12:30', '19:00'] },
  water: { on: false, times: ['11:00', '16:00'] },
  weeklyReport: { on: true },
};

/** Meal and water reminders are part of nutrition: off while the user has nutrition switched off. */
export const effectivePrefs = (
  p: NotificationPrefs,
  nutritionEnabled: boolean,
): NotificationPrefs =>
  nutritionEnabled
    ? p
    : { ...p, meals: { ...p.meals, on: false }, water: { ...p.water, on: false } };

export const NOTIFY = {
  horizonDays: 14,
  dailyCap: 4,
  /** iOS allows 64 pending; keep room for the rest timer. */
  maxPending: 60,
  quietStart: 22 * 60,
  quietEnd: 7 * 60,
  defaultWorkoutTime: 9 * 60,
  matchEveTime: 19 * 60,
  weeklyReportTime: 9 * 60,
  maxPerKind: 3,
} as const;

export type NotificationKind =
  'match' | 'workout' | 'weekly_report' | 'weigh_in' | 'meal' | 'water';
/** When the daily cap bites, earlier kinds win. */
const RANK: Record<NotificationKind, number> = {
  match: 0,
  workout: 1,
  weekly_report: 2,
  weigh_in: 3,
  meal: 4,
  water: 5,
};

export interface PlannedNotification {
  id: string;
  kind: NotificationKind;
  date: IsoDate;
  /** Minutes after local midnight. */
  minute: number;
  title: string;
  body: string;
  /** Deep link opened on tap. */
  href: string;
}

export interface PlanEvent {
  id: string;
  date: IsoDate;
  time: string | null;
  title: string;
  category: string;
  status: string;
}

export const hm = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const isMatch = isMatchCategory;

/**
 * Applies quiet hours (22:00–07:00): reminders before 07:00 move to 07:00 if still before the event
 * they remind about, otherwise they're dropped; reminders from 22:00 are dropped (spec 28.9 #7).
 */
export function applyQuietHours(
  n: PlannedNotification,
  eventMinute: number | null,
): PlannedNotification | null {
  if (n.minute >= NOTIFY.quietStart) return null;
  if (n.minute >= NOTIFY.quietEnd) return n;
  if (eventMinute !== null && eventMinute <= NOTIFY.quietEnd) return null;
  return { ...n, minute: NOTIFY.quietEnd };
}

export function planNotifications(input: {
  prefs: NotificationPrefs;
  today: IsoDate;
  /** Minutes after local midnight now; nothing is scheduled in the past. */
  nowMinute: number;
  events: readonly PlanEvent[];
  weekStartsOn: 1 | 7;
}): PlannedNotification[] {
  const { prefs, today } = input;
  const last = addDays(today, NOTIFY.horizonDays - 1);
  const candidates: { n: PlannedNotification; eventMinute: number | null }[] = [];
  const add = (n: Omit<PlannedNotification, 'id'>, eventMinute: number | null = null) =>
    candidates.push({ n: { ...n, id: `${n.kind}:${n.date}:${n.minute}` }, eventMinute });

  for (const e of input.events) {
    // Rest days get no reminder (spec 17).
    if (e.status !== 'planned' || e.category === 'rest' || e.date < today || e.date > last)
      continue;
    if (isMatch(e.category)) {
      if (prefs.match.on) {
        const eve = addDays(e.date, -1);
        if (eve >= today)
          add({
            kind: 'match',
            date: eve,
            minute: NOTIFY.matchEveTime,
            title: `${sportEventLabel(e.category) ?? 'Match'} tomorrow`,
            body: 'Keep today light, hydrate and get a good night’s sleep.',
            href: '/training',
          });
      }
    } else if (prefs.workout.on) {
      const at = e.time ? hm(e.time) : null;
      const minute = at === null ? NOTIFY.defaultWorkoutTime : at - prefs.workout.minutesBefore;
      if (minute < 0) continue;
      add(
        {
          kind: 'workout',
          date: e.date,
          minute,
          title: at === null ? 'Workout today' : `Workout in ${prefs.workout.minutesBefore} min`,
          body: e.title,
          href: `/training/workout/${e.id}`,
        },
        at,
      );
    }
  }

  for (let i = 0; i < NOTIFY.horizonDays; i++) {
    const date = addDays(today, i);
    if (prefs.weighIn.on)
      add({
        kind: 'weigh_in',
        date,
        minute: hm(prefs.weighIn.time),
        title: 'Morning weigh-in',
        body: 'A quick weigh-in keeps your trend accurate.',
        href: '/weight/log',
      });
    if (prefs.meals.on)
      for (const t of prefs.meals.times.slice(0, NOTIFY.maxPerKind))
        add({
          kind: 'meal',
          date,
          minute: hm(t),
          title: 'Log your meal',
          body: 'Take a moment to log what you ate.',
          href: '/nutrition/add',
        });
    if (prefs.water.on)
      for (const t of prefs.water.times.slice(0, NOTIFY.maxPerKind))
        add({
          kind: 'water',
          date,
          minute: hm(t),
          title: 'Water break',
          body: 'Time for a glass of water.',
          href: '/nutrition',
        });
    const iso = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
    if (prefs.weeklyReport.on && iso === input.weekStartsOn)
      add({
        kind: 'weekly_report',
        date,
        minute: NOTIFY.weeklyReportTime,
        title: 'Your weekly report is ready',
        body: 'See how last week went.',
        href: '/reports',
      });
  }

  const shifted = candidates
    .map((c) => applyQuietHours(c.n, c.eventMinute))
    .filter((n): n is PlannedNotification => n !== null)
    .filter((n) => n.date > today || n.minute > input.nowMinute);

  // Daily cap: keep the most important per day.
  const byDay = new Map<IsoDate, PlannedNotification[]>();
  for (const n of shifted) byDay.set(n.date, [...(byDay.get(n.date) ?? []), n]);
  const capped = [...byDay.values()].flatMap((list) =>
    [...list]
      .sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.minute - b.minute)
      .slice(0, NOTIFY.dailyCap),
  );

  // Unique ids (two reminders can't share a slot), nearest first, within the pending limit.
  const seen = new Set<string>();
  return capped
    .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.minute - b.minute)
    .slice(0, NOTIFY.maxPending);
}
