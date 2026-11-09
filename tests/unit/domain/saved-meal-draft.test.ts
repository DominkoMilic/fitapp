import { shoppingSources } from '@/domain/nutrition/plan-shopping';
import {
  itemsFromLog,
  mealDraftSchema,
  mealItemToJson,
  mealTotals,
  readMealItems,
  recipeMealItem,
  scaleMealItem,
} from '@/domain/nutrition/saved-meal-draft';
import { buildShoppingList } from '@/domain/nutrition/shopping';

const oats = {
  kind: 'food' as const,
  name: 'Oats',
  foodId: 'f-oats',
  recipeId: null,
  quantity: null,
  unit: 'g',
  grams: 60,
  nutrition: { kcal: 228, protein_g: 8, carbs_g: 40, fat_g: 4, fibre_g: 6 },
  confidence: 'reference',
};
const stew = {
  id: 'r-stew',
  name: 'Grandma’s stew',
  nutritional_confidence: 'user_estimate',
  kcal_per_serving: 520,
  protein_per_serving: 42,
  carbs_per_serving: null,
  fat_per_serving: '20',
  fibre_per_serving: null,
};

describe('meal items', () => {
  it('reads old rows (no kind) and new rows', () => {
    const items = readMealItems([
      { name: 'Banana', food_id: 'f-banana', grams: 120, kcal: 107 },
      { name: 'Coffee', kcal: 30 },
      {
        kind: 'recipe',
        name: 'Stew',
        recipe_id: 'r1',
        quantity: 2,
        unit: 'serving',
        kcal: 1040,
        confidence: 'user_estimate',
      },
      { name: '' },
      'junk',
    ]);
    expect(items.map((i) => [i.kind, i.name, i.confidence])).toEqual([
      ['food', 'Banana', 'calculated'],
      ['quick', 'Coffee', 'user'],
      ['recipe', 'Stew', 'user_estimate'],
    ]);
  });
  it('round-trips through the stored shape', () => {
    expect(readMealItems([mealItemToJson(oats)])).toEqual([oats]);
  });
  it('scaling an amount scales grams and nutrition, keeping missing values missing', () => {
    expect(scaleMealItem(oats, 90)).toMatchObject({
      grams: 90,
      nutrition: { kcal: 342, protein_g: 12, carbs_g: 60, fat_g: 6, fibre_g: 9 },
    });
    const s = recipeMealItem(stew, 1.5);
    expect(s).toMatchObject({ quantity: 1.5, unit: 'serving', confidence: 'user_estimate' });
    expect(s.nutrition).toEqual({
      kcal: 780,
      protein_g: 63,
      carbs_g: null,
      fat_g: 30,
      fibre_g: null,
    });
    expect(scaleMealItem(s, 0.5).nutrition.kcal).toBe(260);
  });
  it('totals report items with incomplete nutrition', () => {
    const t = mealTotals([oats, recipeMealItem(stew, 1)]);
    expect(t.kcal).toBe(748);
    expect(t.partialItems).toBe(1);
  });
  it('builds items from what was logged', () => {
    const [i] = itemsFromLog([
      {
        name_snapshot: 'Skyr',
        food_id: 'f1',
        recipe_id: null,
        quantity: null,
        unit: 'g',
        grams: '150',
        kcal: '95',
        protein_g: '16.5',
        carbs_g: null,
        fat_g: null,
        fibre_g: null,
        confidence_snapshot: 'user',
      },
    ]);
    expect(i).toMatchObject({ kind: 'food', grams: 150, nutrition: { kcal: 95, protein_g: 16.5 } });
  });
  it('validates name and items', () => {
    const msg = (d: unknown) => mealDraftSchema.safeParse(d).error?.issues[0]?.message;
    expect(msg({ name: '', mealType: null, items: [oats] })).toBe('Enter a name');
    expect(msg({ name: 'Breakfast', mealType: 'breakfast', items: [] })).toBe(
      'Add at least one item',
    );
    expect(
      mealDraftSchema.safeParse({ name: 'Breakfast', mealType: null, items: [oats] }).success,
    ).toBe(true);
  });
});

describe('shopping list for a meal with a recipe in it', () => {
  it('expands the recipe’s ingredients, scaled by the servings in the meal × planned servings', () => {
    const recipe = {
      id: 'r-stew',
      name: 'Stew',
      servings_stated: 4,
      ingredients: [
        {
          name: 'beef',
          raw_measure: '800 g',
          quantity_min: 800,
          unit: 'g',
          parse_status: 'parsed',
        },
        { name: 'salt', raw_measure: 'to taste', parse_status: 'to_taste' },
      ],
    };
    const meal = {
      name: 'Sunday lunch',
      items: [
        mealItemToJson(recipeMealItem({ ...stew, id: 'r-stew' }, 2)),
        mealItemToJson({ ...oats, name: 'Bread', grams: 100 }),
        { kind: 'quick', name: 'Wine', kcal: 120 },
      ],
    };
    const { sources } = shoppingSources({
      entries: [{ status: 'planned', servings: 1, recipe_id: null, saved_meal_id: 'm1' }],
      recipes: new Map([['r-stew', recipe]]),
      saved: new Map(),
      savedMeals: new Map([['m1', meal]]),
    });
    const lines = buildShoppingList(sources);
    // 2 servings of a 4-serving stew → half the beef.
    expect(lines.find((l) => l.name === 'beef')).toMatchObject({ quantityMin: 400, unit: 'g' });
    expect(lines.find((l) => l.name === 'bread')).toMatchObject({ quantityMin: 100, unit: 'g' });
    expect(lines.find((l) => l.name === 'wine')).toBeDefined();
    expect(lines.find((l) => l.name === 'salt')?.rawText).toBe('to taste (Stew)');
  });
});
