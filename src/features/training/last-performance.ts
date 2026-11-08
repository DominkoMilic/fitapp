import { useMemo } from 'react';

import type { LastSets } from '@/domain/training/active-workout';

import { useSessions } from './session-api';

/** Completed sets from the most recent session of each exercise (for pre-filling and progression). */
export function useLastSets(): {
  lastSets: LastSets;
  lastRpeBySlug: Record<string, number | null>;
} {
  const { sessions, sets } = useSessions();
  return useMemo(() => {
    const sessionTime = new Map(sessions.map((s) => [s.id, s.started_at]));
    const sessionRpe = new Map(
      sessions.map((s) => [
        s.id,
        s.perceived_exertion === null ? null : Number(s.perceived_exertion),
      ]),
    );
    const latest = new Map<string, string>();
    for (const s of sets) {
      if (!s.exercise_slug || !s.completed) continue;
      const t = sessionTime.get(s.workout_session_id) ?? '';
      const cur = latest.get(s.exercise_slug);
      if (!cur || (sessionTime.get(cur) ?? '') < t)
        latest.set(s.exercise_slug, s.workout_session_id);
    }
    const lastSets: LastSets = {};
    const lastRpeBySlug: Record<string, number | null> = {};
    for (const [slug, sessionId] of latest) {
      lastSets[slug] = sets
        .filter(
          (s) => s.exercise_slug === slug && s.workout_session_id === sessionId && s.completed,
        )
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          reps: s.repetitions,
          weightKg: s.weight_kg === null ? null : Number(s.weight_kg),
          durationS: s.duration_seconds,
        }));
      lastRpeBySlug[slug] = sessionRpe.get(sessionId) ?? null;
    }
    return { lastSets, lastRpeBySlug };
  }, [sessions, sets]);
}
