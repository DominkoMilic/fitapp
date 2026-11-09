import { localDateInTimezone } from '@/domain/calculations/dates';
import { exerciseId } from '@/domain/training/stable-id';
import { type ActiveWorkout, setsForSave, summarize } from '@/domain/training/active-workout';
import { EXERCISE_BY_SLUG } from '@/domain/training/catalogue';
import { estimateCalories, sessionMet } from '@/domain/training/session';

import type { ScheduledWorkout } from './schedule-api';
import type { NewSession } from './session-api';

/**
 * The saved record for a workout, whatever the source: the live timer, a time the user entered,
 * or an edit (spec 10.4). Volume, completion and calories always come from the same rules.
 */
export function sessionRecord(input: {
  workout: ActiveWorkout;
  timing: { startedAt: number; endedAt: number; durationS: number; pausedS: number };
  scheduled: ScheduledWorkout | null;
  rpe: number | null;
  feeling: number | null;
  notes: string;
  weightKg: number | null;
  timezone: string;
  source: 'app' | 'manual';
}): NewSession {
  const w = input.workout;
  const s = summarize(w, w.startedAt);
  const { durationS } = input.timing;
  return {
    scheduled: input.scheduled,
    templateSlug: w.templateSlug || null,
    title: w.title.trim() || 'Workout',
    category: w.category,
    startedAt: new Date(input.timing.startedAt).toISOString(),
    endedAt: new Date(input.timing.endedAt).toISOString(),
    localDate: localDateInTimezone(new Date(input.timing.startedAt), input.timezone),
    durationSeconds: durationS,
    pausedSeconds: input.timing.pausedS,
    rpe: input.rpe,
    feeling: input.feeling,
    volumeKg: Math.round(s.volumeKg * 10) / 10,
    calories:
      input.weightKg === null
        ? null
        : estimateCalories(
            sessionMet({ category: w.category, intensity: w.intensity }),
            input.weightKg,
            durationS,
          ),
    completion: s.status,
    source: input.source,
    notes: input.notes.trim() || null,
    sets: setsForSave(w).map((r) => ({
      ...r,
      // System exercises have deterministic ids; custom ones carry their own uuid.
      exerciseId: r.exerciseSlug.startsWith('custom:')
        ? r.exerciseSlug.slice('custom:'.length)
        : EXERCISE_BY_SLUG[r.exerciseSlug]
          ? exerciseId(r.exerciseSlug)
          : null,
    })),
  };
}
