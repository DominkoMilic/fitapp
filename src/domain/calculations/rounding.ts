export const roundTo = (value: number, step: number): number => Math.round(value / step) * step;
export const roundTo10 = (value: number): number => roundTo(value, 10);
export const roundTo50 = (value: number): number => roundTo(value, 50);
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
/** Rounds to a fixed number of decimals without floating-point artefacts (e.g. 1.005 → 1.01). */
export const roundDecimals = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
};
