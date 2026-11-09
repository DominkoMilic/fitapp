/** Stored recipe ingredients (jsonb) → typed values. Pure, defensive against bad data. */
import type { ParsedMeasure, ParseStatus } from './measure-parser';

export interface StoredIngredient {
  name: string;
  measure: ParsedMeasure;
  foodId: string | null;
  grams: number | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const STATUSES: ParseStatus[] = ['parsed', 'unparsed', 'to_taste'];

export function readIngredients(value: unknown): StoredIngredient[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((x) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
    const r = x as Record<string, unknown>;
    const name = str(r.name);
    if (!name) return [];
    const status = STATUSES.includes(r.parse_status as ParseStatus)
      ? (r.parse_status as ParseStatus)
      : 'unparsed';
    const raw = typeof r.raw_measure === 'string' ? r.raw_measure : '';
    return [
      {
        name,
        foodId: str(r.food_id),
        grams: num(r.grams),
        measure: {
          quantityMin: status === 'parsed' ? num(r.quantity_min) : null,
          quantityMax: status === 'parsed' ? (num(r.quantity_max) ?? num(r.quantity_min)) : null,
          unit: str(r.unit),
          note: str(r.note),
          status: status === 'parsed' && num(r.quantity_min) === null ? 'unparsed' : status,
          raw,
        },
      },
    ];
  });
}
