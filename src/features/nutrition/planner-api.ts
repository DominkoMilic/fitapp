import { randomUUID } from 'expo-crypto';
import { useCallback } from 'react';

import { addDays } from '@/domain/calculations/dates';
import { shoppingSources } from '@/domain/nutrition/plan-shopping';
import { buildShoppingList, type ShoppingSource } from '@/domain/nutrition/shopping';
import type { MealType } from '@/domain/nutrition/totals';
import { useSyncActions } from '@/features/sync/SyncProvider';
import { type Synced, useSyncedRows } from '@/features/sync/useSyncedRows';
import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

export type PlanEntry = Tables<'meal_plan_entries'>;
export type ShoppingList = Tables<'shopping_lists'>;
export type ShoppingItem = Tables<'shopping_list_items'>;

const db = () => requireSupabase();

export function usePlanEntries(from: string, to: string) {
  const filter = useCallback(
    (r: PlanEntry) => r.local_date >= from && r.local_date <= to,
    [from, to],
  );
  return useSyncedRows<PlanEntry>({
    entity: 'meal_plan_entries',
    scope: [from, to],
    keyOf: (r) => r.id,
    filter,
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('meal_plan_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('local_date', from)
        .lte('local_date', to);
      if (error) throw error;
      return data;
    },
  });
}

export function useShoppingLists() {
  return useSyncedRows<ShoppingList>({
    entity: 'shopping_lists',
    keyOf: (r) => r.id,
    filter: useCallback((r: ShoppingList) => r.status === 'active', []),
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('shopping_lists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useShoppingItems(listId: string | undefined) {
  const filter = useCallback((r: ShoppingItem) => r.shopping_list_id === listId, [listId]);
  return useSyncedRows<ShoppingItem>({
    entity: 'shopping_list_items',
    scope: [listId],
    keyOf: (r) => r.id,
    filter,
    enabled: !!listId,
    fetch: async (userId) => {
      const { data, error } = await db()
        .from('shopping_list_items')
        .select('*')
        .eq('user_id', userId)
        .eq('shopping_list_id', listId as string);
      if (error) throw error;
      return data;
    },
  });
}

export function usePlannerActions() {
  const { write } = useSyncActions();
  const upsertEntry = (e: Synced<PlanEntry>, changes: Partial<PlanEntry>) => {
    const { _pending, _failed, created_at, updated_at, client_updated_at, user_id, ...row } = e;
    return write({
      id: randomUUID(),
      entity: 'meal_plan_entries',
      recordKey: e.id,
      kind: 'upsert',
      createdOffline: false,
      payload: { ...row, ...changes },
    });
  };
  return {
    add: async (p: {
      date: string;
      meal: MealType;
      title: string;
      recipeId?: string | null;
      savedMealId?: string | null;
      customTitle?: string | null;
      servings: number;
    }) => {
      const id = randomUUID();
      await write({
        id: randomUUID(),
        entity: 'meal_plan_entries',
        recordKey: id,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id,
          local_date: p.date,
          meal_type: p.meal,
          recipe_id: p.recipeId ?? null,
          saved_meal_id: p.savedMealId ?? null,
          custom_title: p.customTitle ?? null,
          title_snapshot: p.title.slice(0, 200),
          servings: p.servings,
          status: 'planned',
        },
      });
    },
    setStatus: (e: Synced<PlanEntry>, status: PlanEntry['status']) => upsertEntry(e, { status }),
    remove: (e: PlanEntry, existsOnServer: boolean) =>
      write({
        id: randomUUID(),
        entity: 'meal_plan_entries',
        recordKey: e.id,
        kind: 'delete',
        payload: null,
        createdOffline: !existsOnServer,
      }),
    /** Creates a list (parent) and its items (children); the outbox syncs the parent first. */
    createShoppingList: async (
      name: string,
      from: string,
      to: string,
      sources: ShoppingSource[],
    ) => {
      const listId = randomUUID();
      await write({
        id: randomUUID(),
        entity: 'shopping_lists',
        recordKey: listId,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id: listId,
          name: name.slice(0, 80),
          range_start: from,
          range_end: to,
          status: 'active',
        },
      });
      const lines = buildShoppingList(sources);
      let i = 0;
      for (const l of lines) {
        const id = randomUUID();
        await write({
          id: randomUUID(),
          entity: 'shopping_list_items',
          recordKey: id,
          kind: 'upsert',
          createdOffline: true,
          payload: {
            id,
            shopping_list_id: listId,
            ingredient_name: l.name,
            quantity_min: l.quantityMin,
            quantity_max: l.quantityMax,
            unit: l.unit,
            raw_text: l.rawText,
            source_recipes: l.recipes,
            is_checked: false,
            is_manual: false,
            sort_index: i++,
          },
        });
      }
      return listId;
    },
    toggleItem: (it: Synced<ShoppingItem>) => {
      const { _pending, _failed, created_at, updated_at, client_updated_at, user_id, ...row } = it;
      return write({
        id: randomUUID(),
        entity: 'shopping_list_items',
        recordKey: it.id,
        kind: 'upsert',
        createdOffline: false,
        payload: { ...row, is_checked: !it.is_checked },
      });
    },
    addManualItem: async (listId: string, name: string, sortIndex: number) => {
      const id = randomUUID();
      await write({
        id: randomUUID(),
        entity: 'shopping_list_items',
        recordKey: id,
        kind: 'upsert',
        createdOffline: true,
        payload: {
          id,
          shopping_list_id: listId,
          ingredient_name: name.trim().slice(0, 200),
          is_manual: true,
          is_checked: false,
          sort_index: sortIndex,
          source_recipes: [],
        },
      });
    },
    archiveList: (l: Synced<ShoppingList>) => {
      const { _pending, _failed, created_at, updated_at, client_updated_at, user_id, ...row } = l;
      return write({
        id: randomUUID(),
        entity: 'shopping_lists',
        recordKey: l.id,
        kind: 'upsert',
        createdOffline: false,
        payload: { ...row, status: 'archived' },
      });
    },
  };
}

export { shoppingSources };

export const weekDates = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));
