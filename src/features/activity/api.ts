import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import type { ActivityType } from '@/domain/activity/met';
import { retypeActivity } from '@/domain/activity/retype';
import {
  decodeRoute,
  decodeRoutePoints,
  encodeRoute,
  type RouteFile,
} from '@/domain/activity/route-codec';
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
      const file: unknown = JSON.parse(await data.text());
      const shape = decodeRoute(file);
      return shape ? { shape, points: decodeRoutePoints(file) } : null;
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
    /** New type: metrics and record eligibility are recomputed (spec 11.6). Sends the full row. */
    changeType: (
      a: Activity,
      type: ActivityType,
      route: { points: ReturnType<typeof decodeRoutePoints> } | null,
      weightKg: number | null,
    ) => {
      const r = retypeActivity({
        type,
        source: a.source as 'gps' | 'manual',
        pieces: route?.points ?? null,
        movingS: a.moving_seconds,
        distanceM: a.distance_meters,
        maxSpeedMps: a.max_speed_mps === null ? null : Number(a.max_speed_mps),
        quality: a.gps_quality as 'good' | 'fair' | 'poor' | 'none',
        pointsTotal: a.points_total,
        pointsValid: a.points_accepted,
        weightKg,
      });
      const {
        _pending,
        _failed,
        created_at,
        updated_at,
        client_updated_at,
        user_id,
        route_storage_path,
        route_deleted_at,
        ...rest
      } = a as Activity & { _pending?: boolean; _failed?: boolean };
      return write({
        id: randomUUID(),
        entity: 'activities',
        recordKey: a.id,
        kind: 'upsert',
        createdOffline: false,
        payload: {
          ...rest,
          activity_type: type,
          distance_meters: r.distanceM,
          average_speed_mps: round3(r.avgSpeedMps),
          max_speed_mps: r.maxSpeedMps === null ? null : round3(r.maxSpeedMps),
          average_pace_seconds_per_km: r.avgPaceSPerKm ? Math.round(r.avgPaceSPerKm) : null,
          calories_estimated: r.kcal === null ? null : Math.round(r.kcal),
          gps_quality: r.quality,
          points_accepted: r.pointsValid,
        },
      });
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
