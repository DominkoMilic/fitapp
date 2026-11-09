import { readIngredients } from '@/domain/nutrition/recipe-ingredients';
import { recipeNutrition } from '@/domain/nutrition/recipe-nutrition';

describe('stored recipe ingredients', () => {
  it('reads valid rows and survives bad data', () => {
    const rows = readIngredients([
      {
        name: 'soy sauce',
        raw_measure: '3/4 cup',
        quantity_min: 0.75,
        quantity_max: 0.75,
        unit: 'cup',
        parse_status: 'parsed',
      },
      { name: 'salt', raw_measure: 'to taste', parse_status: 'to_taste' },
      { name: 'broken', raw_measure: '2', parse_status: 'parsed' }, // parsed without a number → unparsed
      { raw_measure: 'no name' },
      'junk',
      null,
    ]);
    expect(rows.map((r) => [r.name, r.measure.status, r.measure.quantityMin])).toEqual([
      ['soy sauce', 'parsed', 0.75],
      ['salt', 'to_taste', null],
      ['broken', 'unparsed', null],
    ]);
    expect(readIngredients({ not: 'an array' })).toEqual([]);
  });
});

describe('user recipe nutrition (spec 12.5, N9)', () => {
  const chicken = {
    id: 'c',
    name: 'Chicken breast',
    kcal: 165,
    protein_g: 31,
    carbs_g: 0,
    fat_g: 3.6,
    fibre_g: 0,
  };
  const rice = {
    id: 'r',
    name: 'Rice, cooked',
    kcal: 130,
    protein_g: 2.7,
    carbs_g: 28.2,
    fat_g: 0.3,
    fibre_g: 0.4,
  };
  it('sums foods by grams and divides by servings', () => {
    const n = recipeNutrition(
      [
        { food: chicken, grams: 400 },
        { food: rice, grams: 600 },
      ],
      4,
    );
    expect(n.total.kcal).toBe(1440);
    expect(n.perServing.kcal).toBe(360);
    expect(n.perServing.protein_g).toBeCloseTo(35.1, 1);
    expect(n.partial).toBe(0);
  });
  it('counts ingredients with missing data', () => {
    const n = recipeNutrition([{ food: { ...rice, protein_g: null }, grams: 100 }], 1);
    expect(n.partial).toBe(1);
  });
});
