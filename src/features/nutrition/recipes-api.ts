import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback } from 'react';

import { draftToRow, type RecipeDraft } from '@/domain/nutrition/recipe-draft';
import type { Per100 } from '@/domain/nutrition/totals';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSyncActions } from '@/features/sync/SyncProvider';
import { useSyncedRows } from '@/features/sync/useSyncedRows';
import { type RecipeRow, themealdb } from '@/integrations/recipes/themealdb.provider';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

export type SavedRecipe = Tables<'saved_recipes'>;
export type { RecipeRow };

const db = () => requireSupabase();

export function useRecipeBrowse(
  mode: { kind: 'search'; query: string } | { kind: 'category'; category: string },
) {
  const userId = useAuth().session?.user.id;
  const key = mode.kind === 'search' ? mode.query.trim() : mode.category;
  return useQuery({
    queryKey: ['recipe-browse', mode.kind, key],
    enabled: !!userId && key.length >= (mode.kind === 'search' ? 2 : 1),
    staleTime: 24 * 3600_000,
    retry: 1,
    queryFn: () => (mode.kind === 'search' ? themealdb.search(key) : themealdb.byCategory(key)),
  });
}

export function useRecipeCategories() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['recipe-categories'],
    enabled: !!userId,
    staleTime: 7 * 24 * 3600_000,
    retry: 1,
    queryFn: themealdb.categories,
  });
}

/** The user's own recipes (owner_id = user), offline-capable. */
export function useMyRecipes() {
  return useSyncedRows<RecipeRow>({
    entity: 'recipes',
    keyOf: (r) => r.id,
    filter: useCallback((r: RecipeRow) => !r.archived_at, []),
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('recipes')
        .select('*')
        .eq('owner_id', userId)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Per-100 g nutrition for foods by id (fills in recipes saved before ingredients kept a snapshot). */
export function useFoodNutrition(ids: readonly string[]) {
  const userId = useAuth().session?.user.id;
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['food-nutrition', sorted],
    enabled: !!userId && sorted.length > 0,
    staleTime: 3600_000,
    queryFn: async (): Promise<Record<string, Per100>> => {
      const { data, error } = await db()
        .from('foods')
        .select('id, kcal, protein_g, carbs_g, fat_g, fibre_g')
        .in('id', sorted);
      if (error) throw error;
      const num = (v: number | string | null) => (v === null ? null : Number(v));
      return Object.fromEntries(
        data.map((f) => [
          f.id,
          {
            kcal: num(f.kcal),
            protein_g: num(f.protein_g),
            carbs_g: num(f.carbs_g),
            fat_g: num(f.fat_g),
            fibre_g: num(f.fibre_g),
          },
        ]),
      );
    },
  });
}

export function useSavedRecipes() {
  return useSyncedRows<SavedRecipe>({
    entity: 'saved_recipes',
    keyOf: (r) => r.recipe_id,
    fetch: async (userId) => {
      const { data, error } = await db().from('saved_recipes').select('*').eq('user_id', userId);
      if (error) throw error;
      return data;
    },
  });
}

/** Recipe rows for saved recipes (cached TheMealDB rows are readable by all signed-in users). */
export function useRecipesByIds(ids: readonly string[]) {
  const userId = useAuth().session?.user.id;
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: ['recipes-by-id', sorted],
    enabled: !!userId && sorted.length > 0,
    staleTime: 3600_000,
    queryFn: async () => {
      const { data, error } = await db().from('recipes').select('*').in('id', sorted);
      if (error) throw error;
      return data;
    },
  });
}

/** One recipe by database id (own or cached), or by TheMealDB id (fetched through the proxy). */
export function useRecipe(ref: { id?: string; externalId?: string }) {
  const userId = useAuth().session?.user.id;
  const mine = useMyRecipes();
  const local = ref.id ? mine.rows.find((r) => r.id === ref.id) : undefined;
  const q = useQuery({
    queryKey: ['recipe', ref.id ?? `ext:${ref.externalId}`],
    enabled: !!userId && !local && !!(ref.id || ref.externalId),
    staleTime: 3600_000,
    retry: 1,
    queryFn: async (): Promise<RecipeRow | null> => {
      if (ref.id) {
        const { data, error } = await db()
          .from('recipes')
          .select('*')
          .eq('id', ref.id)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      return themealdb.lookup(ref.externalId as string);
    },
  });
  return {
    recipe: local ?? q.data ?? null,
    isPending: !local && q.isPending,
    isError: !local && q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

export function useRecipeActions() {
  const { write } = useSyncActions();
  const qc = useQueryClient();
  return {
    save: (
      recipeId: string,
      existsOnServer: boolean,
      values: { base_servings: number | null; default_servings: number | null },
    ) =>
      write({
        id: randomUUID(),
        entity: 'saved_recipes',
        recordKey: recipeId,
        kind: 'upsert',
        createdOffline: !existsOnServer,
        payload: { recipe_id: recipeId, ...values },
      }).then(() => qc.invalidateQueries({ queryKey: ['recipes-by-id'] })),
    unsave: (recipeId: string, existsOnServer: boolean) =>
      write({
        id: randomUUID(),
        entity: 'saved_recipes',
        recordKey: recipeId,
        kind: 'delete',
        payload: null,
        createdOffline: !existsOnServer,
      }),
    /** Create (new id) or replace (existing id) one of your own recipes. Works offline. */
    saveRecipe: async (draft: RecipeDraft, existing?: { id: string; onServer: boolean }) => {
      const id = existing?.id ?? randomUUID();
      await write({
        id: randomUUID(),
        entity: 'recipes',
        recordKey: id,
        kind: 'upsert',
        createdOffline: !existing?.onServer,
        payload: draftToRow(draft, id),
      });
      void qc.invalidateQueries({ queryKey: ['recipe', id] });
      return id;
    },
    archiveRecipe: (r: RecipeRow) => {
      const { _pending, _failed, created_at, updated_at, client_updated_at, owner_id, ...rest } =
        r as RecipeRow & { _pending?: boolean; _failed?: boolean };
      return write({
        id: randomUUID(),
        entity: 'recipes',
        recordKey: r.id,
        kind: 'upsert',
        createdOffline: false,
        payload: { ...rest, archived_at: new Date().toISOString() },
      });
    },
  };
}
