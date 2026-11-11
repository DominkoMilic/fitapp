import { addDays, type IsoDate } from '../calculations/dates';
import { formatDayMonth } from '../format';

/**
 * Feed items (spec 33.3). The database builds each snapshot from a whitelist; these are the only
 * keys other people can ever see, and a unit test checks them against the migration.
 */
export const FEED_SNAPSHOT_KEYS = {
  workout: ['title', 'category', 'duration_min', 'sets', 'volume_kg'],
  activity: ['type', 'distance_km', 'moving_min', 'pace_s_per_km', 'manual', 'shape'],
  milestone: ['title'],
} as const;

export type FeedKind = 'workout' | 'activity' | 'milestone' | 'challenge_done' | 'club_joined';

export const CHEER_KINDS = [
  { kind: 'clap', emoji: '👏', label: 'Applause' },
  { kind: 'fire', emoji: '🔥', label: 'On fire' },
  { kind: 'strong', emoji: '💪', label: 'Strong' },
  { kind: 'star', emoji: '⭐', label: 'Star' },
] as const;
export type CheerKind = (typeof CHEER_KINDS)[number]['kind'];

export const cheerEmoji = (kind: string): string =>
  CHEER_KINDS.find((c) => c.kind === kind)?.emoji ?? '👏';

export const cheerTotal = (cheers: Record<string, number>): number =>
  Object.values(cheers).reduce((a, n) => a + n, 0);

const ACTIVITY_LABEL: Record<string, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Ride',
  other: 'Activity',
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** "5:23 /km" */
export function formatPace(secondsPerKm: number): string {
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`;
}

/** The heading of a feed card: what was done, e.g. "Strength A" or "Run". */
export function feedTitle(kind: string, snapshot: Record<string, unknown>): string {
  if (kind === 'activity') return ACTIVITY_LABEL[str(snapshot.type) ?? 'other'] ?? 'Activity';
  if (kind === 'milestone') return str(snapshot.title) ?? 'Milestone';
  return str(snapshot.title) ?? 'Workout';
}

/** The detail line: "45 min · 9 sets · 1,200 kg" or "5.21 km · 28 min · 5:23 /km". */
/**
 * The shared route shape of an activity (pieces of [x, y] in a 0–1000 box), or null. Anything
 * malformed is ignored rather than drawn.
 */
export function feedShape(snapshot: Record<string, unknown>): number[][][] | null {
  const s = snapshot.shape;
  if (!Array.isArray(s)) return null;
  const pieces = s
    .filter(Array.isArray)
    .map((piece: unknown[]) =>
      piece.filter(
        (p): p is number[] =>
          Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number'),
      ),
    )
    .filter((piece) => piece.length > 1);
  return pieces.length ? pieces : null;
}

export function feedDetail(kind: string, snapshot: Record<string, unknown>): string {
  const parts: string[] = [];
  if (kind === 'workout') {
    const min = num(snapshot.duration_min);
    const sets = num(snapshot.sets);
    const vol = num(snapshot.volume_kg);
    if (min) parts.push(`${min} min`);
    if (sets) parts.push(sets === 1 ? '1 set' : `${sets} sets`);
    if (vol) parts.push(`${Math.round(vol).toLocaleString('en-GB')} kg lifted`);
  } else if (kind === 'activity') {
    const km = num(snapshot.distance_km);
    const min = num(snapshot.moving_min);
    const pace = num(snapshot.pace_s_per_km);
    if (km) parts.push(`${km.toFixed(2)} km`);
    if (min) parts.push(`${min} min`);
    if (pace && km) parts.push(formatPace(pace));
    if (snapshot.manual === true) parts.push('logged by hand');
  } else if (kind === 'milestone') {
    parts.push('Milestone unlocked');
  }
  return parts.join(' · ');
}

/** "Today", "Yesterday" or "12 Nov". */
export function relativeDay(date: IsoDate, today: IsoDate): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return formatDayMonth(date);
}
