/**
 * Offline outbox rules (spec section 18.2). Pure functions over an immutable queue.
 *
 * - Every write is an op keyed by (entity, recordKey). Records use client-generated ids,
 *   so replaying an upsert is idempotent on the server.
 * - Ops collapse: upsert+upsert → latest upsert; upsert+delete before sync → nothing
 *   (only if the record was created offline); delete+upsert → upsert.
 * - Failed ops are kept (status 'failed') and shown to the user; never dropped silently.
 */
export type SyncEntity =
  | 'weight_entries'
  | 'body_measurements'
  | 'daily_checkins'
  | 'user_milestones'
  | 'exercises'
  | 'scheduled_workouts'
  | 'workout_sessions'
  | 'exercise_sets'
  | 'activities'
  | 'activity_routes'
  | 'weekly_reports';

/** Parents sync before children (e.g. sessions → sets, activities → routes). */
export const ENTITY_ORDER: Record<SyncEntity, number> = {
  user_milestones: 0,
  exercises: 0,
  scheduled_workouts: 0,
  weight_entries: 1,
  body_measurements: 1,
  daily_checkins: 1,
  workout_sessions: 1,
  exercise_sets: 2,
  activities: 1,
  // Route JSON is uploaded after the activity row exists (storage path is checked against it).
  activity_routes: 2,
  weekly_reports: 0,
};

export type OpKind = 'upsert' | 'delete';
/** 'synced' only appears in the local overlay, never in the stored queue. */
export type OpStatus = 'pending' | 'failed' | 'synced';
export type Row = Record<string, unknown>;

export interface OutboxOp {
  id: string;
  userId: string;
  entity: SyncEntity;
  /** Stable key of the record (its id, or natural key such as the check-in date). */
  recordKey: string;
  kind: OpKind;
  /** Full row for upserts; null for deletes. */
  payload: Row | null;
  /** True when the record has never reached the server (created offline). */
  createdOffline: boolean;
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  status: OpStatus;
  lastError: string | null;
}

export type NewOp = Pick<
  OutboxOp,
  'id' | 'userId' | 'entity' | 'recordKey' | 'kind' | 'payload' | 'createdOffline'
>;

const same = (
  a: { entity: SyncEntity; recordKey: string },
  b: { entity: SyncEntity; recordKey: string },
) => a.entity === b.entity && a.recordKey === b.recordKey;

/** Adds an op, collapsing it with any queued op for the same record. */
/**
 * Drops stored operations for entities PACE no longer has (nutrition was removed on 2026-11-18),
 * so an old queue can never block syncing.
 */
export function knownOps(queue: readonly OutboxOp[]): OutboxOp[] {
  return queue.filter((op) => op.entity in ENTITY_ORDER);
}

export function enqueue(queue: readonly OutboxOp[], op: NewOp, now: string): OutboxOp[] {
  const existing = queue.find((q) => same(q, op));
  const fresh: OutboxOp = {
    ...op,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
    status: 'pending',
    lastError: null,
  };
  if (!existing) return [...queue, fresh];

  const rest = queue.filter((q) => q !== existing);
  if (op.kind === 'delete' && existing.kind === 'upsert' && existing.createdOffline) {
    // Created and deleted before reaching the server: nothing to send.
    return rest;
  }
  // Keep the original position (createdAt) so ordering stays FIFO; carry createdOffline forward.
  const merged: OutboxOp = {
    ...fresh,
    id: existing.id,
    createdAt: existing.createdAt,
    createdOffline: existing.createdOffline && op.kind === 'upsert',
  };
  return [...rest, merged].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Ops ready to send now, in FIFO order with parents first. */
export function readyOps(queue: readonly OutboxOp[], now: string): OutboxOp[] {
  return queue
    .filter((q) => q.status === 'pending' && q.nextAttemptAt <= now)
    .sort(
      (a, b) =>
        ENTITY_ORDER[a.entity] - ENTITY_ORDER[b.entity] || a.createdAt.localeCompare(b.createdAt),
    );
}

/** Exponential backoff: 2 s, 4 s, 8 s … capped at 5 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(2000 * 2 ** Math.max(0, attempts - 1), 5 * 60 * 1000);
}

export type ErrorClass = 'network' | 'auth' | 'permanent';

export interface TransportErrorLike {
  status?: number | null;
  code?: string | null;
  message?: string | null;
  name?: string | null;
}

/** Network/5xx → retry later; 401/JWT → refresh then retry; other 4xx/DB errors → failed. */
export function classifyError(error: TransportErrorLike): ErrorClass {
  const message = (error.message ?? '').toLowerCase();
  const status = error.status ?? null;
  if (
    status === 401 ||
    error.code === 'PGRST301' ||
    error.code === 'PGRST303' ||
    message.includes('jwt expired')
  ) {
    return 'auth';
  }
  if (status === null || status === 0) return 'network';
  if (status === 408 || status === 429 || status >= 500) return 'network';
  if (/network|failed to fetch|timeout/.test(message) && status < 400) return 'network';
  return 'permanent';
}

export function markSucceeded(queue: readonly OutboxOp[], opId: string): OutboxOp[] {
  return queue.filter((q) => q.id !== opId);
}

export function markFailed(
  queue: readonly OutboxOp[],
  opId: string,
  errorClass: ErrorClass,
  message: string,
  now: Date,
): OutboxOp[] {
  return queue.map((q) => {
    if (q.id !== opId) return q;
    const attempts = q.attempts + 1;
    if (errorClass === 'permanent') return { ...q, attempts, status: 'failed', lastError: message };
    return {
      ...q,
      attempts,
      lastError: message,
      nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)).toISOString(),
    };
  });
}

/** User chose "Retry" on a failed op. */
export function retryOp(queue: readonly OutboxOp[], opId: string, now: string): OutboxOp[] {
  return queue.map((q) =>
    q.id === opId ? { ...q, status: 'pending', nextAttemptAt: now, lastError: null } : q,
  );
}

/** User chose "Discard" on a failed op (explicit, never automatic). */
export function discardOp(queue: readonly OutboxOp[], opId: string): OutboxOp[] {
  return queue.filter((q) => q.id !== opId);
}

/**
 * Local view of a table: server rows with pending local writes applied on top, so offline
 * entries appear immediately and deleted ones disappear.
 */
export function applyPending<T extends Row>(
  serverRows: readonly T[],
  queue: readonly OutboxOp[],
  entity: SyncEntity,
  keyOf: (row: T) => string,
): (T & { _pending?: boolean; _failed?: boolean })[] {
  const ops = queue.filter((q) => q.entity === entity);
  const byKey = new Map<string, T & { _pending?: boolean; _failed?: boolean }>(
    serverRows.map((r) => [keyOf(r), { ...r }]),
  );
  for (const op of ops) {
    if (op.kind === 'delete') byKey.delete(op.recordKey);
    else if (op.payload) {
      byKey.set(op.recordKey, {
        ...(byKey.get(op.recordKey) ?? {}),
        ...(op.payload as T),
        _pending: op.status === 'pending',
        _failed: op.status === 'failed',
      });
    }
  }
  return [...byKey.values()];
}

export function queueSummary(queue: readonly OutboxOp[]): { pending: number; failed: number } {
  return {
    pending: queue.filter((q) => q.status === 'pending').length,
    failed: queue.filter((q) => q.status === 'failed').length,
  };
}
