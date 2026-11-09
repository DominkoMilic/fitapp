import { MEAL_TYPES, type MealType } from '@/domain/nutrition/totals';

export const asMeal = (v: string | undefined, fallback: MealType = 'snack'): MealType =>
  (MEAL_TYPES as readonly string[]).includes(v ?? '') ? (v as MealType) : fallback;

export const asDate = (v: string | undefined, fallback: string) =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
