/** User recipe nutrition from foods (spec 12.5). Pure. */
import { type Nutrition, nutritionForGrams, type Per100, perServing, sumNutrition } from './totals';

export interface RecipeIngredientInput {
  food: { id: string; name: string } & Per100;
  grams: number;
}

/** Nutrition of a user recipe from its foods (spec 12.5): Σ per-100 g × grams / 100. */
export function recipeNutrition(
  ingredients: readonly RecipeIngredientInput[],
  servings: number,
): { total: Nutrition; perServing: Nutrition; partial: number } {
  const parts = ingredients.map((i) => nutritionForGrams(i.food, i.grams));
  const t = sumNutrition(parts);
  const total: Nutrition = {
    kcal: t.kcal,
    protein_g: t.protein_g,
    carbs_g: t.carbs_g,
    fat_g: t.fat_g,
    fibre_g: t.fibre_g,
  };
  return { total, perServing: perServing(total, servings), partial: t.partialItems };
}
