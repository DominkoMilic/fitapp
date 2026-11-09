import { z } from 'zod';

import { requireSupabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/database.types';

import type { RecipeSummary } from './recipe-provider.interface';

export type RecipeRow = Tables<'recipes'>;

/** Errors the UI can act on. */
export class RecipeProviderError extends Error {
  constructor(public readonly kind: 'offline' | 'rate_limited' | 'unavailable' | 'not_found') {
    super(kind);
  }
}

const summaries = z.object({
  items: z.array(
    z.object({ externalId: z.string(), name: z.string(), imageUrl: z.string().nullable() }),
  ),
});
const strings = z.object({ items: z.array(z.string()) });
const recipeResponse = z.object({ recipe: z.record(z.string(), z.unknown()) });

async function call<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke('recipes-proxy', { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new RecipeProviderError('rate_limited');
    if (status === 404) throw new RecipeProviderError('not_found');
    if (!status) throw new RecipeProviderError('offline');
    throw new RecipeProviderError('unavailable');
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new RecipeProviderError('unavailable');
  return parsed.data;
}

/** TheMealDB through the recipes-proxy Edge Function (the API key never reaches the app). */
export const themealdb = {
  search: async (query: string): Promise<RecipeSummary[]> =>
    (await call({ action: 'search', query }, summaries)).items,
  categories: async (): Promise<string[]> => (await call({ action: 'categories' }, strings)).items,
  byCategory: async (category: string): Promise<RecipeSummary[]> =>
    (await call({ action: 'byCategory', category }, summaries)).items,
  byIngredient: async (ingredient: string): Promise<RecipeSummary[]> =>
    (await call({ action: 'byIngredient', ingredient }, summaries)).items,
  lookup: async (externalId: string): Promise<RecipeRow> =>
    (await call({ action: 'lookup', externalId }, recipeResponse)).recipe as unknown as RecipeRow,
  random: async (): Promise<RecipeRow> =>
    (await call({ action: 'random' }, recipeResponse)).recipe as unknown as RecipeRow,
};

export const recipeErrorMessage = (e: unknown) => {
  const kind = e instanceof RecipeProviderError ? e.kind : 'unavailable';
  return {
    offline: "You're offline. Saved recipes and your own recipes still work.",
    rate_limited: 'Too many recipe requests. Please wait a minute.',
    unavailable:
      "The recipe service isn't responding right now. Try again later; manual logging always works.",
    not_found: 'This recipe no longer exists.',
  }[kind];
};
