/**
 * Double progression for light equipment (spec 10.5). Pure.
 * When every working set reached the top of the range at RPE ≤ 8, progress in this order:
 * more reps (up to 20) → slower tempo → unilateral → extra set (max 4) → shorter rest
 * (min 45 s). Heavier equipment is suggested when available.
 */
export interface LastPerformance {
  sets: { reps: number | null; weightKg: number | null; completed: boolean }[];
  repsMax: number | null;
  plannedSets: number;
  rpe: number | null;
  restS: number;
  unilateral: boolean;
  /** Sessions in a row at RPE ≥ 9.5, newest last. */
  veryHardStreak: number;
  heavierWeightAvailableKg: number | null;
}

export type Suggestion =
  | { kind: 'repeat'; message: string }
  | { kind: 'more_reps'; targetReps: number; message: string }
  | { kind: 'heavier'; weightKg: number; message: string }
  | { kind: 'tempo'; message: string }
  | { kind: 'unilateral'; message: string }
  | { kind: 'extra_set'; sets: number; message: string }
  | { kind: 'less_rest'; restS: number; message: string }
  | { kind: 'none'; message: string };

export function suggestProgression(p: LastPerformance): Suggestion {
  if (p.veryHardStreak >= 2)
    return {
      kind: 'repeat',
      message: 'Last two sessions felt very hard. Repeat the same targets.',
    };
  const working = p.sets.filter((s) => s.completed);
  if (!working.length || p.repsMax === null)
    return { kind: 'none', message: 'Do your best quality reps.' };
  const allTop =
    working.length >= p.plannedSets && working.every((s) => (s.reps ?? 0) >= p.repsMax!);
  if (!allTop || (p.rpe !== null && p.rpe > 8))
    return { kind: 'repeat', message: 'Aim to reach the top of the rep range on every set.' };
  const lastWeight = Math.max(0, ...working.map((s) => s.weightKg ?? 0));
  if (p.heavierWeightAvailableKg !== null && p.heavierWeightAvailableKg > lastWeight) {
    return {
      kind: 'heavier',
      weightKg: p.heavierWeightAvailableKg,
      message: `Try ${p.heavierWeightAvailableKg} kg next time.`,
    };
  }
  const bestReps = Math.max(...working.map((s) => s.reps ?? 0));
  if (bestReps < 20) {
    const target = Math.min(20, bestReps + 2);
    return {
      kind: 'more_reps',
      targetReps: target,
      message: `Add reps: aim for ${target} per set.`,
    };
  }
  if (!p.unilateral)
    return { kind: 'tempo', message: 'Slow it down: 3 seconds down, 1 second pause, 1 second up.' };
  if (p.plannedSets < 4)
    return {
      kind: 'extra_set',
      sets: p.plannedSets + 1,
      message: `Add a set: ${p.plannedSets + 1} sets.`,
    };
  if (p.restS > 45) {
    const rest = Math.max(45, p.restS - 15);
    return { kind: 'less_rest', restS: rest, message: `Shorten rest to ${rest} s.` };
  }
  return {
    kind: 'unilateral',
    message: 'Try a single-arm or single-leg variation for more challenge.',
  };
}
