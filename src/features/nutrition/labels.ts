/** "150 g", "3 × 1 large", "1 serving": how a logged amount reads in the diary. */
export function loggedAmount(quantity: number | string | null, unit: string | null): string | null {
  if (quantity === null || !unit) return null;
  const q = Number(quantity);
  if (unit === 'g' || unit === 'ml') return `${q} ${unit}`;
  if (unit === 'serving' || unit === 'servings') return `${q} ${q === 1 ? 'serving' : 'servings'}`;
  return q === 1 ? unit : `${q} × ${unit}`;
}
