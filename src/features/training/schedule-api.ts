import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useEffect, useMemo } from 'react';

import { addDays } from '@/domain/calculations/dates';
import { applyPending } from '@/domain/sync/outbox';
import { TEMPLATE_BY_SLUG } from '@/domain/training/catalogue';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToday } from '@/features/dashboard/useToday';
import { profileKeys } from '@/features/profile/api';
import { syncKeys, useOutbox, useSyncActions } from '@/features/sync/SyncProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

import { clearFutureGenerated, ensureSchedule } from './schedule-sync';

export { clearFutureGenerated, ensureSchedule };

export type ScheduledWorkout = Tables<'scheduled_workouts'> & {
  _pending?: boolean;
  _failed?: boolean;
};

const db = () => requireSupabase();

const GEN_KEY = (userId: string) => `pace.schedule-generated.${userId}`;

/** Runs generation at most once per day (and whenever `force` is called), when online. */
export function useScheduleGeneration() {
  const userId = useAuth().session?.user.id;
  const { today } = useToday();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) return 0;
      const n = await ensureSchedule(userId, today);
      await AsyncStorage.setItem(GEN_KEY(userId), today).catch(() => undefined);
      return n;
    },
    onSuccess: () => {
      if (userId)
        void queryClient.invalidateQueries({
          queryKey: syncKeys.entity(userId, 'scheduled_workouts'),
        });
    },
  });
  const { mutate } = mutation;
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(GEN_KEY(userId))
      .then((last) => {
        if (last !== today) mutate();
      })
      .catch(() => mutate());
  }, [userId, today, mutate]);
  return mutation;
}

export function useScheduledWorkouts(from: string, to: string) {
  const userId = useAuth().session?.user.id;
  const queue = useOutbox();
  const query = useQuery({
    queryKey: [...syncKeys.entity(userId ?? 'anonymous', 'scheduled_workouts'), from, to],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('scheduled_workouts')
        .select('*')
        .eq('user_id', userId as string)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .order('scheduled_date')
        .order('scheduled_time', { nullsFirst: true });
      if (error) throw error;
      return data;
    },
  });
  const rows = useMemo(
    () =>
      (
        applyPending(
          query.data ?? [],
          queue,
          'scheduled_workouts',
          (r) => r.id,
        ) as ScheduledWorkout[]
      )
        .filter((r) => r.scheduled_date >= from && r.scheduled_date <= to)
        .sort((a, b) =>
          (a.scheduled_date + (a.scheduled_time ?? '')).localeCompare(
            b.scheduled_date + (b.scheduled_time ?? ''),
          ),
        ),
    [query.data, queue, from, to],
  );
  return { ...query, rows };
}

export function useScheduledWorkout(id: string | undefined) {
  const { today } = useToday();
  // Occurrences live within a few months; a wide window keeps one cache entry.
  const all = useScheduledWorkouts(addDays(today, -120), addDays(today, 120));
  const fromRange = all.rows.find((r) => r.id === id);
  const userId = useAuth().session?.user.id;
  const single = useQuery({
    queryKey: ['scheduled-workout', id],
    enabled: !!id && !!userId && !fromRange && all.isSuccess,
    queryFn: async () => {
      const { data, error } = await db()
        .from('scheduled_workouts')
        .select('*')
        .eq('id', id as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    workout: (fromRange ?? single.data ?? undefined) as ScheduledWorkout | undefined,
    isPending: all.isPending,
    all,
  };
}

/** Calendar changes go through the outbox (work offline). Full rows: see note at the top. */
export function useScheduleActions() {
  const { write } = useSyncActions();
  const strip = (w: ScheduledWorkout) => {
    const { _pending, _failed, created_at, updated_at, client_updated_at, user_id, ...row } = w;
    return row;
  };
  const upsert = (w: ScheduledWorkout, changes: Partial<ScheduledWorkout>) =>
    write({
      id: randomUUID(),
      entity: 'scheduled_workouts',
      recordKey: w.id,
      kind: 'upsert',
      createdOffline: false,
      payload: { ...strip(w), ...changes },
    });
  return {
    move: (w: ScheduledWorkout, date: string) =>
      upsert(w, { scheduled_date: date, is_user_modified: true }),
    skip: (w: ScheduledWorkout) => upsert(w, { status: 'skipped', is_user_modified: true }),
    restore: (w: ScheduledWorkout) => upsert(w, { status: 'planned' }),
    complete: (w: ScheduledWorkout) => upsert(w, { status: 'completed' }),
    addOneOff: async (input: { date: string; templateSlug: string; time: string | null }) => {
      const t = TEMPLATE_BY_SLUG[input.templateSlug];
      if (!t) throw new Error('Unknown template');
      const id = randomUUID();
      await write({
        id: randomUUID(),
        entity: 'scheduled_workouts',
        recordKey: id,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id,
          occurrence_key: null,
          training_plan_id: null,
          recurring_event_id: null,
          template_slug: t.slug,
          kind: t.category === 'recovery' || t.category === 'mobility' ? 'recovery' : 'workout',
          title: t.name,
          category: t.category,
          intensity: t.intensity,
          scheduled_date: input.date,
          scheduled_time: input.time,
          estimated_duration_minutes: t.minutes,
          status: 'planned',
          is_user_modified: true,
          notes: [],
        },
      });
      return id;
    },
    removeOneOff: (w: ScheduledWorkout) =>
      write({
        id: randomUUID(),
        entity: 'scheduled_workouts',
        recordKey: w.id,
        kind: 'delete',
        payload: null,
        createdOffline: false,
      }),
  };
}

/** Editing or ending a recurring series needs the server (it rewrites future occurrences). */
export function useSeriesActions() {
  const userId = useAuth().session?.user.id;
  const { today } = useToday();
  const queryClient = useQueryClient();
  const done = async () => {
    if (!userId) return;
    await ensureSchedule(userId, today);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: syncKeys.entity(userId, 'scheduled_workouts') }),
      queryClient.invalidateQueries({ queryKey: profileKeys.all }),
    ]);
  };
  const update = useMutation({
    mutationFn: async (input: {
      eventId: string;
      weekday: number;
      localTime: string;
      durationMinutes: number;
      title: string;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await db()
        .from('recurring_events')
        .update({
          weekday: input.weekday,
          local_time: input.localTime,
          duration_minutes: input.durationMinutes,
          title: input.title,
        })
        .eq('id', input.eventId);
      if (error) throw error;
      await clearFutureGenerated(userId, today, { eventId: input.eventId });
      await done();
    },
  });
  const end = useMutation({
    mutationFn: async (eventId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await db()
        .from('recurring_events')
        .update({ active: false, ends_on: addDays(today, -1) })
        .eq('id', eventId);
      if (error) throw error;
      await clearFutureGenerated(userId, today, { eventId });
      await done();
    },
  });
  return { update, end };
}
