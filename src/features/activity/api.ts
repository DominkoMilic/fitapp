import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import { decodeRoute, encodeRoute, type RouteFile } from '@/domain/activity/route-codec';
import type { ActivitySummary } from '@/domain/activity/recording';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSyncActions } from '@/features/sync/SyncProvider';
import { useSyncedRows } from '@/features/sync/useSyncedRows';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';
import type { Track } from '@/domain/activity/gps-filter';

export type Activity = Tables<'activities'>;

const db = () => requireSupabase();

export function useActivities() {
  return useSyncedRows<Activity>({
    entity: 'activities',
    keyOf: (r) => r.id,
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}

/** The stored route of an activity, decoded (null when none or unreadable). */
export function useRoute(activity: Pick<Activity, 'id' | 'route_storage_path'> | null) {
  const userId = useAuth().session?.user.id;
  const path = activity?.route_storage_path ?? null;
  return useQuery({
    queryKey: ['activity-route', path],
    enabled: !!userId && !!path,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await db()
        .storage.from('routes')
        .download(path as string);
      if (error) throw error;
      return decodeRoute(JSON.parse(await data.text()));
    },
  });
}

export interface SaveActivityInput {
  id: string;
  summary: ActivitySummary;
  track: Track | null;
  localDate: string;
  source: 'gps' | 'manual';
  notes: string | null;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function useActivityActions() {
  const { write } = useSyncActions();
  return {
    /** Activity row first, then its route file (outbox order 1 → 2). */
    save: async ({ id, summary: s, track, localDate, source, notes }: SaveActivityInput) => {
      await write({
        id: randomUUID(),
        entity: 'activities',
        recordKey: id,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id,
          activity_type: s.type,
          started_at: new Date(s.startedAt).toISOString(),
          ended_at: new Date(s.endedAt).toISOString(),
          local_date: localDate,
          elapsed_seconds: s.elapsedS,
          moving_seconds: Math.min(s.movingS, s.elapsedS),
          distance_meters: s.distanceM,
          average_speed_mps: round3(s.avgSpeedMps),
          max_speed_mps: round3(s.maxSpeedMps),
          average_pace_seconds_per_km: s.avgPaceSPerKm ? Math.round(s.avgPaceSPerKm) : null,
          calories_estimated: s.kcal === null ? null : Math.round(s.kcal),
          gps_quality: source === 'manual' ? 'none' : s.quality,
          points_total: s.pointsTotal,
          points_accepted: s.pointsValid,
          source,
          notes,
        },
      });
      const pieces = track?.pieces.filter((p) => p.length > 1) ?? [];
      const route: RouteFile | null = pieces.length ? encodeRoute(pieces) : null;
      if (route && route.pieces.length) {
        await write({
          id: randomUUID(),
          entity: 'activity_routes',
          recordKey: id,
          kind: 'upsert',
          createdOffline: true,
          payload: { route },
        });
      }
    },
    /** Removes the route file but keeps the activity's totals (spec 11.7). */
    deleteRoute: (activityId: string) =>
      write({
        id: randomUUID(),
        entity: 'activity_routes',
        recordKey: activityId,
        kind: 'delete',
        createdOffline: false,
        payload: null,
      }),
    remove: (activityId: string) =>
      write({
        id: randomUUID(),
        entity: 'activities',
        recordKey: activityId,
        kind: 'delete',
        createdOffline: false,
        payload: null,
      }),
  };
}
