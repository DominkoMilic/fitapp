/**
 * Editable "your own recipe" model (create, edit, duplicate). Pure.
 *
 * Ingredients are either a food from the database (grams, nutrition calculated from its per-100 g
 * values) or free text ("flour" + "2 cups", "salt" + "to taste"), which is shown and scaled but
 * never given invented nutrition. Nutrition per serving is either calculated from the food rows or
 * typed in by the user ("Your estimate").
 */
import { z } from 'zod';

import { parseMeasure } from './measure-parser';
import { readIngredients } from './recipe-ingredients';
import { type Nutrition, nutritionForGrams, type Per100, perServing, sumNutrition } from './totals';

export type DraftIngredient =
  | { kind: 'food'; foodId: string; name: string; grams: number; per100: Per100 | null }
  | { kind: 'text'; name: string; amount: string };

export type NutritionMode = 'calculated' | 'estimate';

export interface RecipeDraft {
  name: string;
  description: string;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  steps: string[];
  sourceUrl: string | null;
  ingredients: DraftIngredient[];
  nutritionMode: NutritionMode;
  /** Per serving, used when nutritionMode is 'estimate'. kcal is required then. */
  estimate: Nutrition;
}

export const EMPTY_NUTRITION: Nutrition = {
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  fibre_g: null,
};

export const emptyDraft = (): RecipeDraft => ({
  name: '',
  description: '',
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  steps: [],
  sourceUrl: null,
  ingredients: [],
  nutritionMode: 'calculated',
  estimate: { ...EMPTY_NUTRITION },
});

const minutes = z.number().int().min(0, 'Minutes can’t be negative').max(1440).nullable();
const macro = z.number().min(0).max(1000).nullable();

export const recipeDraftSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(200),
    description: z.string().max(2000, 'Keep the description under 2,000 characters'),
    servings: z.number().int().min(1, 'Servings must be 1–50').max(50, 'Servings must be 1–50'),
    prepMinutes: minutes,
    cookMinutes: minutes,
    tags: z.array(z.string().trim().min(1).max(30)).max(8, 'Up to 8 tags'),
    steps: z
      .array(z.string().trim().min(1).max(500, 'Keep each step under 500 characters'))
      .max(40),
    sourceUrl: z
      .string()
      .url('Enter a full link starting with https://')
      .startsWith('https://', 'Links must start with https://')
      .max(500)
      .nullable(),
    ingredients: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('food'),
            foodId: z.string().min(1),
            name: z.string().min(1).max(200),
            grams: z.number().gt(0, 'Enter grams above 0').max(5000, 'Up to 5,000 g'),
            per100: z.any(),
          }),
          z.object({
            kind: z.literal('text'),
            name: z.string().trim().min(1, 'Name every ingredient').max(200),
            amount: z.string().trim().max(60),
          }),
        ]),
      )
      .min(1, 'Add at least one ingredient')
      .max(60),
    nutritionMode: z.enum(['calculated', 'estimate']),
    estimate: z.object({
      kcal: z.number().min(0).max(5000).nullable(),
      protein_g: macro,
      carbs_g: macro,
      fat_g: macro,
      fibre_g: macro,
    }),
  })
  .refine(
    (d) => d.nutritionMode !== 'estimate' || (d.estimate.kcal !== null && d.estimate.kcal > 0),
    {
      message: 'Enter the calories per serving for your estimate',
      path: ['estimate', 'kcal'],
    },
  );

export interface DraftNutrition {
  /** Per serving, or null when nothing can be calculated or estimated. */
  perServing: Nutrition | null;
  mode: NutritionMode;
  /** Ingredients with nutrition data (calculated mode). */
  covered: number;
  total: number;
}

/** Nutrition per serving for the draft, with how many ingredients it was calculated from. */
export function nutritionForDraft(
  d: Pick<RecipeDraft, 'ingredients' | 'servings' | 'nutritionMode' | 'estimate'>,
): DraftNutrition {
  const total = d.ingredients.length;
  if (d.nutritionMode === 'estimate') {
    return {
      perServing: d.estimate.kcal === null ? null : { ...d.estimate },
      mode: 'estimate',
      covered: total,
      total,
    };
  }
  const foods = d.ingredients.filter(
    (i): i is Extract<DraftIngredient, { kind: 'food' }> =>
      i.kind === 'food' && i.per100 !== null && i.per100.kcal !== null,
  );
  if (!foods.length) return { perServing: null, mode: 'calculated', covered: 0, total };
  const t = sumNutrition(foods.map((i) => nutritionForGrams(i.per100 as Per100, i.grams)));
  const sum: Nutrition = {
    kcal: t.kcal,
    protein_g: t.protein_g,
    carbs_g: t.carbs_g,
    fat_g: t.fat_g,
    fibre_g: t.fibre_g,
  };
  return {
    perServing: perServing(sum, Math.max(1, d.servings)),
    mode: 'calculated',
    covered: foods.length,
    total,
  };
}

/** "Calculated from 3 of 5 ingredients", "Your estimate", or null when there's no nutrition. */
export function nutritionNote(
  n: Pick<DraftNutrition, 'perServing' | 'mode' | 'covered' | 'total'>,
): string | null {
  if (!n.perServing) return null;
  if (n.mode === 'estimate') return 'Your estimate';
  return n.covered === n.total
    ? 'Calculated from your ingredients'
    : `Calculated from ${n.covered} of ${n.total} ingredients — the rest have no nutrition data`;
}

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const per100Of = (v: unknown): Per100 | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const n = (k: string) =>
    typeof o[k] === 'number' && Number.isFinite(o[k]) ? (o[k] as number) : null;
  const p = {
    kcal: n('kcal'),
    protein_g: n('protein_g'),
    carbs_g: n('carbs_g'),
    fat_g: n('fat_g'),
    fibre_g: n('fibre_g'),
  };
  return p.kcal === null ? null : p;
};

/** Stored ingredient jsonb for one draft ingredient (same shape TheMealDB rows use, plus a nutrition snapshot). */
function ingredientToJson(i: DraftIngredient) {
  if (i.kind === 'food') {
    return {
      name: i.name,
      food_id: i.foodId,
      grams: i.grams,
      raw_measure: `${i.grams} g`,
      quantity_min: i.grams,
      quantity_max: i.grams,
      unit: 'g',
      parse_status: 'parsed',
      per100: i.per100,
    };
  }
  const m = parseMeasure(i.amount);
  return {
    name: i.name.trim(),
    food_id: null,
    grams: null,
    raw_measure: i.amount.trim(),
    quantity_min: m.quantityMin,
    quantity_max: m.quantityMax,
    unit: m.unit,
    note: m.note,
    parse_status: i.amount.trim() ? m.status : 'unparsed',
  };
}

/** The `recipes` columns for a draft (owner_id is added by the sync transport). */
export function draftToRow(d: RecipeDraft, id: string) {
  const n = nutritionForDraft(d);
  const confidence = !n.perServing
    ? 'none'
    : n.mode === 'estimate'
      ? 'user_estimate'
      : 'calculated';
  const p = n.perServing ?? EMPTY_NUTRITION;
  return {
    id,
    source: 'user' as const,
    external_id: null,
    name: d.name.trim().slice(0, 200),
    description: d.description.trim() || null,
    image_url: null,
    category: null,
    cuisine: null,
    tags: d.tags.map((t) => t.trim()).filter(Boolean),
    instructions: d.steps.map((s) => s.trim()).filter(Boolean),
    ingredients: d.ingredients.map(ingredientToJson),
    preparation_minutes: d.prepMinutes,
    cooking_minutes: d.cookMinutes,
    servings_stated: d.servings,
    source_url: d.sourceUrl?.trim() || null,
    video_url: null,
    nutritional_confidence: confidence,
    kcal_per_serving: r1(p.kcal),
    protein_per_serving: r1(p.protein_g),
    carbs_per_serving: r1(p.carbs_g),
    fat_per_serving: r1(p.fat_g),
    fibre_per_serving: r1(p.fibre_g),
    archived_at: null,
  };
}

export interface RecipeRowLike {
  name: string;
  description: string | null;
  source: string;
  tags: string[];
  instructions: string[];
  ingredients: unknown;
  preparation_minutes: number | null;
  cooking_minutes: number | null;
  servings_stated: number | null;
  source_url: string | null;
  nutritional_confidence: string;
  kcal_per_serving: number | string | null;
  protein_per_serving: number | string | null;
  carbs_per_serving: number | string | null;
  fat_per_serving: number | string | null;
  fibre_per_serving: number | string | null;
}

const numOrNull = (v: number | string | null) => (v === null || v === '' ? null : Number(v));

/** A stored own recipe → an editable draft. */
export function rowToDraft(row: RecipeRowLike): RecipeDraft {
  const raw = Array.isArray(row.ingredients) ? (row.ingredients as Record<string, unknown>[]) : [];
  const parsed = readIngredients(row.ingredients);
  const ingredients: DraftIngredient[] = parsed.map((i, k) =>
    i.foodId && i.grams !== null
      ? {
          kind: 'food',
          foodId: i.foodId,
          name: i.name,
          grams: i.grams,
          per100: per100Of(raw[k]?.per100),
        }
      : { kind: 'text', name: i.name, amount: i.measure.raw },
  );
  const estimate = row.nutritional_confidence === 'user_estimate';
  return {
    name: row.name,
    description: row.description ?? '',
    servings: row.servings_stated ?? 1,
    prepMinutes: row.preparation_minutes,
    cookMinutes: row.cooking_minutes,
    tags: [...row.tags],
    steps: [...row.instructions],
    sourceUrl: row.source_url,
    ingredients,
    nutritionMode: estimate ? 'estimate' : 'calculated',
    estimate: estimate
      ? {
          kcal: numOrNull(row.kcal_per_serving),
          protein_g: numOrNull(row.protein_per_serving),
          carbs_g: numOrNull(row.carbs_per_serving),
          fat_g: numOrNull(row.fat_per_serving),
          fibre_g: numOrNull(row.fibre_per_serving),
        }
      : { ...EMPTY_NUTRITION },
  };
}

/**
 * A copy to edit as your own. Your own recipe copies everything ("… (copy)"). A TheMealDB recipe
 * keeps its name, ingredients (as text), method and link for attribution, but no nutrition: the
 * source has none and PACE never invents it.
 */
export function duplicateRecipe(row: RecipeRowLike): RecipeDraft {
  const d = rowToDraft(row);
  if (row.source === 'user') return { ...d, name: `${row.name} (copy)`.slice(0, 200) };
  return {
    ...d,
    servings: row.servings_stated ?? 4,
    ingredients: readIngredients(row.ingredients).map((i) => ({
      kind: 'text' as const,
      name: i.name,
      amount: i.measure.raw,
    })),
    nutritionMode: 'calculated',
    estimate: { ...EMPTY_NUTRITION },
  };
}

/** Move one list item up (-1) or down (+1); out-of-range moves return the list unchanged. */
export function moveItem<T>(list: readonly T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const out = [...list];
  [out[index], out[to]] = [out[to] as T, out[index] as T];
  return out;
}
