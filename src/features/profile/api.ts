import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { BodyArea, InjuryStatus } from '@/domain/training/injury';
import {
  type Commitment,
  type CommitmentCategory,
  generateWeeklyPattern,
} from '@/domain/training/weekly-pattern';
import { useAuth } from '@/features/auth/AuthProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/database.types';

export type Profile = Tables<'profiles'>;
export type Goal = Tables<'user_goals'>;
export type NutritionTarget = Tables<'nutrition_targets'>;
export type TrainingPlan = Tables<'training_plans'>;
export type RecurringEvent = Tables<'recurring_events'>;
export type Preferences = Tables<'user_preferences'>;
export type Equipment = Tables<'user_equipment'>;
export type HealthCondition = Tables<'health_conditions'>;

export const profileKeys = {
  all: ['profile'] as const,
  me: (userId: string) => ['profile', userId] as const,
  goal: (userId: string) => ['profile', userId, 'goal'] as const,
  targets: (userId: string) => ['profile', userId, 'targets'] as const,
  plan: (userId: string) => ['profile', userId, 'plan'] as const,
  events: (userId: string) => ['profile', userId, 'events'] as const,
  preferences: (userId: string) => ['profile', userId, 'preferences'] as const,
  equipment: (userId: string) => ['profile', userId, 'equipment'] as const,
  health: (userId: string) => ['profile', userId, 'health'] as const,
};

const db = () => requireSupabase();

function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  return unwrap(await db().from('profiles').select('*').eq('id', userId).maybeSingle());
}

function useUserId(): string | undefined {
  return useAuth().session?.user.id;
}

function useUserQuery<T>(key: (id: string) => readonly unknown[], fn: (id: string) => Promise<T>) {
  const userId = useUserId();
  return useQuery({
    queryKey: key(userId ?? 'anonymous'),
    queryFn: () => fn(userId as string),
    enabled: !!userId,
  });
}

export const useProfile = () => useUserQuery(profileKeys.me, fetchProfile);

export const useActiveGoal = () =>
  useUserQuery(profileKeys.goal, async (id) =>
    unwrap(
      await db()
        .from('user_goals')
        .select('*')
        .eq('user_id', id)
        .eq('status', 'active')
        .maybeSingle(),
    ),
  );

/** All target versions, newest first. The current one is the latest with effective_from <= today. */
export const useTargetHistory = () =>
  useUserQuery(profileKeys.targets, async (id) =>
    unwrap(
      await db()
        .from('nutrition_targets')
        .select('*')
        .eq('user_id', id)
        .order('effective_from', { ascending: false }),
    ),
  );

export const useActivePlan = () =>
  useUserQuery(profileKeys.plan, async (id) =>
    unwrap(
      await db()
        .from('training_plans')
        .select('*')
        .eq('user_id', id)
        .eq('status', 'active')
        .maybeSingle(),
    ),
  );

export const useRecurringEvents = () =>
  useUserQuery(profileKeys.events, async (id) =>
    unwrap(
      await db()
        .from('recurring_events')
        .select('*')
        .eq('user_id', id)
        .eq('active', true)
        .order('weekday'),
    ),
  );

export const usePreferences = () =>
  useUserQuery(profileKeys.preferences, async (id) =>
    unwrap(await db().from('user_preferences').select('*').eq('user_id', id).maybeSingle()),
  );

export const useEquipment = () =>
  useUserQuery(profileKeys.equipment, async (id) =>
    unwrap(await db().from('user_equipment').select('*').eq('user_id', id).order('equipment_type')),
  );

export const useHealthConditions = () =>
  useUserQuery(profileKeys.health, async (id) =>
    unwrap(
      await db()
        .from('health_conditions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
    ),
  );

// ------------------------------------------------------------------ mutations

function useInvalidatingMutation<V>(fn: (userId: string, vars: V) => Promise<void>) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => {
      if (!userId) throw new Error('Not signed in');
      return fn(userId, vars);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export const useUpdateProfile = () =>
  useInvalidatingMutation<TablesUpdate<'profiles'>>(async (id, values) => {
    unwrap(await db().from('profiles').update(values).eq('id', id));
  });

export const useUpdatePreferences = () =>
  useInvalidatingMutation<TablesUpdate<'user_preferences'>>(async (id, values) => {
    unwrap(
      await db()
        .from('user_preferences')
        .upsert({ ...values, user_id: id }),
    );
    await regenerateWeeklyPattern(id);
  });

/** Saves a new target version (spec 8.9: versions are kept for history, never deleted). */
export const useSaveTargets = () =>
  useInvalidatingMutation<Omit<TablesInsert<'nutrition_targets'>, 'user_id'>>(
    async (id, values) => {
      unwrap(
        await db()
          .from('nutrition_targets')
          .upsert({ ...values, user_id: id }, { onConflict: 'user_id,effective_from' }),
      );
    },
  );

export const useReplaceEquipment = () =>
  useInvalidatingMutation<Omit<TablesInsert<'user_equipment'>, 'user_id'>[]>(async (id, items) => {
    unwrap(await db().from('user_equipment').delete().eq('user_id', id));
    if (items.length)
      unwrap(
        await db()
          .from('user_equipment')
          .insert(items.map((i) => ({ ...i, user_id: id }))),
      );
  });

export const useUpsertHealthCondition = () =>
  useInvalidatingMutation<Omit<TablesInsert<'health_conditions'>, 'user_id'>>(
    async (id, values) => {
      unwrap(
        await db()
          .from('health_conditions')
          .upsert({ ...values, user_id: id }),
      );
      await regenerateWeeklyPattern(id);
    },
  );

export const useDeleteHealthCondition = () =>
  useInvalidatingMutation<string>(async (id, conditionId) => {
    unwrap(await db().from('health_conditions').delete().eq('user_id', id).eq('id', conditionId));
    await regenerateWeeklyPattern(id);
  });

/** "Delete all health information" (spec 19): removes every condition and withdraws consent. */
export const useDeleteAllHealthData = () =>
  useInvalidatingMutation<{ legalVersion: string }>(async (id, { legalVersion }) => {
    unwrap(await db().from('health_conditions').delete().eq('user_id', id));
    unwrap(
      await db().from('consents').insert({
        user_id: id,
        consent_type: 'health_data',
        document_version: legalVersion,
        granted: false,
      }),
    );
    await regenerateWeeklyPattern(id);
  });

export const useRecordConsent = () =>
  useInvalidatingMutation<{
    type: TablesInsert<'consents'>['consent_type'];
    granted: boolean;
    legalVersion: string;
  }>(async (id, { type, granted, legalVersion }) => {
    unwrap(
      await db()
        .from('consents')
        .insert({ user_id: id, consent_type: type, granted, document_version: legalVersion }),
    );
  });

export const useHealthConsent = () =>
  useUserQuery(
    (id) => ['profile', id, 'consent', 'health_data'] as const,
    async (id) => {
      const row = unwrap(
        await db()
          .from('consents')
          .select('granted')
          .eq('user_id', id)
          .eq('consent_type', 'health_data')
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
      return row?.granted ?? false;
    },
  );

// ------------------------------------------------------------ plan regeneration

/**
 * Rebuilds the active plan's weekly pattern from the latest preferences, commitments and
 * injuries (fetched fresh, not from cache). Called after any of those change.
 */
export async function regenerateWeeklyPattern(userId: string): Promise<void> {
  const [plan, prefs, events, health, goal] = await Promise.all([
    db()
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    db().from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    db().from('recurring_events').select('*').eq('user_id', userId).eq('active', true),
    db().from('health_conditions').select('*').eq('user_id', userId),
    db().from('user_goals').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle(),
  ]);
  const activePlan = unwrap(plan);
  if (!activePlan) return;
  const p = unwrap(prefs);
  const commitments: Commitment[] = (unwrap(events) ?? [])
    .filter((e) => e.category !== 'workout')
    .map((e) => ({
      title: e.title,
      category: ([
        'futsal_match',
        'futsal_practice',
        'football_match',
        'football_practice',
      ].includes(e.category)
        ? e.category
        : 'other') as CommitmentCategory,
      weekday: e.weekday,
      localTime: e.local_time.slice(0, 5),
      durationMinutes: e.duration_minutes,
      intensity: e.intensity as Commitment['intensity'],
    }));
  const pattern = generateWeeklyPattern({
    trainingDaysPerWeek: p?.training_days_per_week ?? 3,
    preferredDays: p?.preferred_training_days ?? [],
    maxSessionMinutes: p?.max_session_minutes ?? 45,
    commitments,
    focusTags: unwrap(goal)?.focus_tags ?? [],
    injuries: (unwrap(health) ?? []).map((h) => ({
      bodyArea: h.body_area as BodyArea | null,
      status: h.status as InjuryStatus,
    })),
  });
  unwrap(
    await db()
      .from('training_plans')
      .update({
        generator_version: pattern.version,
        weekly_pattern: pattern.days.map((d) => ({
          weekday: d.weekday,
          kind: d.kind,
          title: d.title,
          intensity: d.intensity,
          minutes: d.minutes,
          template_slug: d.templateSlug,
          notes: d.notes,
        })),
      })
      .eq('id', activePlan.id),
  );
}

// ------------------------------------------------------------------ goals

export type GoalChange =
  | { mode: 'update'; goalId: string; values: TablesUpdate<'user_goals'> }
  | {
      mode: 'replace';
      /** Status for the current goal: achieved (target reached) or abandoned (changed mind). */
      endCurrentAs: 'achieved' | 'abandoned';
      next: Omit<TablesInsert<'user_goals'>, 'user_id' | 'status'>;
    };

/**
 * Edits the active goal in place, or ends it and starts a new one (history is kept).
 * Never changes calorie targets: the user reviews a recalculation afterwards (spec 3.1 #7).
 */
export const useChangeGoal = () =>
  useInvalidatingMutation<GoalChange>(async (id, change) => {
    if (change.mode === 'update') {
      unwrap(
        await db()
          .from('user_goals')
          .update(change.values)
          .eq('id', change.goalId)
          .eq('user_id', id),
      );
    } else {
      const today = new Date().toISOString().slice(0, 10);
      unwrap(
        await db()
          .from('user_goals')
          .update({ status: change.endCurrentAs, ended_at: today })
          .eq('user_id', id)
          .eq('status', 'active'),
      );
      unwrap(
        await db()
          .from('user_goals')
          .insert({ ...change.next, user_id: id, status: 'active' }),
      );
    }
    await regenerateWeeklyPattern(id);
  });
