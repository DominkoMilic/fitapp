/**
 * Shopping list generation (spec 12.7). Pure.
 * Lines merge only when the normalised ingredient name AND unit match; unparsed measures stay as
 * separate text lines naming their recipe. Nothing is converted between units.
 */
import { type ParsedMeasure, scaleMeasure } from './measure-parser';

export interface ShoppingSource {
  recipeName: string;
  ingredients: { name: string; measure: ParsedMeasure }[];
  /** target servings / base servings; 1 when the base is unknown. */
  factor: number;
}

export interface ShoppingLine {
  key: string;
  name: string;
  quantityMin: number | null;
  quantityMax: number | null;
  unit: string | null;
  rawText: string | null;
  recipes: string[];
}

/** Lowercase, single spaces, simple plural → singular ("Tomatoes" → "tomato", "eggs" → "egg"). */
export function normaliseIngredient(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (n.length > 4 && n.endsWith('oes')) return n.slice(0, -2);
  if (n.length > 3 && n.endsWith('s') && !/(ss|us|is)$/.test(n)) return n.slice(0, -1);
  return n;
}

export function buildShoppingList(sources: readonly ShoppingSource[]): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine>();
  for (const src of sources) {
    for (const ing of src.ingredients) {
      const name = normaliseIngredient(ing.name);
      if (!name) continue;
      const m = ing.measure;
      if (m.status !== 'parsed' || m.quantityMin === null) {
        const key = `raw:${name}:${src.recipeName}:${m.raw}`;
        lines.set(key, {
          key,
          name,
          quantityMin: null,
          quantityMax: null,
          unit: null,
          rawText: m.raw ? `${m.raw} (${src.recipeName})` : `(${src.recipeName})`,
          recipes: [src.recipeName],
        });
        continue;
      }
      const scaled = scaleMeasure(m, src.factor);
      const key = `${name}|${scaled.unit ?? ''}`;
      const cur = lines.get(key);
      if (cur) {
        cur.quantityMin = round((cur.quantityMin ?? 0) + (scaled.quantityMin ?? 0));
        cur.quantityMax = round((cur.quantityMax ?? 0) + (scaled.quantityMax ?? 0));
        if (!cur.recipes.includes(src.recipeName)) cur.recipes.push(src.recipeName);
      } else {
        lines.set(key, {
          key,
          name,
          quantityMin: scaled.quantityMin,
          quantityMax: scaled.quantityMax,
          unit: scaled.unit,
          rawText: null,
          recipes: [src.recipeName],
        });
      }
    }
  }
  return [...lines.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const round = (v: number) => Math.round(v * 100) / 100;
