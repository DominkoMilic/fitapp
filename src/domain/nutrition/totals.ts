/**
 * Food maths (spec 12.1, 12.2, 12.5). Pure.
 * Nutrition values are per 100 g (or 100 ml). Missing values stay null; totals report how many
 * items lacked data so the UI can say "partial" instead of pretending they were zero.
 */
export interface Per100 {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
}

export interface Nutrition {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
}

const KEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'] as const;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Nutrition for `grams` of a food (N1: 150 g of 165/31/0/3.6 → 247.5/46.5/0/5.4). */
export function nutritionForGrams(food: Per100, grams: number): Nutrition {
  const out = {} as Nutrition;
  for (const k of KEYS) {
    const v = food[k];
    out[k] =
      v === null || !Number.isFinite(grams) || grams <= 0
        ? v === null
          ? null
          : 0
        : round1((Number(v) * grams) / 100);
  }
  return out;
}

export interface Totals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  items: number;
  /** Items missing at least one of kcal/protein/carbs/fat. */
  partialItems: number;
}

export function sumNutrition(
  items: readonly Partial<Record<(typeof KEYS)[number], number | string | null>>[],
): Totals {
  const t: Totals = {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fibre_g: 0,
    items: items.length,
    partialItems: 0,
  };
  for (const it of items) {
    let partial = false;
    for (const k of KEYS) {
      const raw = it[k];
      const v = raw === null || raw === undefined || raw === '' ? null : Number(raw);
      if (v === null || !Number.isFinite(v)) {
        if (k !== 'fibre_g') partial = true;
        continue;
      }
      t[k] += v;
    }
    if (partial) t.partialItems++;
  }
  for (const k of KEYS) t[k] = round1(t[k]);
  return t;
}

/** Per-serving nutrition of a user recipe (N9: 2000 kcal / 4 servings = 500). */
export function perServing(total: Nutrition, servings: number): Nutrition {
  const out = {} as Nutrition;
  for (const k of KEYS)
    out[k] = total[k] === null || servings <= 0 ? null : round1(total[k]! / servings);
  return out;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** Default meal for the local time (spec 12.2). `minutes` = minutes since local midnight. */
export function mealTypeForTime(minutes: number): MealType {
  if (minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 17 * 60) return 'snack';
  if (minutes < 21 * 60 + 30) return 'dinner';
  return 'snack';
}

/** Share of the daily target per meal slot, adjusted for meals per day (spec 12.6). */
export function slotShare(meal: MealType, mealsPerDay: number): number {
  const base: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
  if (mealsPerDay <= 2) return { breakfast: 0.4, lunch: 0, dinner: 0.5, snack: 0.1 }[meal];
  if (mealsPerDay >= 4) return { breakfast: 0.25, lunch: 0.3, dinner: 0.3, snack: 0.15 }[meal];
  return base[meal];
}

export type QuantityCheck =
  { ok: true; confirm: boolean } | { ok: false; reason: 'zero' | 'negative' | 'too_large' };

/** Quantity validation (spec 28.7 #3): >0, ≤5000 g; above 1500 g ask for confirmation. */
export function checkGrams(grams: number): QuantityCheck {
  if (!Number.isFinite(grams) || grams === 0) return { ok: false, reason: 'zero' };
  if (grams < 0) return { ok: false, reason: 'negative' };
  if (grams > 5000) return { ok: false, reason: 'too_large' };
  return { ok: true, confirm: grams > 1500 };
}

/** Water safety (spec 12.8): single entry > 2000 ml or day > 10 L needs confirmation. */
export function waterNeedsConfirm(amountMl: number, dayTotalMl: number): boolean {
  return amountMl > 2000 || dayTotalMl + amountMl > 10_000;
}
