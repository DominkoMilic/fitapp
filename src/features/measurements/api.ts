import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import type { MeasurementType } from '@/domain/measurements/measurements';
import { applyPending } from '@/domain/sync/outbox';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { eventTime } from '@/features/sync/local-time';
import { syncKeys, useOutbox, useSyncActions } from '@/features/sync/SyncProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

export type Measurement = Tables<'body_measurements'> & { _pending?: boolean; _failed?: boolean };

export function useMeasurements() {
  const userId = useAuth().session?.user.id;
  const queue = useOutbox();
  const query = useQuery({
    queryKey: syncKeys.entity(userId ?? 'anonymous', 'body_measurements'),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('body_measurements')
        .select('*')
        .eq('user_id', userId as string)
        .order('measured_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const rows = useMemo(
    () =>
      applyPending(query.data ?? [], queue, 'body_measurements', (r) => r.id).sort((a, b) =>
        String(b.measured_at).localeCompare(String(a.measured_at)),
      ) as Measurement[],
    [query.data, queue],
  );
  return { ...query, rows, serverIds: new Set((query.data ?? []).map((r) => r.id)) };
}

export function useMeasurementActions() {
  const { write } = useSyncActions();
  const { data: profile } = useProfile();
  const { serverIds } = useMeasurements();
  const timezone = profile?.timezone ?? 'UTC';
  return {
    /** Saves several measurements taken on the same day. */
    saveMany: async (localDate: string, values: Partial<Record<MeasurementType, number>>) => {
      const time = eventTime(localDate, timezone);
      for (const [type, cm] of Object.entries(values)) {
        if (cm === undefined) continue;
        const id = randomUUID();
        await write({
          id: randomUUID(),
          entity: 'body_measurements',
          recordKey: id,
          kind: 'upsert',
          createdOffline: true,
          payload: {
            id,
            measurement_type: type,
            value_cm: Math.round(cm * 10) / 10,
            measured_at: time.measuredAt,
            local_date: time.localDate,
          },
        });
      }
    },
    remove: (id: string) =>
      write({
        id: randomUUID(),
        entity: 'body_measurements',
        recordKey: id,
        kind: 'delete',
        payload: null,
        createdOffline: !serverIds.has(id),
      }),
  };
}
