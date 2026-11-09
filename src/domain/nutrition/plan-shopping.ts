/** Planned meals → shopping list sources (spec 12.7). Pure. */
import { parseMeasure } from './measure-parser';
import { readIngredients } from './recipe-ingredients';
import type { ShoppingSource } from './shopping';

export interface PlanEntryLike {
  status: string;
  servings: number | string;
  recipe_id: string | null;
  saved_meal_id: string | null;
}
export interface RecipeLike {
  id: string;
  name: string;
  servings_stated: number | null;
  ingredients: unknown;
}
export interface SavedMealLike {
  name: string;
  items: unknown;
}

/** Saved meal snapshot items → name + grams (defensive). */
function mealItems(m: SavedMealLike): { name: string; grams: number | null }[] {
  if (!Array.isArray(m.items)) return [];
  return m.items.flatMap((x) =>
    x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string'
      ? [
          {
            name: (x as { name: string }).name,
            grams:
              typeof (x as { grams?: unknown }).grams === 'number'
                ? (x as { grams: number }).grams
                : null,
          },
        ]
      : [],
  );
}

/** Builds shopping sources from planned entries (pure apart from the lookups passed in). */
export function shoppingSources(input: {
  entries: readonly PlanEntryLike[];
  recipes: ReadonlyMap<string, RecipeLike>;
  saved: ReadonlyMap<string, { base_servings: number | null }>;
  savedMeals: ReadonlyMap<string, SavedMealLike>;
}): { sources: ShoppingSource[]; unscaled: string[] } {
  const sources: ShoppingSource[] = [];
  const unscaled: string[] = [];
  for (const e of input.entries) {
    if (e.status === 'skipped') continue;
    const servings = Number(e.servings);
    if (e.recipe_id) {
      const r = input.recipes.get(e.recipe_id);
      if (!r) continue;
      const base = r.servings_stated ?? input.saved.get(r.id)?.base_servings ?? null;
      if (!base) unscaled.push(r.name);
      sources.push({
        recipeName: r.name,
        factor: base ? servings / base : 1,
        ingredients: readIngredients(r.ingredients).map((i) => ({
          name: i.name,
          measure: i.measure,
        })),
      });
    } else if (e.saved_meal_id) {
      const m = input.savedMeals.get(e.saved_meal_id);
      if (!m) continue;
      sources.push({
        recipeName: m.name,
        factor: servings,
        ingredients: mealItems(m).map((i) => ({
          name: i.name,
          measure: parseMeasure(i.grams ? `${i.grams} g` : ''),
        })),
      });
    }
  }
  return { sources, unscaled };
}
