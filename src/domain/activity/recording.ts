/**
 * Activity recording state (spec 11.1, 11.6). Pure; the app persists it after every change so a
 * killed app can resume or finish. Times are epoch ms passed in.
 */
import { formatPace, paceSecondsPerKm, speedMps } from './geo';
import {
  addPoint,
  breakTrack,
  emptyTrack,
  gpsQuality,
  type RawPoint,
  recentWindow,
  type Track,
} from './gps-filter';
import { activityCalories, type ActivityType } from './met';

export interface Recording {
  id: string;
  userId: string;
  type: ActivityType;
  startedAt: number;
  status: 'recording' | 'paused';
  pausedAt: number | null;
  pausedMs: number;
  track: Track;
  /** Last time anything was saved; used to offer resume (< 6 h) after a kill. */
  updatedAt: number;
}

export const RESUME_WINDOW_MS = 6 * 3600_000;

export function startRecording(input: {
  id: string;
  userId: string;
  type: ActivityType;
  now: number;
}): Recording {
  return {
    ...input,
    startedAt: input.now,
    status: 'recording',
    pausedAt: null,
    pausedMs: 0,
    track: emptyTrack(),
    updatedAt: input.now,
  };
}

/** Points arriving while paused are ignored (no distance across a pause; spec 28.6 #8). */
export function addPoints(r: Recording, points: readonly RawPoint[], now: number): Recording {
  if (r.status === 'paused' || !points.length) return { ...r, updatedAt: now };
  let track = r.track;
  for (const p of [...points].sort((a, b) => a.t - b.t)) {
    if (p.t < r.startedAt) continue;
    track = addPoint(track, p, r.type).track;
  }
  return { ...r, track, updatedAt: now };
}

export function pauseRecording(r: Recording, now: number): Recording {
  return r.status === 'paused'
    ? r
    : { ...r, status: 'paused', pausedAt: now, track: breakTrack(r.track), updatedAt: now };
}

export function resumeRecording(r: Recording, now: number): Recording {
  if (r.status !== 'paused' || r.pausedAt === null) return r;
  return {
    ...r,
    status: 'recording',
    pausedMs: r.pausedMs + (now - r.pausedAt),
    pausedAt: null,
    updatedAt: now,
  };
}

export function canResume(r: Recording, now: number): boolean {
  return now - r.updatedAt < RESUME_WINDOW_MS;
}

export interface LiveStats {
  elapsedS: number;
  movingS: number;
  distanceM: number;
  avgPaceSPerKm: number | null;
  currentPaceSPerKm: number | null;
  avgSpeedMps: number;
  currentSpeedMps: number;
  kcal: number | null;
}

export function liveStats(r: Recording, now: number, weightKg: number | null): LiveStats {
  const end = r.pausedAt ?? now;
  const elapsedS = Math.max(0, Math.round((now - r.startedAt) / 1000));
  const movingS = Math.max(0, Math.round((end - r.startedAt - r.pausedMs) / 1000));
  const distanceM = r.track.distanceM;
  const recent = recentWindow(r.track);
  const currentSpeed =
    r.status === 'recording' && recent.seconds >= 5 ? recent.distanceM / recent.seconds : 0;
  const avg = speedMps(distanceM, movingS);
  return {
    elapsedS,
    movingS,
    distanceM,
    avgPaceSPerKm: paceSecondsPerKm(distanceM, movingS),
    currentPaceSPerKm: distanceM >= 100 && currentSpeed > 0.3 ? 1000 / currentSpeed : null,
    avgSpeedMps: avg,
    currentSpeedMps: currentSpeed,
    kcal: weightKg ? activityCalories(r.type, avg * 3.6, weightKg, movingS) : null,
  };
}

export interface ActivitySummary {
  type: ActivityType;
  startedAt: number;
  endedAt: number;
  elapsedS: number;
  movingS: number;
  distanceM: number;
  avgSpeedMps: number;
  maxSpeedMps: number;
  avgPaceSPerKm: number | null;
  kcal: number | null;
  quality: ReturnType<typeof gpsQuality>;
  pointsTotal: number;
  pointsValid: number;
  /** Under 60 s or 50 m: ask before saving (spec 11.6). */
  isShort: boolean;
}

export function finishRecording(
  r: Recording,
  now: number,
  weightKg: number | null,
): ActivitySummary {
  const stopped = r.status === 'paused' ? r : pauseRecording(r, now);
  const s = liveStats(stopped, stopped.pausedAt ?? now, weightKg);
  return {
    type: r.type,
    startedAt: r.startedAt,
    endedAt: stopped.pausedAt ?? now,
    elapsedS: Math.round(((stopped.pausedAt ?? now) - r.startedAt) / 1000),
    movingS: s.movingS,
    distanceM: Math.round(s.distanceM),
    avgSpeedMps: s.avgSpeedMps,
    maxSpeedMps: r.track.maxSpeedMps,
    avgPaceSPerKm: s.avgPaceSPerKm,
    kcal: s.kcal,
    quality: gpsQuality(r.track),
    pointsTotal: r.track.pointsTotal,
    pointsValid: r.track.pointsValid,
    isShort: s.movingS < 60 || s.distanceM < 50,
  };
}

export { formatPace };
