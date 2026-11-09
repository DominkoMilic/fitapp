import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import type { CheckinValues } from '@/domain/checkin/checkin';
import { applyPending } from '@/domain/sync/outbox';
import { useAuth } from '@/features/auth/AuthProvider';
import { syncKeys, usePendingOverlay, useSyncActions } from '@/features/sync/SyncProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

export type Checkin = Tables<'daily_checkins'> & { _pending?: boolean; _failed?: boolean };

/** Check-ins from the last 60 days (enough for recovery rules and streaks). */
export function useCheckins() {
  const userId = useAuth().session?.user.id;
  const queue = usePendingOverlay();
  const query = useQuery({
    queryKey: syncKeys.entity(userId ?? 'anonymous', 'daily_checkins'),
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await requireSupabase()
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId as string)
        .gte('local_date', since)
        .order('local_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const rows = useMemo(
    () => applyPending(query.data ?? [], queue, 'daily_checkins', (r) => r.local_date) as Checkin[],
    [query.data, queue],
  );
  return { ...query, rows, serverDates: new Set((query.data ?? []).map((r) => r.local_date)) };
}

export function useSaveCheckin() {
  const { write } = useSyncActions();
  const { serverDates } = useCheckins();
  return (localDate: string, v: CheckinValues) =>
    write({
      id: randomUUID(),
      entity: 'daily_checkins',
      recordKey: localDate,
      kind: 'upsert',
      createdOffline: !serverDates.has(localDate),
      payload: {
        local_date: localDate,
        sleep_hours: v.sleepHours,
        fatigue: v.fatigue,
        soreness: v.soreness,
        pain: v.pain,
        pain_area: v.pain && v.pain > 0 ? v.painArea : null,
        note: v.note.trim() || null,
      },
    });
}
