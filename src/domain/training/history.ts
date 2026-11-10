/** One row of the combined training history: a workout/game session or a GPS/manual activity. */
export type HistoryEntry<S, A> =
  | { kind: 'workout'; id: string; startedAt: string; item: S }
  | { kind: 'activity'; id: string; startedAt: string; item: A };

type Row = { id: string; started_at: string };

/**
 * Workouts and activities in one list, newest first.
 * Ties keep workouts before activities so the order is stable between renders.
 */
export function mergeHistory<S extends Row, A extends Row>(
  sessions: readonly S[],
  activities: readonly A[],
): HistoryEntry<S, A>[] {
  const entries: HistoryEntry<S, A>[] = [
    ...sessions.map((s) => ({
      kind: 'workout' as const,
      id: s.id,
      startedAt: s.started_at,
      item: s,
    })),
    ...activities.map((a) => ({
      kind: 'activity' as const,
      id: a.id,
      startedAt: a.started_at,
      item: a,
    })),
  ];
  return entries.sort((a, b) => {
    const byTime = Date.parse(b.startedAt) - Date.parse(a.startedAt);
    if (byTime !== 0) return byTime;
    if (a.kind !== b.kind) return a.kind === 'workout' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}
