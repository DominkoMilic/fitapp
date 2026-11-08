import type { OutboxOp, SyncEntity } from '@/domain/sync/outbox';
import { requireSupabase } from '@/integrations/supabase/client';

import type { Transport } from './sync-engine';

interface EntityConfig {
  onConflict: string;
  /** Column holding the owner's id (default user_id). */
  ownerColumn?: 'user_id' | 'owner_id';
  ignoreDuplicates?: boolean;
  /** Column filters identifying the record for deletes. */
  deleteMatch: (op: OutboxOp) => Record<string, string>;
}

const byId = (op: OutboxOp) => ({ id: op.recordKey, user_id: op.userId });

export const ENTITY_CONFIG: Record<SyncEntity, EntityConfig> = {
  weight_entries: { onConflict: 'id', deleteMatch: byId },
  body_measurements: { onConflict: 'id', deleteMatch: byId },
  daily_checkins: {
    onConflict: 'user_id,local_date',
    deleteMatch: (op) => ({ user_id: op.userId, local_date: op.recordKey }),
  },
  user_milestones: {
    onConflict: 'user_id,milestone_key',
    ignoreDuplicates: true,
    deleteMatch: byId,
  },
  exercises: {
    onConflict: 'id',
    ownerColumn: 'owner_id',
    deleteMatch: (op) => ({ id: op.recordKey, owner_id: op.userId }),
  },
  scheduled_workouts: { onConflict: 'id', deleteMatch: byId },
  workout_sessions: { onConflict: 'id', deleteMatch: byId },
  exercise_sets: { onConflict: 'id', deleteMatch: byId },
};

/** Sends one outbox op to Supabase. Payloads are built by typed repositories. */
export const supabaseTransport: Transport = async (op) => {
  const cfg = ENTITY_CONFIG[op.entity];
  const table = requireSupabase().from(op.entity);
  if (op.kind === 'delete') {
    const { error, status } = await table.delete().match(cfg.deleteMatch(op));
    return { error: error ? { ...error, status } : null };
  }
  const row = {
    ...op.payload,
    [cfg.ownerColumn ?? 'user_id']: op.userId,
    client_updated_at: op.createdAt,
  };
  if (op.entity === 'user_milestones') delete (row as Record<string, unknown>).client_updated_at;
  const { error, status } = await table.upsert(row as never, {
    onConflict: cfg.onConflict,
    ignoreDuplicates: cfg.ignoreDuplicates ?? false,
  });
  return { error: error ? { ...error, status } : null };
};
