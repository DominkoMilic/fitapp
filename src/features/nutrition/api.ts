import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback } from 'react';

import {
  type MealDraft,
  type MealItem,
  mealItemToJson,
  readMealItems,
} from '@/domain/nutrition/saved-meal-draft';
import { type MealType, type Nutrition, nutritionForGrams } from '@/domain/nutrition/totals';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { eventTime } from '@/features/sync/local-time';
import { useSyncActions } from '@/features/sync/SyncProvider';
import { useSyncedRows } from '@/features/sync/useSyncedRows';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

export type Food = Tables<'foods'>;
export type MealLogItem = Tables<'meal_log_items'>;
export type WaterLog = Tables<'water_logs'>;
export type SavedMeal = Tables<'saved_meals'>;

export interface FoodPortion {
  label: string;
  grams: number;
}

export function portionsOf(food: Pick<Food, 'portions'>): FoodPortion[] {
  return Array.isArray(food.portions)
    ? food.portions.flatMap((p) =>
        p &&
        typeof p === 'object' &&
        !Array.isArray(p) &&
        typeof p.label === 'string' &&
        typeof p.grams === 'number' &&
        p.grams > 0
          ? [{ label: p.label, grams: p.grams }]
          : [],
      )
    : [];
}

const db = () => requireSupabase();
const byId = (r: { id: string }) => r.id;

// ---------------------------------------------------------------- day data

export function useDayLog(date: string) {
  const filter = useCallback((r: MealLogItem) => r.local_date === date, [date]);
  return useSyncedRows<MealLogItem>({
    entity: 'meal_log_items',
    scope: [date],
    keyOf: byId,
    filter,
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('meal_log_items')
        .select('*')
        .eq('user_id', userId)
        .eq('local_date', date)
        .order('logged_at');
      if (error) throw error;
      return data;
    },
  });
}

/** Recent distinct foods the user logged (for quick re-logging; works offline from cache). */
export function useRecentItems() {
  return useSyncedRows<MealLogItem>({
    entity: 'meal_log_items',
    scope: ['recent'],
    keyOf: byId,
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('meal_log_items')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useWater(date: string) {
  const filter = useCallback((r: WaterLog) => r.local_date === date, [date]);
  return useSyncedRows<WaterLog>({
    entity: 'water_logs',
    scope: [date],
    keyOf: byId,
    filter,
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('water_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('local_date', date);
      if (error) throw error;
      return data;
    },
  });
}

type DayStatus = Tables<'day_log_status'>;
export function useDayStatus(date: string) {
  const filter = useCallback((r: DayStatus) => r.local_date === date, [date]);
  const q = useSyncedRows<DayStatus>({
    entity: 'day_log_status',
    scope: [date],
    keyOf: (r) => r.local_date,
    filter,
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('day_log_status')
        .select('*')
        .eq('user_id', userId)
        .eq('local_date', date);
      if (error) throw error;
      return data;
    },
  });
  return { ...q, complete: q.rows[0]?.nutrition_complete ?? false };
}

export function useSavedMeals() {
  return useSyncedRows<SavedMeal>({
    entity: 'saved_meals',
    keyOf: byId,
    filter: useCallback((r: SavedMeal) => !r.archived_at, []),
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('saved_meals')
        .select('*')
        .eq('user_id', userId)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** The user's custom foods (shown first in search; also offline). */
export function useCustomFoods() {
  return useSyncedRows<Food>({
    entity: 'foods',
    keyOf: byId,
    filter: useCallback((r: Food) => !r.archived_at, []),
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('foods')
        .select('*')
        .eq('owner_id', userId)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Ranked server search over reference + custom foods (needs a connection). */
export function useFoodSearch(query: string) {
  const userId = useAuth().session?.user.id;
  const q = query.trim();
  return useQuery({
    queryKey: ['food-search', q],
    enabled: !!userId && q.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await db().rpc('search_foods', { query: q, max_results: 40 });
      if (error) throw error;
      return data;
    },
  });
}

export function useFood(id: string | undefined) {
  const custom = useCustomFoods();
  const local = custom.rows.find((f) => f.id === id);
  const q = useQuery({
    queryKey: ['food', id],
    enabled: !!id && !local,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await db()
        .from('foods')
        .select('*')
        .eq('id', id as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    food: local ?? q.data ?? null,
    isPending: !local && q.isPending,
    isError: !local && q.isError,
    refetch: q.refetch,
  };
}

// ---------------------------------------------------------------- actions

export interface LogItemInput {
  date: string;
  meal: MealType;
  name: string;
  foodId: string | null;
  recipeId?: string | null;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  nutrition: Nutrition;
  source: string;
  confidence: string;
}

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

export function useNutritionActions() {
  const { write } = useSyncActions();
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';

  const logItem = async (i: LogItemInput, id: string = randomUUID()) => {
    await write({
      id: randomUUID(),
      entity: 'meal_log_items',
      recordKey: id,
      kind: 'upsert',
      createdOffline: true,
      payload: {
        id,
        local_date: i.date,
        meal_type: i.meal,
        logged_at: eventTime(i.date, timezone).measuredAt,
        food_id: i.foodId,
        recipe_id: i.recipeId ?? null,
        name_snapshot: i.name.slice(0, 200),
        quantity: i.quantity,
        unit: i.unit,
        grams: r1(i.grams),
        kcal: r1(i.nutrition.kcal),
        protein_g: r1(i.nutrition.protein_g),
        carbs_g: r1(i.nutrition.carbs_g),
        fat_g: r1(i.nutrition.fat_g),
        fibre_g: r1(i.nutrition.fibre_g),
        source_snapshot: i.source,
        confidence_snapshot: i.confidence,
      },
    });
    return id;
  };

  return {
    logItem,
    /** Logs `grams` of a catalogue/custom food with a nutrition snapshot. */
    logFood: (
      date: string,
      meal: MealType,
      food: Food,
      grams: number,
      portion: { label: string; count: number } | null,
    ) =>
      logItem({
        date,
        meal,
        name: food.brand ? `${food.name} (${food.brand})` : food.name,
        foodId: food.id,
        quantity: portion ? portion.count : grams,
        unit: portion ? portion.label : food.basis === 'per_100ml' ? 'ml' : 'g',
        grams,
        nutrition: nutritionForGrams(food, grams),
        source: food.source,
        confidence: food.nutritional_confidence,
      }),
    updateItem: (item: MealLogItem, changes: Partial<MealLogItem>) =>
      write({
        id: randomUUID(),
        entity: 'meal_log_items',
        recordKey: item.id,
        kind: 'upsert',
        createdOffline: false,
        payload: { ...stripMeta(item), ...changes },
      }),
    deleteItem: (item: MealLogItem, existsOnServer: boolean) =>
      write({
        id: randomUUID(),
        entity: 'meal_log_items',
        recordKey: item.id,
        kind: 'delete',
        payload: null,
        createdOffline: !existsOnServer,
      }),
    /** Copies items into another day/meal (appends; spec 28.7 #5). */
    copyItems: async (items: readonly MealLogItem[], date: string, meal: MealType) => {
      for (const it of items) {
        await logItem({
          date,
          meal,
          name: it.name_snapshot,
          foodId: it.food_id,
          recipeId: it.recipe_id,
          quantity: it.quantity === null ? null : Number(it.quantity),
          unit: it.unit,
          grams: it.grams === null ? null : Number(it.grams),
          nutrition: {
            kcal: num(it.kcal),
            protein_g: num(it.protein_g),
            carbs_g: num(it.carbs_g),
            fat_g: num(it.fat_g),
            fibre_g: num(it.fibre_g),
          },
          source: it.source_snapshot ?? 'copy',
          confidence: it.confidence_snapshot ?? 'user',
        });
      }
    },
    addWater: async (date: string, ml: number) => {
      const id = randomUUID();
      await write({
        id: randomUUID(),
        entity: 'water_logs',
        recordKey: id,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id,
          amount_ml: Math.round(ml),
          recorded_at: eventTime(date, timezone).measuredAt,
          local_date: date,
        },
      });
      return id;
    },
    removeWater: (id: string, existsOnServer: boolean) =>
      write({
        id: randomUUID(),
        entity: 'water_logs',
        recordKey: id,
        kind: 'delete',
        payload: null,
        createdOffline: !existsOnServer,
      }),
    setDayComplete: (date: string, complete: boolean, existsOnServer: boolean) =>
      write({
        id: randomUUID(),
        entity: 'day_log_status',
        recordKey: date,
        kind: 'upsert',
        createdOffline: !existsOnServer,
        payload: { local_date: date, nutrition_complete: complete },
      }),
    /** Create (new id) or replace (existing id) one of your saved meals. Works offline. */
    saveSavedMeal: async (draft: MealDraft, existing?: { id: string; onServer: boolean }) => {
      const id = existing?.id ?? randomUUID();
      await write({
        id: randomUUID(),
        entity: 'saved_meals',
        recordKey: id,
        kind: 'upsert',
        createdOffline: !existing?.onServer,
        payload: {
          id,
          name: draft.name.trim().slice(0, 80),
          meal_type: draft.mealType,
          items: draft.items.map(mealItemToJson),
          archived_at: null,
        },
      });
      return id;
    },
    archiveSavedMeal: (m: SavedMeal) =>
      write({
        id: randomUUID(),
        entity: 'saved_meals',
        recordKey: m.id,
        kind: 'upsert',
        createdOffline: false,
        payload: { ...stripMeta(m), archived_at: new Date().toISOString() },
      }),
    /** Create a custom food, or replace one of yours (`existing`). Logged entries keep their snapshot. */
    saveFood: async (
      f: { name: string; brand: string | null; basis: 'per_100g' | 'per_100ml' } & Nutrition & {
          portions: FoodPortion[];
        },
      existing?: { id: string; onServer: boolean },
    ) => {
      const id = existing?.id ?? randomUUID();
      await write({
        id: randomUUID(),
        entity: 'foods',
        recordKey: id,
        kind: 'upsert',
        createdOffline: !existing?.onServer,
        payload: {
          id,
          archived_at: null,
          name: f.name.trim().slice(0, 200),
          brand: f.brand?.trim() || null,
          basis: f.basis,
          kcal: f.kcal,
          protein_g: f.protein_g,
          carbs_g: f.carbs_g,
          fat_g: f.fat_g,
          fibre_g: f.fibre_g,
          portions: f.portions,
          source: 'user',
          nutritional_confidence: 'user',
        },
      });
      return id;
    },
    /** Remove one of your foods from search and lists (history keeps its entries). */
    archiveFood: (food: Food, onServer: boolean) => {
      const {
        _pending,
        _failed,
        created_at,
        updated_at,
        client_updated_at,
        owner_id,
        search,
        ...rest
      } = food as Food & { _pending?: boolean; _failed?: boolean };
      return write({
        id: randomUUID(),
        entity: 'foods',
        recordKey: food.id,
        kind: 'upsert',
        createdOffline: !onServer,
        payload: { ...rest, archived_at: new Date().toISOString() },
      });
    },
  };
}

/** Saved meal items as validated snapshots (flat shape for totals and logging). */
export interface SavedMealItem {
  kind: MealItem['kind'];
  name: string;
  food_id: string | null;
  recipe_id: string | null;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  confidence: string;
}

export function savedMealItems(m: Pick<SavedMeal, 'items'>): SavedMealItem[] {
  return readMealItems(m.items).map((i) => ({
    kind: i.kind,
    name: i.name,
    food_id: i.foodId,
    recipe_id: i.recipeId,
    quantity: i.quantity,
    unit: i.unit,
    grams: i.grams,
    ...i.nutrition,
    confidence: i.confidence,
  }));
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

function stripMeta<T extends Record<string, unknown>>(row: T) {
  const {
    _pending,
    _failed,
    created_at,
    updated_at,
    client_updated_at,
    user_id,
    owner_id,
    search,
    ...rest
  } = row as Record<string, unknown>;
  return rest;
}
