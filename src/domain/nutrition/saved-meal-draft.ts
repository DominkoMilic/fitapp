/**
 * Your own meals ("my usual breakfast"): items, totals, editing and validation. Pure.
 *
 * Every item keeps a nutrition snapshot. A food item also keeps its food and grams, a recipe item
 * its recipe and servings. Changing an amount scales the snapshot linearly, which is exact for both
 * (nutrition is proportional to grams or servings). A quick item is a name plus the numbers the
 * user typed in.
 */
import { z } from 'zod';

import { type Nutrition, sumNutrition, type Totals } from './totals';

export type MealItemKind = 'food' | 'quick' | 'recipe';

export interface MealItem {
  kind: MealItemKind;
  name: string;
  foodId: string | null;
  recipeId: string | null;
  /** Portions for food (with `unit`), servings for a recipe; null for grams-only or quick items. */
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  nutrition: Nutrition;
  /** How the numbers were made: 'calculated', 'user_estimate', 'user' (typed in). */
  confidence: string;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

/** Stored items (jsonb) → typed items. Rows saved before this change have no `kind`. */
export function readMealItems(value: unknown): MealItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((x): MealItem[] => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
    const r = x as Record<string, unknown>;
    const name = str(r.name);
    if (!name) return [];
    const recipeId = str(r.recipe_id);
    const foodId = str(r.food_id);
    const kind: MealItemKind =
      r.kind === 'quick' || r.kind === 'recipe' || r.kind === 'food'
        ? r.kind
        : recipeId
          ? 'recipe'
          : foodId
            ? 'food'
            : 'quick';
    return [
      {
        kind,
        name,
        foodId,
        recipeId,
        quantity: num(r.quantity),
        unit: str(r.unit),
        grams: num(r.grams),
        nutrition: {
          kcal: num(r.kcal),
          protein_g: num(r.protein_g),
          carbs_g: num(r.carbs_g),
          fat_g: num(r.fat_g),
          fibre_g: num(r.fibre_g),
        },
        confidence: str(r.confidence) ?? (kind === 'quick' ? 'user' : 'calculated'),
      },
    ];
  });
}

export function mealItemToJson(i: MealItem) {
  return {
    kind: i.kind,
    name: i.name.trim().slice(0, 120),
    food_id: i.foodId,
    recipe_id: i.recipeId,
    quantity: i.quantity,
    unit: i.unit,
    grams: i.grams,
    kcal: i.nutrition.kcal,
    protein_g: i.nutrition.protein_g,
    carbs_g: i.nutrition.carbs_g,
    fat_g: i.nutrition.fat_g,
    fibre_g: i.nutrition.fibre_g,
    confidence: i.confidence,
  };
}

/** The amount a user edits: servings, portions, or grams. Null for quick items. */
export function itemAmount(i: MealItem): { value: number; unit: string } | null {
  if (i.kind === 'quick') return null;
  if (i.quantity !== null && i.quantity > 0) return { value: i.quantity, unit: i.unit ?? '×' };
  if (i.grams !== null && i.grams > 0) return { value: i.grams, unit: 'g' };
  return null;
}

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/** Change an item's amount; grams and nutrition scale with it. */
export function scaleMealItem(i: MealItem, newAmount: number): MealItem {
  const a = itemAmount(i);
  if (!a || !(newAmount > 0)) return i;
  const f = newAmount / a.value;
  const s = (v: number | null) => (v === null ? null : r1(v * f));
  return {
    ...i,
    quantity: i.quantity !== null && i.quantity > 0 ? newAmount : i.quantity,
    grams: i.quantity !== null && i.quantity > 0 ? s(i.grams) : newAmount,
    nutrition: {
      kcal: s(i.nutrition.kcal),
      protein_g: s(i.nutrition.protein_g),
      carbs_g: s(i.nutrition.carbs_g),
      fat_g: s(i.nutrition.fat_g),
      fibre_g: s(i.nutrition.fibre_g),
    },
  };
}

/** A recipe as a meal item: `servings` × its per-serving nutrition. */
export function recipeMealItem(
  r: { id: string; name: string; nutritional_confidence: string } & {
    kcal_per_serving: number | string | null;
    protein_per_serving: number | string | null;
    carbs_per_serving: number | string | null;
    fat_per_serving: number | string | null;
    fibre_per_serving: number | string | null;
  },
  servings: number,
): MealItem {
  const per = (v: number | string | null) => (v === null ? null : r1(Number(v) * servings));
  return {
    kind: 'recipe',
    name: r.name,
    foodId: null,
    recipeId: r.id,
    quantity: servings,
    unit: 'serving',
    grams: null,
    nutrition: {
      kcal: per(r.kcal_per_serving),
      protein_g: per(r.protein_per_serving),
      carbs_g: per(r.carbs_per_serving),
      fat_g: per(r.fat_per_serving),
      fibre_g: per(r.fibre_per_serving),
    },
    confidence: r.nutritional_confidence === 'user_estimate' ? 'user_estimate' : 'calculated',
  };
}

export const mealTotals = (items: readonly MealItem[]): Totals =>
  sumNutrition(items.map((i) => i.nutrition));

export const mealDraftSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep the name under 80 characters'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable(),
  items: z
    .array(
      z.object({
        kind: z.enum(['food', 'quick', 'recipe']),
        name: z.string().trim().min(1, 'Name every item').max(120),
        nutrition: z.object({
          kcal: z.number().min(0).max(10000, 'That’s over 10,000 kcal for one item').nullable(),
        }),
      }),
    )
    .min(1, 'Add at least one item')
    .max(40, 'Up to 40 items'),
});

export interface MealDraft {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  items: MealItem[];
}

export interface LoggedItemLike {
  name_snapshot: string;
  food_id: string | null;
  recipe_id: string | null;
  quantity: number | string | null;
  unit: string | null;
  grams: number | string | null;
  kcal: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  fibre_g: number | string | null;
  confidence_snapshot: string | null;
}

/** Entries already logged for a meal → meal items ("Save as a meal"). */
export function itemsFromLog(items: readonly LoggedItemLike[]): MealItem[] {
  const n = (v: number | string | null) => (v === null || v === '' ? null : Number(v));
  return items.map((it) => ({
    kind: it.recipe_id ? 'recipe' : it.food_id ? 'food' : 'quick',
    name: it.name_snapshot,
    foodId: it.food_id,
    recipeId: it.recipe_id,
    quantity: n(it.quantity),
    unit: it.unit,
    grams: n(it.grams),
    nutrition: {
      kcal: n(it.kcal),
      protein_g: n(it.protein_g),
      carbs_g: n(it.carbs_g),
      fat_g: n(it.fat_g),
      fibre_g: n(it.fibre_g),
    },
    confidence: it.confidence_snapshot ?? (it.food_id || it.recipe_id ? 'calculated' : 'user'),
  }));
}
