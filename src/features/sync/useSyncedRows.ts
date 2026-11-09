import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { applyPending, type SyncEntity } from '@/domain/sync/outbox';
import { useAuth } from '@/features/auth/AuthProvider';

import { syncKeys, usePendingOverlay } from './SyncProvider';

export type Synced<T> = T & { _pending?: boolean; _failed?: boolean };

/**
 * Server rows for an entity merged with the user's queued offline writes, so new entries appear
 * immediately and deletes disappear. `scope` distinguishes queries of the same table (e.g. a date);
 * `filter` keeps pending rows consistent with the server query.
 */
export function useSyncedRows<T extends Record<string, unknown>>(opts: {
  entity: SyncEntity;
  scope?: readonly unknown[];
  fetch: (userId: string) => Promise<T[]>;
  keyOf: (row: T) => string;
  filter?: (row: T) => boolean;
  enabled?: boolean;
}) {
  const userId = useAuth().session?.user.id;
  const queue = usePendingOverlay();
  const query = useQuery({
    queryKey: [...syncKeys.entity(userId ?? 'anonymous', opts.entity), ...(opts.scope ?? [])],
    enabled: !!userId && (opts.enabled ?? true),
    queryFn: () => opts.fetch(userId as string),
  });
  const { keyOf, filter, entity } = opts;
  const rows = useMemo(() => {
    const merged = applyPending(query.data ?? [], queue, entity, keyOf) as Synced<T>[];
    return filter ? merged.filter(filter) : merged;
  }, [query.data, queue, entity, keyOf, filter]);
  const serverKeys = useMemo(() => new Set((query.data ?? []).map(keyOf)), [query.data, keyOf]);
  return { ...query, rows, serverKeys };
}
