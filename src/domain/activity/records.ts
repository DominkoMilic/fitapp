/** Activity personal records (spec 14.3). Pure; derived from history so deletes recalculate. */
import { distanceTrusted } from '@/domain/milestones/evaluate';

export interface ActivityRecordInput {
  id: string;
  date: string;
  type: string;
  distanceM: number | null;
  movingS: number;
  paceSPerKm: number | null;
  quality: string;
  source: string;
}

export interface ActivityRecord {
  key: string;
  title: string;
  value: number;
  unit: 'm' | 's_per_km';
  date: string;
  activityId: string;
  manual: boolean;
}

const LABEL: Record<string, string> = { walk: 'walk', run: 'run', cycle: 'ride' };

export function activityRecords(list: readonly ActivityRecordInput[]): ActivityRecord[] {
  const out: ActivityRecord[] = [];
  for (const type of ['walk', 'run', 'cycle'] as const) {
    const best = list
      .filter((a) => a.type === type && (a.distanceM ?? 0) > 0 && distanceTrusted(a))
      .sort((a, b) => (b.distanceM ?? 0) - (a.distanceM ?? 0))[0];
    if (best) {
      out.push({
        key: `longest_${type}`,
        title: `Longest ${LABEL[type]}`,
        value: best.distanceM as number,
        unit: 'm',
        date: best.date,
        activityId: best.id,
        manual: best.source === 'manual',
      });
    }
  }
  // Fastest run pace: runs ≥ 1 km with good/fair GPS only (never manual; spec 11.8, 14.3).
  const fastest = list
    .filter(
      (a) =>
        a.type === 'run' &&
        a.source === 'gps' &&
        (a.quality === 'good' || a.quality === 'fair') &&
        (a.distanceM ?? 0) >= 1000 &&
        a.paceSPerKm,
    )
    .sort((a, b) => (a.paceSPerKm as number) - (b.paceSPerKm as number))[0];
  if (fastest) {
    out.push({
      key: 'fastest_run_pace',
      title: 'Fastest run pace',
      value: fastest.paceSPerKm as number,
      unit: 's_per_km',
      date: fastest.date,
      activityId: fastest.id,
      manual: false,
    });
  }
  return out;
}
