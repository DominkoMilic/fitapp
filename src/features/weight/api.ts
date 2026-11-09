import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import { applyPending } from '@/domain/sync/outbox';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { eventTime } from '@/features/sync/local-time';
import { syncKeys, usePendingOverlay, useSyncActions } from '@/features/sync/SyncProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/integrations/supabase/paging';
import type { Tables } from '@/integrations/supabase/database.types';

export type WeightEntry = Tables<'weight_entries'> & { _pending?: boolean; _failed?: boolean };

/** All of the user's weight entries: server rows + offline writes, newest first. */
export function useWeightEntries() {
  const userId = useAuth().session?.user.id;
  const queue = usePendingOverlay();
  const query = useQuery({
    queryKey: syncKeys.entity(userId ?? 'anonymous', 'weight_entries'),
    enabled: !!userId,
    queryFn: async () => {
      return fetchAllPages((from, to) =>
        requireSupabase()
          .from('weight_entries')
          .select('*')
          .eq('user_id', userId as string)
          .order('measured_at', { ascending: false })
          .order('id')
          .range(from, to),
      );
    },
  });
  const entries = useMemo(
    () =>
      applyPending(query.data ?? [], queue, 'weight_entries', (r) => r.id).sort((a, b) =>
        String(b.measured_at).localeCompare(String(a.measured_at)),
      ) as WeightEntry[],
    [query.data, queue],
  );
  return { ...query, entries, serverIds: new Set((query.data ?? []).map((r) => r.id)) };
}

export function useWeightActions() {
  const { write } = useSyncActions();
  const { data: profile } = useProfile();
  const { serverIds } = useWeightEntries();
  const timezone = profile?.timezone ?? 'UTC';
  return {
    /** Creates or updates an entry; returns its id (for undo). */
    save: async (input: {
      id?: string;
      weightKg: number;
      localDate: string;
      note: string | null;
      measuredAt?: string;
    }) => {
      const id = input.id ?? randomUUID();
      const time = input.measuredAt
        ? { measuredAt: input.measuredAt, localDate: input.localDate }
        : eventTime(input.localDate, timezone);
      await write({
        id: randomUUID(),
        entity: 'weight_entries',
        recordKey: id,
        kind: 'upsert',
        createdOffline: !serverIds.has(id),
        payload: {
          id,
          weight_kg: Math.round(input.weightKg * 100) / 100,
          measured_at: time.measuredAt,
          local_date: time.localDate,
          note: input.note?.trim() || null,
          source: 'manual',
        },
      });
      return id;
    },
    remove: (id: string) =>
      write({
        id: randomUUID(),
        entity: 'weight_entries',
        recordKey: id,
        kind: 'delete',
        payload: null,
        createdOffline: !serverIds.has(id),
      }),
  };
}
