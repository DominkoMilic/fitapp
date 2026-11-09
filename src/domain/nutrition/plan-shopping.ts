/** Planned meals → shopping list sources (spec 12.7). Pure. */
import { parseMeasure } from './measure-parser';
import { readIngredients } from './recipe-ingredients';
import { readMealItems } from './saved-meal-draft';
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
      const loose: ShoppingSource['ingredients'] = [];
      for (const i of readMealItems(m.items)) {
        const r = i.kind === 'recipe' && i.recipeId ? input.recipes.get(i.recipeId) : undefined;
        if (r) {
          // A recipe inside a meal: its ingredients, scaled to the servings in the meal × planned.
          const base = r.servings_stated ?? input.saved.get(r.id)?.base_servings ?? null;
          if (!base) unscaled.push(r.name);
          sources.push({
            recipeName: r.name,
            factor: base ? (servings * (i.quantity ?? 1)) / base : 1,
            ingredients: readIngredients(r.ingredients).map((x) => ({
              name: x.name,
              measure: x.measure,
            })),
          });
        } else {
          loose.push({ name: i.name, measure: parseMeasure(i.grams ? `${i.grams} g` : '') });
        }
      }
      if (loose.length) sources.push({ recipeName: m.name, factor: servings, ingredients: loose });
    }
  }
  return { sources, unscaled };
}
