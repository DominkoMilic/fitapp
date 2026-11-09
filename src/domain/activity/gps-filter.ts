/**
 * GPS point filter and track accumulation (spec 11.4). Pure: feed raw points one by one.
 */
import { haversineM } from './geo';
import type { ActivityType } from './met';

export interface RawPoint {
  /** epoch ms */
  t: number;
  lat: number;
  lng: number;
  alt: number | null;
  /** horizontal accuracy in metres (null = unknown) */
  acc: number | null;
}

export const MAX_ACCURACY_M = 25;
export const SPEED_CAP_MPS: Record<ActivityType, number> = {
  walk: 3.5,
  run: 8,
  cycle: 25,
  other: 25,
};
const GAP_MS = 30_000;
const REANCHOR_AFTER = 5;

export type PointVerdict =
  'accept' | 'jitter' | 'reject_accuracy' | 'reject_order' | 'reject_speed' | 'new_piece';

export interface Track {
  /** Pieces of continuous route; distance is never added between pieces (pauses, gaps). */
  pieces: RawPoint[][];
  distanceM: number;
  pointsTotal: number;
  /** Valid fixes (accepted + jitter + new pieces). */
  pointsValid: number;
  /** Accuracies of valid fixes, for the quality rating. */
  accuracies: number[];
  /** Last valid fix time (jitter updates it too). */
  lastFixT: number | null;
  rejectStreak: number;
  maxSpeedMps: number;
}

export const emptyTrack = (): Track => ({
  pieces: [],
  distanceM: 0,
  pointsTotal: 0,
  pointsValid: 0,
  accuracies: [],
  lastFixT: null,
  rejectStreak: 0,
  maxSpeedMps: 0,
});

/** Starts a new piece (after a pause): the next valid point is an anchor, no distance from before. */
export const breakTrack = (t: Track): Track =>
  t.pieces.length && t.pieces[t.pieces.length - 1]!.length
    ? { ...t, pieces: [...t.pieces, []] }
    : t;

export function addPoint(
  track: Track,
  p: RawPoint,
  type: ActivityType,
): { track: Track; verdict: PointVerdict } {
  const t: Track = { ...track, pointsTotal: track.pointsTotal + 1 };
  const valid = (verdict: PointVerdict, next: Partial<Track>) => ({
    track: {
      ...t,
      ...next,
      pointsValid: t.pointsValid + 1,
      accuracies: [...t.accuracies, p.acc ?? MAX_ACCURACY_M],
      lastFixT: p.t,
      rejectStreak: 0,
    },
    verdict,
  });

  if (p.acc !== null && p.acc > MAX_ACCURACY_M) return { track: t, verdict: 'reject_accuracy' };
  if (
    !Number.isFinite(p.lat) ||
    !Number.isFinite(p.lng) ||
    Math.abs(p.lat) > 90 ||
    Math.abs(p.lng) > 180
  ) {
    return { track: t, verdict: 'reject_accuracy' };
  }
  if (t.lastFixT !== null && p.t <= t.lastFixT) return { track: t, verdict: 'reject_order' };

  const pieces = t.pieces.length ? t.pieces : [[]];
  const current = pieces[pieces.length - 1]!;
  const prev = current[current.length - 1];
  if (!prev) {
    // First point of a piece: an anchor.
    return valid('accept', { pieces: [...pieces.slice(0, -1), [p]] });
  }

  const d = haversineM(prev, p);
  const dt = (p.t - prev.t) / 1000;
  const speed = dt > 0 ? d / dt : Infinity;
  if (speed > SPEED_CAP_MPS[type]) {
    const lastSeen = t.lastFixT ?? prev.t;
    // After a long signal gap, or after repeated rejections (the anchor itself may be bad),
    // start a new piece instead of drawing an impossible line.
    if (p.t - lastSeen > GAP_MS || t.rejectStreak + 1 >= REANCHOR_AFTER) {
      return valid('new_piece', { pieces: [...pieces, [p]] });
    }
    return { track: { ...t, rejectStreak: t.rejectStreak + 1 }, verdict: 'reject_speed' };
  }
  const jitter = Math.max(3, 0.5 * (p.acc ?? 0));
  if (d < jitter) return valid('jitter', {});
  return valid('accept', {
    pieces: [...pieces.slice(0, -1), [...current, p]],
    distanceM: t.distanceM + d,
    maxSpeedMps: Math.max(t.maxSpeedMps, speed),
  });
}

export type GpsQuality = 'good' | 'fair' | 'poor' | 'none';

/** good: ≥90% valid and median accuracy ≤10 m; fair: ≥70% and ≤20 m; otherwise poor. */
export function gpsQuality(
  t: Pick<Track, 'pointsTotal' | 'pointsValid' | 'accuracies'>,
): GpsQuality {
  if (t.pointsTotal === 0) return 'none';
  const share = t.pointsValid / t.pointsTotal;
  const sorted = [...t.accuracies].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : Infinity;
  if (share >= 0.9 && median <= 10) return 'good';
  if (share >= 0.7 && median <= 20) return 'fair';
  return 'poor';
}

/** Distance and time over the last `windowS` seconds of the current piece (for current pace). */
export function recentWindow(track: Track, windowS = 30): { distanceM: number; seconds: number } {
  const piece = track.pieces[track.pieces.length - 1] ?? [];
  const last = piece[piece.length - 1];
  if (!last) return { distanceM: 0, seconds: 0 };
  let d = 0;
  let first = last;
  for (let i = piece.length - 1; i > 0; i--) {
    const a = piece[i - 1]!;
    if ((last.t - a.t) / 1000 > windowS) break;
    d += haversineM(a, piece[i]!);
    first = a;
  }
  return { distanceM: d, seconds: (last.t - first.t) / 1000 };
}
