/** Workout session maths (spec 8.10, 8.11, 10.4). Pure. */
import { KG_PER_LB } from '@/domain/calculations/units';
import { sportMet } from '../sports/catalogue';

export interface SetLike {
  repetitions: number | null;
  weight_kg: number | string | null;
  duration_seconds: number | null;
  completed: boolean;
  skipped?: boolean;
}

/** Σ reps × weight over completed weighted sets (bodyweight sets add nothing; spec 28.5 #10). */
export function sessionVolumeKg(sets: readonly SetLike[]): number {
  return sets.reduce((sum, s) => {
    const w = s.weight_kg === null ? 0 : Number(s.weight_kg);
    return s.completed && s.repetitions && w > 0 ? sum + s.repetitions * w : sum;
  }, 0);
}

export const completedSetCount = (sets: readonly SetLike[]) =>
  sets.filter((s) => s.completed).length;

/** Completed if any set was done, otherwise abandoned (spec 28.5 #9). */
export function completionStatus(
  sets: readonly SetLike[],
  plannedSets: number,
): 'completed' | 'partial' | 'abandoned' {
  const done = completedSetCount(sets);
  if (done === 0) return 'abandoned';
  return plannedSets > 0 && done < plannedSets / 2 ? 'partial' : 'completed';
}

/** Active duration excluding pauses, in whole seconds. */
export function activeSeconds(startedAtMs: number, endedAtMs: number, pausedMs: number): number {
  return Math.max(0, Math.round((endedAtMs - startedAtMs - pausedMs) / 1000));
}

export const MAX_REASONABLE_SECONDS = 4 * 3600;

/** MET for a session (spec 25.4). Sport events use the sport's own values (sports catalogue). */
export function sessionMet(input: { category: string; intensity: string }): number {
  const c = input.category;
  const sport = sportMet(c);
  if (sport !== null) return sport;
  if (c === 'conditioning') return 8.0;
  if (c === 'mobility') return 2.3;
  if (c === 'recovery') return 3.0;
  if (c === 'football' || c === 'sport_skills') return 7.0;
  return input.intensity === 'hard' ? 6.0 : 3.5;
}

/** kcal ≈ MET × kg × hours (spec 8.10). Always shown as an estimate. */
export const estimateCalories = (met: number, weightKg: number, seconds: number) =>
  Math.round(met * weightKg * (seconds / 3600));

/** Session training load = RPE × minutes (spec 8.11). */
export const sessionLoad = (rpe: number | null, seconds: number) =>
  rpe === null ? null : Math.round(rpe * (seconds / 60));

/** Display a stored kg weight in the user's unit (rounded to 0.5). */
export const displayLoad = (kg: number, unit: 'metric' | 'imperial') =>
  unit === 'metric' ? Math.round(kg * 2) / 2 : Math.round((kg / KG_PER_LB) * 2) / 2;
