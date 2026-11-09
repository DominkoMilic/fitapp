/**
 * Changing an activity's type after saving (spec 11.6, 28.6 #15): metrics and PR eligibility are
 * recomputed. With a stored route the points are re-filtered with the new type's speed cap; without
 * one (manual, or route deleted) the distance is kept and only pace/speed/calories change. Pure.
 */
import { paceSecondsPerKm, speedMps } from './geo';
import { addPoint, breakTrack, emptyTrack, gpsQuality, type RawPoint } from './gps-filter';
import { TYPICAL_KMH } from './manual';
import { activityCalories, type ActivityType } from './met';

export interface RetypeInput {
  type: ActivityType;
  source: 'gps' | 'manual';
  /** Accepted points from the route file, or null when there is no route. */
  pieces: RawPoint[][] | null;
  movingS: number;
  distanceM: number | null;
  maxSpeedMps: number | null;
  quality: 'good' | 'fair' | 'poor' | 'none';
  pointsTotal: number;
  pointsValid: number;
  weightKg: number | null;
}

export interface RetypeResult {
  distanceM: number | null;
  avgSpeedMps: number;
  maxSpeedMps: number | null;
  avgPaceSPerKm: number | null;
  kcal: number | null;
  quality: 'good' | 'fair' | 'poor' | 'none';
  pointsValid: number;
}

export function retypeActivity(i: RetypeInput): RetypeResult {
  let distanceM = i.distanceM;
  let maxSpeed = i.maxSpeedMps;
  let quality = i.quality;
  let pointsValid = i.pointsValid;
  if (i.pieces && i.pieces.length) {
    let track = emptyTrack();
    let stored = 0;
    i.pieces.forEach((piece, n) => {
      if (n > 0) track = breakTrack(track);
      for (const p of piece) {
        stored++;
        track = addPoint(track, p, i.type).track;
      }
    });
    distanceM = Math.round(track.distanceM);
    maxSpeed = track.maxSpeedMps;
    // Points the new cap rejects are subtracted from the original valid count.
    pointsValid = Math.max(0, i.pointsValid - (stored - track.pointsValid));
    quality = gpsQuality({
      pointsTotal: i.pointsTotal,
      pointsValid,
      accuracies: track.accuracies,
    });
  }
  const d = distanceM ?? 0;
  const avg = speedMps(d, i.movingS);
  const kmh = d > 0 ? avg * 3.6 : TYPICAL_KMH[i.type];
  return {
    distanceM,
    avgSpeedMps: avg,
    maxSpeedMps: maxSpeed,
    avgPaceSPerKm: d > 0 ? paceSecondsPerKm(d, i.movingS) : null,
    kcal: i.weightKg ? activityCalories(i.type, kmh, i.weightKg, i.movingS) : null,
    quality: i.source === 'manual' ? 'none' : quality,
    pointsValid,
  };
}
