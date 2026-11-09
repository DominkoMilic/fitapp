import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import { applyPending } from '@/domain/sync/outbox';
import { useAuth } from '@/features/auth/AuthProvider';
import { syncKeys, useOutbox, useSyncActions } from '@/features/sync/SyncProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/integrations/supabase/paging';
import type { Tables } from '@/integrations/supabase/database.types';

import { type ScheduledWorkout, useScheduleActions } from './schedule-api';

export type WorkoutSession = Tables<'workout_sessions'> & { _pending?: boolean; _failed?: boolean };
export type ExerciseSet = Tables<'exercise_sets'> & { _pending?: boolean; _failed?: boolean };

export interface NewSession {
  scheduled: ScheduledWorkout | null;
  templateSlug: string | null;
  title: string;
  category: string;
  startedAt: string;
  endedAt: string;
  localDate: string;
  durationSeconds: number;
  pausedSeconds: number;
  rpe: number | null;
  feeling: number | null;
  volumeKg: number | null;
  calories: number | null;
  completion: 'completed' | 'partial' | 'abandoned';
  source: 'app' | 'manual';
  notes: string | null;
  sets: {
    exerciseId: string | null;
    exerciseSlug: string | null;
    exerciseName: string;
    setNumber: number;
    reps: number | null;
    weightKg: number | null;
    durationS: number | null;
    completed: boolean;
    skipped: boolean;
    painFlag: boolean;
  }[];
}

/** Saves a session + its sets (outbox: parent before children) and completes the occurrence. */
export function useSaveSession() {
  const { write } = useSyncActions();
  const schedule = useScheduleActions();
  return async (s: NewSession): Promise<string> => {
    const id = randomUUID();
    await write({
      id: randomUUID(),
      entity: 'workout_sessions',
      recordKey: id,
      kind: 'upsert',
      createdOffline: true,
      payload: {
        id,
        scheduled_workout_id: s.scheduled?.id ?? null,
        template_slug: s.templateSlug,
        title: s.title.slice(0, 80),
        category: s.category,
        started_at: s.startedAt,
        ended_at: s.endedAt,
        local_date: s.localDate,
        duration_seconds: s.durationSeconds,
        paused_seconds: s.pausedSeconds,
        perceived_exertion: s.rpe,
        feeling: s.feeling,
        total_volume_kg: s.volumeKg,
        calories_estimated: s.calories,
        completion_status: s.completion,
        source: s.source,
        notes: s.notes,
      },
    });
    for (const set of s.sets) {
      const setId = randomUUID();
      await write({
        id: randomUUID(),
        entity: 'exercise_sets',
        recordKey: setId,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id: setId,
          workout_session_id: id,
          exercise_id: set.exerciseId,
          exercise_slug: set.exerciseSlug,
          exercise_name: set.exerciseName,
          set_number: set.setNumber,
          repetitions: set.reps,
          weight_kg: set.weightKg,
          duration_seconds: set.durationS,
          completed: set.completed,
          skipped: set.skipped,
          pain_flag: set.painFlag,
        },
      });
    }
    if (s.scheduled && s.completion !== 'abandoned') await schedule.complete(s.scheduled);
    return id;
  };
}

/** Recent sessions (last 400) with their sets, server rows + offline writes. */
export function useSessions() {
  const userId = useAuth().session?.user.id;
  const queue = useOutbox();
  const sessions = useQuery({
    queryKey: syncKeys.entity(userId ?? 'anonymous', 'workout_sessions'),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId as string)
        .order('started_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      return data;
    },
  });
  const sets = useQuery({
    queryKey: syncKeys.entity(userId ?? 'anonymous', 'exercise_sets'),
    enabled: !!userId,
    queryFn: async () => {
      // Every set (records and milestones need full history), past the 1000-row API cap.
      return fetchAllPages((from, to) =>
        requireSupabase()
          .from('exercise_sets')
          .select('*')
          .eq('user_id', userId as string)
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to),
      );
    },
  });
  const sessionRows = useMemo(
    () =>
      (
        applyPending(
          sessions.data ?? [],
          queue,
          'workout_sessions',
          (r) => r.id,
        ) as WorkoutSession[]
      ).sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [sessions.data, queue],
  );
  const setRows = useMemo(
    () => applyPending(sets.data ?? [], queue, 'exercise_sets', (r) => r.id) as ExerciseSet[],
    [sets.data, queue],
  );
  return {
    sessions: sessionRows,
    sets: setRows,
    isPending: sessions.isPending || sets.isPending,
    isError: sessions.isError || sets.isError,
    isSuccess: sessions.isSuccess && sets.isSuccess,
    refetch: () => Promise.all([sessions.refetch(), sets.refetch()]),
  };
}
