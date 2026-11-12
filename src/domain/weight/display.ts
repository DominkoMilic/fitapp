/**
 * Weights as the user sees them (spec 13.2). Every figure on screen is rounded to 0.1 in the
 * display unit, and a change is the difference of the two *shown* values, so the numbers on a
 * screen always add up (start 107.0 − 7-day avg 106.3 = 0.7, never 0.8 from 107 − 106.25). Pure.
 */
import { roundDecimals } from '@/domain/calculations/rounding';
import { kgToLb, type UnitSystem } from '@/domain/calculations/units';

/** A stored kg value in the display unit, rounded to 0.1 as shown. */
export function shownWeight(kg: number, unit: UnitSystem): number {
  return roundDecimals(unit === 'metric' ? kg : kgToLb(kg), 1);
}

/** `toKg − fromKg` worked out from the rounded values that are on screen, in the display unit. */
export function shownChange(fromKg: number, toKg: number, unit: UnitSystem): number {
  const d = roundDecimals(shownWeight(toKg, unit) - shownWeight(fromKg, unit), 1);
  return d === 0 ? 0 : d; // no "-0.0"
}

/** "106.3", or "+0.4" / "-0.7" with `signed`; "—" for no value. Input is already in the display unit. */
export function formatShown(value: number | null, signed = false): string {
  if (value === null) return '—';
  const v = value === 0 ? 0 : value;
  return `${signed && v > 0 ? '+' : ''}${v.toFixed(1)}`;
}
