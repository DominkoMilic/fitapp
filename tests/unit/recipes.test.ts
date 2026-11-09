import { shoppingSources } from '@/domain/nutrition/plan-shopping';
import { buildShoppingList } from '@/domain/nutrition/shopping';
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

describe('plan → shopping sources (spec 12.7, 28.7 #14)', () => {
  const ing = (name: string, raw: string, q: number | null, unit: string | null) => ({
    name,
    raw_measure: raw,
    quantity_min: q,
    quantity_max: q,
    unit,
    parse_status: q === null ? 'to_taste' : 'parsed',
  });
  const recipes = new Map([
    [
      'r1',
      {
        id: 'r1',
        name: 'Curry',
        servings_stated: null,
        ingredients: [ing('Rice', '200g', 200, 'g'), ing('Salt', 'to taste', null, null)],
      },
    ],
    [
      'r2',
      { id: 'r2', name: 'Bowl', servings_stated: 2, ingredients: [ing('rice', '100 g', 100, 'g')] },
    ],
  ]);
  it('scales by planned servings ÷ base, merges same name + unit, flags unknown bases, skips skipped', () => {
    const { sources, unscaled } = shoppingSources({
      entries: [
        { status: 'planned', servings: 2, recipe_id: 'r1', saved_meal_id: null },
        { status: 'planned', servings: 4, recipe_id: 'r2', saved_meal_id: null },
        { status: 'skipped', servings: 4, recipe_id: 'r2', saved_meal_id: null },
        { status: 'planned', servings: 1, recipe_id: null, saved_meal_id: 'm1' },
      ],
      recipes,
      saved: new Map([['r1', { base_servings: 4 }]]),
      savedMeals: new Map([['m1', { name: 'Oats', items: [{ name: 'Rice', grams: 50 }] }]]),
    });
    expect(unscaled).toEqual([]);
    const lines = buildShoppingList(sources);
    // Curry base 4 → 2 servings: 100 g; Bowl base 2 → 4: 200 g; saved meal 50 g → 350 g rice
    expect(lines.find((l) => l.name === 'rice')).toMatchObject({
      quantityMin: 350,
      unit: 'g',
      recipes: ['Curry', 'Bowl', 'Oats'],
    });
    expect(lines.find((l) => l.name === 'salt')?.rawText).toBe('to taste (Curry)');
  });
  it('without a known base the whole recipe is listed and named', () => {
    const { unscaled } = shoppingSources({
      entries: [{ status: 'planned', servings: 2, recipe_id: 'r1', saved_meal_id: null }],
      recipes,
      saved: new Map(),
      savedMeals: new Map(),
    });
    expect(unscaled).toEqual(['Curry']);
  });
});
