/** Training load (spec 8.11): RPE × minutes, weekly sums and load spikes. Pure. */
import { addDays, type IsoDate } from '../calculations/dates';

export interface LoadSession {
  date: IsoDate;
  rpe: number | null;
  durationS: number;
}

export const sessionLoadOf = (s: LoadSession) =>
  s.rpe === null ? 0 : Math.round(s.rpe * (s.durationS / 60));

export function loadBetween(sessions: readonly LoadSession[], from: IsoDate, to: IsoDate): number {
  return sessions
    .filter((s) => s.date >= from && s.date <= to)
    .reduce((a, s) => a + sessionLoadOf(s), 0);
}

/**
 * Spike when the last 7 days exceed 1.3 × the mean weekly load of the 3 weeks before.
 * Needs 4 weeks of data (a session at least 21 days before today) and a non-zero baseline.
 */
export function loadSpike(
  sessions: readonly LoadSession[],
  today: IsoDate,
): { spike: boolean; last7: number; baseline: number | null } {
  const last7 = loadBetween(sessions, addDays(today, -6), today);
  const rated = sessions.filter((s) => s.rpe !== null);
  const earliest = rated.map((s) => s.date).sort()[0];
  if (!earliest || earliest > addDays(today, -21)) return { spike: false, last7, baseline: null };
  const baseline = loadBetween(sessions, addDays(today, -27), addDays(today, -7)) / 3;
  return { spike: baseline > 0 && last7 > 1.3 * baseline, last7, baseline };
}
