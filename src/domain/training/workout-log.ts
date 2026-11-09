/**
 * Logging a workout after the fact, choosing your own duration, and editing a saved workout
 * (spec 10.4). Pure: times are passed in, nothing reads the clock.
 */
import { addDays, instantFromLocal, type IsoDate, isValidIsoDate } from '../calculations/dates';

import type { ActiveExercise, ActiveWorkout } from './active-workout';
import type { CatalogueExercise, TrackingType } from './catalogue';

// ------------------------------------------------------------------ timing

export type DurationMode = 'timer' | 'planned' | 'custom';

export interface ManualTiming {
  startedAt: number;
  endedAt: number;
  durationS: number;
}

export const MANUAL_LIMITS = { minMinutes: 1, maxMinutes: 300, maxDaysBack: 60 } as const;

export type TimingError = 'date' | 'time' | 'duration' | 'future' | 'too_old';

const hhmm = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/**
 * A workout you did at a given local date and start time, for a given number of minutes.
 * Rejects future workouts (5 minutes of slack for clocks) and ones more than 60 days ago.
 */
export function manualTiming(input: {
  date: IsoDate;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  now: number;
  today: IsoDate;
}): { ok: true; value: ManualTiming } | { ok: false; error: TimingError } {
  if (!isValidIsoDate(input.date)) return { ok: false, error: 'date' };
  const m = hhmm.exec(input.startTime.trim());
  if (!m) return { ok: false, error: 'time' };
  const minutes = Math.round(input.durationMinutes);
  if (
    !Number.isFinite(minutes) ||
    minutes < MANUAL_LIMITS.minMinutes ||
    minutes > MANUAL_LIMITS.maxMinutes
  )
    return { ok: false, error: 'duration' };
  if (input.date < addDays(input.today, -MANUAL_LIMITS.maxDaysBack))
    return { ok: false, error: 'too_old' };
  const startedAt = instantFromLocal(input.date, Number(m[1]) * 60 + Number(m[2]), input.timezone);
  const endedAt = startedAt + minutes * 60_000;
  // A workout you log has already happened: it can't start or end in the future.
  if (endedAt > input.now + 5 * 60_000) return { ok: false, error: 'future' };
  return { ok: true, value: { startedAt, endedAt, durationS: minutes * 60 } };
}

export const TIMING_ERROR_TEXT: Record<TimingError, string> = {
  date: 'Choose a valid date.',
  time: 'Enter the start time as HH:MM, e.g. 18:30.',
  duration: `Duration must be between ${MANUAL_LIMITS.minMinutes} and ${MANUAL_LIMITS.maxMinutes} minutes.`,
  future: 'That would end in the future. Choose an earlier start time or a shorter duration.',
  too_old: `Workouts can be logged up to ${MANUAL_LIMITS.maxDaysBack} days back.`,
};

/** "18:05" for a local minute of the day. */
export const clockText = (minuteOfDay: number) =>
  `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;

// ------------------------------------------------------------------ manual workouts

/**
 * For "I already did this": every planned set starts ticked as done with its planned values, so
 * a fully completed workout takes one tap to log; untick what you skipped.
 */
export function markAllDone(w: ActiveWorkout): ActiveWorkout {
  return {
    ...w,
    exercises: w.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((s) => ({ ...s, completed: true })),
    })),
  };
}

/** An empty workout to fill in from scratch (e.g. a home session that wasn't planned). */
export function emptyWorkout(input: {
  id: string;
  userId: string;
  title: string;
  startedAt: number;
}): ActiveWorkout {
  return {
    id: input.id,
    userId: input.userId,
    scheduledId: null,
    templateSlug: '',
    title: input.title,
    category: 'strength',
    intensity: 'moderate',
    startedAt: input.startedAt,
    pausedAt: null,
    pausedMs: 0,
    currentIndex: 0,
    restEndsAt: null,
    notes: '',
    exercises: [],
  };
}

// ------------------------------------------------------------------ saved sessions

export interface SavedSetLike {
  id: string;
  exercise_slug: string | null;
  exercise_name: string;
  set_number: number;
  repetitions: number | null;
  weight_kg: number | string | null;
  duration_seconds: number | null;
  completed: boolean;
  skipped: boolean;
  pain_flag: boolean;
  created_at?: string | null;
}

export interface SavedGroup<S extends SavedSetLike = SavedSetLike> {
  slug: string | null;
  name: string;
  rows: S[];
}

/**
 * Saved sets → one group per exercise *as it was done*. The same exercise in the warm-up and
 * again in the main part stays two groups (a new group starts when the exercise changes or the
 * set number restarts), so it never shows "Set 1" twice in one card.
 */
export function groupSavedSets<S extends SavedSetLike>(sets: readonly S[]): SavedGroup<S>[] {
  const ordered = [...sets].sort(
    (a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.set_number - b.set_number,
  );
  const groups: SavedGroup<S>[] = [];
  for (const r of ordered) {
    const g = groups[groups.length - 1];
    const prev = g?.rows[g.rows.length - 1];
    const same =
      g &&
      prev &&
      (g.slug ?? g.name) === (r.exercise_slug ?? r.exercise_name) &&
      r.set_number > prev.set_number;
    if (same) g.rows.push(r);
    else groups.push({ slug: r.exercise_slug, name: r.exercise_name, rows: [r] });
  }
  return groups;
}

const trackingOf = (rows: readonly SavedSetLike[], known?: TrackingType): TrackingType => {
  if (known) return known;
  if (rows.some((r) => r.duration_seconds !== null && r.repetitions === null)) return 'time';
  if (rows.some((r) => r.weight_kg !== null && Number(r.weight_kg) > 0)) return 'reps_weight';
  return 'reps';
};

/** A saved session → an editable workout (same shape as a live one). */
export function activeFromSaved(input: {
  session: {
    id: string;
    user_id: string;
    scheduled_workout_id: string | null;
    template_slug: string | null;
    title: string;
    category: string;
    started_at: string;
    notes: string | null;
  };
  sets: readonly SavedSetLike[];
  exercisesBySlug: Readonly<Record<string, Pick<CatalogueExercise, 'tracking' | 'unilateral'>>>;
}): ActiveWorkout {
  const exercises: ActiveExercise[] = groupSavedSets(input.sets).map((g) => {
    const known = g.slug ? input.exercisesBySlug[g.slug] : undefined;
    const tracking = trackingOf(g.rows, known?.tracking);
    return {
      slug: g.slug ?? g.name,
      name: g.name,
      phase: 'main',
      tracking,
      targetSets: g.rows.length,
      repsMin: null,
      repsMax: null,
      durationS: null,
      restS: 0,
      unilateral: known?.unilateral ?? false,
      skipped: g.rows.every((r) => r.skipped),
      painFlag: g.rows.some((r) => r.pain_flag),
      sets: g.rows.map((r) => ({
        reps: tracking === 'time' ? null : r.repetitions,
        weightKg: tracking === 'reps_weight' && r.weight_kg !== null ? Number(r.weight_kg) : null,
        durationS: tracking === 'time' ? r.duration_seconds : null,
        completed: r.completed,
      })),
    };
  });
  return {
    id: input.session.id,
    userId: input.session.user_id,
    scheduledId: input.session.scheduled_workout_id,
    templateSlug: input.session.template_slug ?? '',
    title: input.session.title,
    category: input.session.category,
    intensity: 'moderate',
    startedAt: Date.parse(input.session.started_at),
    pausedAt: null,
    pausedMs: 0,
    currentIndex: 0,
    restEndsAt: null,
    notes: input.session.notes ?? '',
    exercises,
  };
}
