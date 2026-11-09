/**
 * In-progress workout as a pure state machine (spec 10.4). Every function returns a new state.
 * Times are epoch milliseconds passed in by the caller; the rest timer is an absolute end time,
 * so it stays correct while the app is in the background (spec 28.5 #7).
 */
import type { TemplatePhase, TrackingType } from './catalogue';
import {
  activeSeconds,
  completionStatus,
  MAX_REASONABLE_SECONDS,
  sessionVolumeKg,
} from './session';
import type { BuiltWorkout } from './workout-builder';

export interface ActiveSet {
  reps: number | null;
  weightKg: number | null;
  durationS: number | null;
  completed: boolean;
}

export interface ActiveExercise {
  slug: string;
  name: string;
  phase: TemplatePhase;
  tracking: TrackingType;
  targetSets: number;
  repsMin: number | null;
  repsMax: number | null;
  durationS: number | null;
  restS: number;
  unilateral: boolean;
  skipped: boolean;
  painFlag: boolean;
  sets: ActiveSet[];
}

export interface ActiveWorkout {
  id: string;
  userId: string;
  scheduledId: string | null;
  templateSlug: string;
  title: string;
  category: string;
  intensity: string;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  currentIndex: number;
  restEndsAt: number | null;
  exercises: ActiveExercise[];
  notes: string;
}

export type LastSets = Record<
  string,
  { reps: number | null; weightKg: number | null; durationS: number | null }[]
>;

export function createActiveWorkout(input: {
  id: string;
  userId: string;
  scheduledId: string | null;
  built: BuiltWorkout;
  category: string;
  intensity: string;
  now: number;
  /** Values from the last time each exercise was done, used to pre-fill sets. */
  lastSets: LastSets;
}): ActiveWorkout {
  return {
    id: input.id,
    userId: input.userId,
    scheduledId: input.scheduledId,
    templateSlug: input.built.templateSlug,
    title: input.built.title,
    category: input.category,
    intensity: input.intensity,
    startedAt: input.now,
    pausedAt: null,
    pausedMs: 0,
    currentIndex: 0,
    restEndsAt: null,
    notes: '',
    exercises: input.built.exercises.map((e) => {
      const last = input.lastSets[e.slug] ?? [];
      return {
        slug: e.slug,
        name: e.name,
        phase: e.phase,
        tracking: e.tracking,
        targetSets: e.sets,
        repsMin: e.repsMin,
        repsMax: e.repsMax,
        durationS: e.durationS,
        restS: e.restS,
        unilateral: e.unilateral,
        skipped: false,
        painFlag: false,
        sets: Array.from({ length: e.sets }, (_, i) => {
          const prev = last[i] ?? last[last.length - 1];
          return {
            reps: e.tracking === 'time' ? null : (prev?.reps ?? e.repsMax ?? e.repsMin),
            weightKg: e.tracking === 'reps_weight' ? (prev?.weightKg ?? null) : null,
            durationS: e.tracking === 'time' ? (prev?.durationS ?? e.durationS) : null,
            completed: false,
          };
        }),
      };
    }),
  };
}

const mapExercise = (
  w: ActiveWorkout,
  index: number,
  fn: (e: ActiveExercise) => ActiveExercise,
): ActiveWorkout => ({
  ...w,
  exercises: w.exercises.map((e, i) => (i === index ? fn(e) : e)),
});

export function updateSet(
  w: ActiveWorkout,
  exIndex: number,
  setIndex: number,
  patch: Partial<ActiveSet>,
): ActiveWorkout {
  return mapExercise(w, exIndex, (e) => ({
    ...e,
    sets: e.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
  }));
}

/** Marks a set done (or undone) and starts the rest timer after a completed set. */
export function toggleSetDone(
  w: ActiveWorkout,
  exIndex: number,
  setIndex: number,
  now: number,
): ActiveWorkout {
  const ex = w.exercises[exIndex];
  const set = ex?.sets[setIndex];
  if (!ex || !set) return w;
  const done = !set.completed;
  const next = updateSet(w, exIndex, setIndex, { completed: done });
  const isLastSet = ex.sets.every((s, i) => i === setIndex || s.completed);
  return {
    ...next,
    restEndsAt:
      done && ex.restS > 0 && !isLastSet ? now + ex.restS * 1000 : done ? null : w.restEndsAt,
  };
}

export function addSet(w: ActiveWorkout, exIndex: number): ActiveWorkout {
  return mapExercise(w, exIndex, (e) => {
    if (e.sets.length >= 10) return e;
    const last = e.sets[e.sets.length - 1];
    return {
      ...e,
      sets: [
        ...e.sets,
        {
          reps: last?.reps ?? null,
          weightKg: last?.weightKg ?? null,
          durationS: last?.durationS ?? null,
          completed: false,
        },
      ],
    };
  });
}

export const skipRest = (w: ActiveWorkout): ActiveWorkout => ({ ...w, restEndsAt: null });

export function restRemainingS(w: ActiveWorkout, now: number): number {
  return w.restEndsAt === null ? 0 : Math.max(0, Math.ceil((w.restEndsAt - now) / 1000));
}

export function goTo(w: ActiveWorkout, index: number): ActiveWorkout {
  return { ...w, currentIndex: Math.max(0, Math.min(w.exercises.length - 1, index)) };
}

/** Skip the exercise and move on. */
export function skipExercise(w: ActiveWorkout, exIndex: number): ActiveWorkout {
  return goTo(
    { ...mapExercise(w, exIndex, (e) => ({ ...e, skipped: true })), restEndsAt: null },
    exIndex + 1,
  );
}

/** "Pain" button (spec 9.3): ends the exercise, flags it, never suggests pushing through. */
export function reportPain(w: ActiveWorkout, exIndex: number): ActiveWorkout {
  return {
    ...mapExercise(w, exIndex, (e) => ({
      ...e,
      painFlag: true,
      skipped: e.sets.every((s) => !s.completed),
    })),
    restEndsAt: null,
  };
}

export const isPaused = (w: ActiveWorkout) => w.pausedAt !== null;

export function pause(w: ActiveWorkout, now: number): ActiveWorkout {
  return w.pausedAt !== null ? w : { ...w, pausedAt: now };
}

export function resume(w: ActiveWorkout, now: number): ActiveWorkout {
  return w.pausedAt === null
    ? w
    : { ...w, pausedAt: null, pausedMs: w.pausedMs + (now - w.pausedAt) };
}

export function elapsedS(w: ActiveWorkout, now: number): number {
  const end = w.pausedAt ?? now;
  return activeSeconds(w.startedAt, end, w.pausedMs);
}

export interface WorkoutSummary {
  durationS: number;
  pausedS: number;
  exercisesDone: number;
  setsDone: number;
  plannedSets: number;
  volumeKg: number;
  status: 'completed' | 'partial' | 'abandoned';
  painReported: boolean;
  /** Longer than 4 hours: ask the user to confirm the end time (spec 28.5 #8). */
  suspiciouslyLong: boolean;
}

export function summarize(w: ActiveWorkout, now: number): WorkoutSummary {
  const finished = resume(w, now);
  const flatSets = finished.exercises.flatMap((e) =>
    e.sets.map((s) => ({
      repetitions: s.reps,
      weight_kg: s.weightKg,
      duration_seconds: s.durationS,
      completed: s.completed,
    })),
  );
  // All phases, so "sets done" and "planned" count the same things (warm-up included).
  const planned = finished.exercises.reduce((a, e) => a + e.targetSets, 0);
  const durationS = elapsedS(finished, now);
  return {
    durationS,
    pausedS: Math.round(finished.pausedMs / 1000),
    exercisesDone: finished.exercises.filter((e) => e.sets.some((s) => s.completed)).length,
    setsDone: flatSets.filter((s) => s.completed).length,
    plannedSets: planned,
    volumeKg: sessionVolumeKg(flatSets),
    status: completionStatus(flatSets, planned),
    painReported: finished.exercises.some((e) => e.painFlag),
    suspiciouslyLong: durationS > MAX_REASONABLE_SECONDS,
  };
}

/** Rows for exercise_sets: every set of every exercise that was started or skipped. */
export function setsForSave(w: ActiveWorkout) {
  return w.exercises.flatMap((e) =>
    e.sets.map((s, i) => ({
      exerciseSlug: e.slug,
      exerciseName: e.name,
      setNumber: i + 1,
      reps: e.tracking === 'time' ? null : s.reps,
      weightKg: e.tracking === 'reps_weight' ? s.weightKg : null,
      durationS: e.tracking === 'time' ? s.durationS : null,
      completed: s.completed,
      skipped: e.skipped && !s.completed,
      painFlag: e.painFlag,
    })),
  );
}
