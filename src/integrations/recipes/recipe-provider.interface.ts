import type { ParsedMeasure } from '@/domain/nutrition/measure-parser';

export interface RecipeSummary {
  externalId: string;
  name: string;
  imageUrl: string | null;
}

export interface NormalizedIngredient {
  name: string;
  measure: ParsedMeasure;
}

/** A recipe as PACE stores it. External recipes never carry nutrition (spec 12.3). */
export interface NormalizedRecipe {
  source: 'themealdb';
  externalId: string;
  name: string;
  category: string | null;
  cuisine: string | null;
  tags: string[];
  imageUrl: string | null;
  instructions: string[];
  ingredients: NormalizedIngredient[];
  sourceUrl: string | null;
  videoUrl: string | null;
  /** TheMealDB does not state servings. */
  servingsStated: null;
}

export interface RecipeProvider {
  id: 'themealdb';
  search(query: string): Promise<RecipeSummary[]>;
  getById(externalId: string): Promise<NormalizedRecipe | null>;
  random(): Promise<NormalizedRecipe | null>;
  categories(): Promise<string[]>;
  byCategory(category: string): Promise<RecipeSummary[]>;
  byIngredient(ingredient: string): Promise<RecipeSummary[]>;
}
