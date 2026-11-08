import { roundDecimals } from './rounding';

/** Exact conversion constants (spec 8.12). */
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const M_PER_MI = 1609.344;
export const ML_PER_FL_OZ = 29.5735;

export type UnitSystem = 'metric' | 'imperial';

export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;

export const feetInchesToCm = (feet: number, inches: number): number =>
  (feet * 12 + inches) * CM_PER_IN;

/** Converts cm to whole feet + inches rounded to 0.1 in, carrying 12 in into feet. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = roundDecimals(cm / CM_PER_IN, 1);
  let feet = Math.floor(totalInches / 12);
  let inches = roundDecimals(totalInches - feet * 12, 1);
  if (inches >= 12) {
    feet += 1;
    inches = roundDecimals(inches - 12, 1);
  }
  return { feet, inches };
}

/** Storage precision: weight 2 decimals (kg), lengths 1 decimal (cm). */
export const toStoredKg = (kg: number): number => roundDecimals(kg, 2);
export const toStoredCm = (cm: number): number => roundDecimals(cm, 1);

/**
 * Parses user-typed decimals, accepting a comma or a dot ("108,5" → 108.5).
 * Returns null for anything that is not a plain finite number.
 */
export function parseDecimal(input: string): number | null {
  const normalised = input.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalised) && !/^-?\.\d+$/.test(normalised)) return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

export function formatWeight(kg: number, system: UnitSystem): string {
  return system === 'metric'
    ? `${roundDecimals(kg, 1).toFixed(1)} kg`
    : `${roundDecimals(kgToLb(kg), 1).toFixed(1)} lb`;
}

export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === 'metric') return `${Math.round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet} ft ${Number.isInteger(inches) ? inches : inches.toFixed(1)} in`;
}
