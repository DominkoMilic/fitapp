import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import { applyPending } from '@/domain/sync/outbox';
import {
  type CatalogueExercise,
  EXERCISE_BY_SLUG,
  EXERCISES,
  type ExerciseCategory,
  type TrackingType,
} from '@/domain/training/catalogue';
import {
  activeRestrictions,
  type BodyArea,
  type InjuryStatus,
  type RestrictionTag,
  sportRestricted,
  sportRestrictedFor,
} from '@/domain/training/injury';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEquipment, useHealthConditions, usePreferences } from '@/features/profile/api';
import { syncKeys, useOutbox, useSyncActions } from '@/features/sync/SyncProvider';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

export type LibraryExercise = CatalogueExercise & { custom: boolean; id: string | null };

/** Injury restriction tags currently in force (spec 9.2), and which of the user's sports to hold off. */
export function useRestrictions(): {
  tags: RestrictionTag[];
  /** Any of the user's sports isn't recommended right now (see sportRestrictedFor). */
  sportRestricted: boolean;
  /** For one sport (sports catalogue key). */
  restrictedFor: (sportKey: string) => boolean;
  sports: string[];
  loading: boolean;
} {
  const health = useHealthConditions();
  const prefs = usePreferences();
  const sports = useMemo(() => prefs.data?.sports ?? [], [prefs.data?.sports]);
  return useMemo(() => {
    const injuries = (health.data ?? []).map((h) => ({
      bodyArea: h.body_area as BodyArea | null,
      status: h.status as InjuryStatus,
    }));
    return {
      tags: activeRestrictions(injuries),
      sportRestricted: sports.length ? sportRestricted(injuries, sports) : false,
      restrictedFor: (key: string) => sportRestrictedFor(injuries, key),
      sports,
      loading: health.isPending,
    };
  }, [health.data, health.isPending, sports]);
}

/** Equipment the user owns, as catalogue tokens. "No equipment" → empty set. */
export function useOwnedEquipment(): Set<string> {
  const { data } = useEquipment();
  return useMemo(
    () =>
      new Set(
        (data ?? []).map((e) => e.equipment_type).filter((t) => t !== 'none' && t !== 'custom'),
      ),
    [data],
  );
}

export type CustomExerciseRow = Tables<'exercises'>;

const customToCatalogue = (r: CustomExerciseRow): LibraryExercise => ({
  slug: `custom:${r.id}`,
  id: r.id,
  custom: true,
  name: r.name,
  category: r.category as ExerciseCategory,
  muscleGroups: r.muscle_groups,
  equipment: r.equipment,
  difficulty: r.difficulty as LibraryExercise['difficulty'],
  tracking: r.tracking_type as TrackingType,
  unilateral: r.is_unilateral,
  defaultSets: r.default_sets ?? 3,
  repsMin: r.default_reps_min,
  repsMax: r.default_reps_max,
  durationS: r.default_duration_s,
  instructions: r.instructions,
  caution: r.caution_notes ?? '',
  contraindications: r.contraindication_tags,
  met: r.met === null ? 3.5 : Number(r.met),
});

export function useCustomExercises() {
  const userId = useAuth().session?.user.id;
  const queue = useOutbox();
  const query = useQuery({
    queryKey: syncKeys.entity(userId ?? 'anonymous', 'exercises'),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('exercises')
        .select('*')
        .eq('owner_id', userId as string);
      if (error) throw error;
      return data;
    },
  });
  const rows = useMemo(
    () => applyPending(query.data ?? [], queue, 'exercises', (r) => r.id) as CustomExerciseRow[],
    [query.data, queue],
  );
  return { ...query, rows };
}

/** System catalogue (bundled, works offline) + the user's active custom exercises. */
export function useLibrary() {
  const custom = useCustomExercises();
  const list = useMemo<LibraryExercise[]>(
    () => [
      ...EXERCISES.map((e) => ({ ...e, custom: false, id: null })),
      ...custom.rows.filter((r) => !r.archived_at).map(customToCatalogue),
    ],
    [custom.rows],
  );
  const bySlug = useMemo(
    () => Object.fromEntries(list.map((e) => [e.slug, e])) as Record<string, LibraryExercise>,
    [list],
  );
  /** Includes archived custom exercises, so history keeps names (spec 28.5 #12). */
  const lookup = (slug: string): LibraryExercise | undefined => {
    if (bySlug[slug]) return bySlug[slug];
    const row = custom.rows.find((r) => `custom:${r.id}` === slug);
    return row
      ? customToCatalogue(row)
      : EXERCISE_BY_SLUG[slug]
        ? { ...EXERCISE_BY_SLUG[slug]!, custom: false, id: null }
        : undefined;
  };
  return { list, bySlug, lookup, custom };
}

export function useCustomExerciseActions() {
  const { write } = useSyncActions();
  return {
    create: async (input: {
      name: string;
      category: ExerciseCategory;
      tracking: TrackingType;
      equipment: string[];
      muscleGroups: string[];
      instructions: string[];
      caution: string;
      unilateral: boolean;
    }) => {
      const id = randomUUID();
      await write({
        id: randomUUID(),
        entity: 'exercises',
        recordKey: id,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id,
          name: input.name.trim(),
          category: input.category,
          tracking_type: input.tracking,
          equipment: input.equipment,
          muscle_groups: input.muscleGroups,
          instructions: input.instructions,
          caution_notes: input.caution.trim() || null,
          is_unilateral: input.unilateral,
          default_sets: 3,
          default_reps_min: input.tracking === 'time' ? null : 8,
          default_reps_max: input.tracking === 'time' ? null : 12,
          default_duration_s: input.tracking === 'time' ? 30 : null,
        },
      });
      return `custom:${id}`;
    },
    /** Archive instead of delete so past workouts keep the name. */
    archive: (row: CustomExerciseRow) =>
      write({
        id: randomUUID(),
        entity: 'exercises',
        recordKey: row.id,
        kind: 'upsert',
        createdOffline: false,
        payload: { ...row, archived_at: new Date().toISOString() },
      }),
  };
}
