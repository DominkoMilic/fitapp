import { recipeFlags } from '@/domain/nutrition/diet-flags';
import {
  formatAmount,
  formatQuantity,
  parseMeasure,
  scaleMeasure,
} from '@/domain/nutrition/measure-parser';
import { buildShoppingList, normaliseIngredient } from '@/domain/nutrition/shopping';
import { rankSuggestions } from '@/domain/nutrition/suggestions';
import {
  checkGrams,
  mealTypeForTime,
  nutritionForGrams,
  perServing,
  slotShare,
  sumNutrition,
  waterNeedsConfirm,
} from '@/domain/nutrition/totals';
import {
  normalizeMeal,
  normalizeMealList,
  normalizeSummary,
  splitInstructions,
} from '@/integrations/recipes/recipe-normalizer';

describe('nutrition vectors (spec 29.5)', () => {
  it('N1 150 g of 165/31/0/3.6 per 100 g', () => {
    expect(
      nutritionForGrams({ kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fibre_g: null }, 150),
    ).toEqual({
      kcal: 247.5,
      protein_g: 46.5,
      carbs_g: 0,
      fat_g: 5.4,
      fibre_g: null,
    });
  });
  it.each([
    ['N2', '1 1/2 cups', 1.5, 1.5, 'cup'],
    ['N3', '175g', 175, 175, 'g'],
    ['range', '2-3 cloves', 2, 3, 'clove'],
    ['unicode', '½ tsp', 0.5, 0.5, 'tsp'],
    ['mixed unicode', '1½ tbsp', 1.5, 1.5, 'tbsp'],
    ['decimal comma', '0,5 l', 0.5, 0.5, 'l'],
    ['capitalised unit', '4 Tablespoons', 4, 4, 'tbsp'],
    ['count with note', '1 (12 oz.)', 1, 1, null],
  ])('%s: %s', (_n, raw, min, max, unit) => {
    expect(parseMeasure(raw)).toMatchObject({
      quantityMin: min,
      quantityMax: max,
      unit,
      status: 'parsed',
    });
  });
  it('N4 "2-3 cloves" ×2 → 4–6 cloves', () => {
    expect(scaleMeasure(parseMeasure('2-3 cloves'), 2).text).toBe('4–6 cloves');
  });
  it('N5 "To taste" ×2 → unchanged', () => {
    const m = parseMeasure('To taste');
    expect(m.status).toBe('to_taste');
    expect(scaleMeasure(m, 2)).toMatchObject({ text: 'To taste', scaled: false });
  });
  it.each(['', 'Garnish', 'a handful', 'dash', 'as required'])(
    '"%s" is not a measurable amount',
    (raw) => {
      expect(parseMeasure(raw).status).toBe('to_taste');
    },
  );
  it('unparseable text is kept verbatim, never invented', () => {
    expect(parseMeasure('Juice of 1 lemon')).toMatchObject({
      status: 'unparsed',
      quantityMin: null,
    });
    expect(scaleMeasure(parseMeasure('Juice of 1 lemon'), 3).text).toBe('Juice of 1 lemon');
  });
  it('N6 400 g chicken, 4 → 2 servings = 200 g', () => {
    expect(scaleMeasure(parseMeasure('400g'), 2 / 4)).toMatchObject({
      quantityMin: 200,
      unit: 'g',
    });
  });
  it('doubling whole counts is exact; halving 3 is approx.', () => {
    expect(scaleMeasure(parseMeasure('2 cloves'), 2).text).toBe('4 cloves');
    expect(scaleMeasure(parseMeasure('3 cloves'), 0.5).text).toBe('1½ cloves (approx.)');
  });
  it('N7 3 eggs, 4 → 1 serving = ¾ (approx.)', () => {
    const s = scaleMeasure(parseMeasure('3'), 1 / 4);
    expect(s.quantityMin).toBe(0.75);
    expect(s.text).toBe('¾ (approx.)');
  });
  it('rounds grams to 5 above 50 g and to 1 below', () => {
    expect(scaleMeasure(parseMeasure('175g'), 1.5).quantityMin).toBe(265); // 262.5 → 265
    expect(scaleMeasure(parseMeasure('30g'), 1.5).quantityMin).toBe(45);
  });
  it('kitchen volumes round to eighths and pluralise; unscaled keeps the source wording', () => {
    expect(scaleMeasure(parseMeasure('3/4 cup'), 0.5).text).toBe('⅜ cup');
    expect(scaleMeasure(parseMeasure('3 cups'), 0.5).text).toBe('1½ cups');
    expect(scaleMeasure(parseMeasure('1/4 cup'), 0.5).text).toBe('⅛ cup');
    expect(scaleMeasure(parseMeasure('3 cups'), 1)).toMatchObject({
      text: '3 cups',
      scaled: false,
    });
    expect(formatAmount(2, 3, 'clove')).toBe('2–3 cloves');
    expect(formatAmount(200, 200, 'g')).toBe('200 g');
  });
  it('volumes are never converted to grams', () => {
    expect(scaleMeasure(parseMeasure('1 cup'), 2)).toMatchObject({ quantityMin: 2, unit: 'cup' });
  });
  it('N8 shopping list: 200 g + 300 g rice merge; 1 cup rice separate', () => {
    const lines = buildShoppingList([
      {
        recipeName: 'A',
        factor: 1,
        ingredients: [{ name: 'Rice', measure: parseMeasure('200g') }],
      },
      {
        recipeName: 'B',
        factor: 1,
        ingredients: [{ name: 'rice', measure: parseMeasure('300 g') }],
      },
      {
        recipeName: 'C',
        factor: 1,
        ingredients: [{ name: 'Rice', measure: parseMeasure('1 cup') }],
      },
    ]);
    expect(lines.map((l) => [l.name, l.quantityMin, l.unit, l.recipes.length])).toEqual([
      ['rice', 500, 'g', 2],
      ['rice', 1, 'cup', 1],
    ]);
  });
  it('shopping list keeps unparsed measures as text lines and applies serving factors', () => {
    const lines = buildShoppingList([
      {
        recipeName: 'Curry',
        factor: 2,
        ingredients: [
          { name: 'Onions', measure: parseMeasure('2') },
          { name: 'Salt', measure: parseMeasure('to taste') },
        ],
      },
    ]);
    expect(lines.find((l) => l.name === 'onion')).toMatchObject({ quantityMin: 4 });
    expect(lines.find((l) => l.name === 'salt')?.rawText).toBe('to taste (Curry)');
    expect(normaliseIngredient('Tomatoes')).toBe('tomato');
    expect(normaliseIngredient('Asparagus')).toBe('asparagus');
  });
  it('N9 user recipe 2000 kcal / 4 servings = 500 kcal', () => {
    expect(
      perServing({ kcal: 2000, protein_g: 120, carbs_g: null, fat_g: 80, fibre_g: null }, 4),
    ).toEqual({
      kcal: 500,
      protein_g: 30,
      carbs_g: null,
      fat_g: 20,
      fibre_g: null,
    });
  });
});

describe('totals (spec 28.7 #1)', () => {
  it('sums items and counts partial ones (missing ≠ zero)', () => {
    const t = sumNutrition([
      { kcal: 126, protein_g: 22, carbs_g: 8, fat_g: 0.4 },
      { kcal: '250', protein_g: null, carbs_g: null, fat_g: null },
    ]);
    expect(t).toMatchObject({ kcal: 376, protein_g: 22, items: 2, partialItems: 1 });
  });
  it('quantity checks', () => {
    expect(checkGrams(0)).toEqual({ ok: false, reason: 'zero' });
    expect(checkGrams(-5)).toEqual({ ok: false, reason: 'negative' });
    expect(checkGrams(6000)).toEqual({ ok: false, reason: 'too_large' });
    expect(checkGrams(2000)).toEqual({ ok: true, confirm: true });
    expect(checkGrams(150)).toEqual({ ok: true, confirm: false });
  });
  it('water confirmation over 2 L at once or 10 L a day (spec 12.8)', () => {
    expect(waterNeedsConfirm(250, 1000)).toBe(false);
    expect(waterNeedsConfirm(2500, 0)).toBe(true);
    expect(waterNeedsConfirm(500, 9800)).toBe(true);
  });
  it('meal by time of day (spec 12.2)', () => {
    expect(mealTypeForTime(8 * 60)).toBe('breakfast');
    expect(mealTypeForTime(10 * 60 + 30)).toBe('lunch');
    expect(mealTypeForTime(16 * 60)).toBe('snack');
    expect(mealTypeForTime(19 * 60)).toBe('dinner');
    expect(mealTypeForTime(23 * 60)).toBe('snack');
  });
  it('slot shares sum to 1', () => {
    for (const n of [2, 3, 4, 5]) {
      const total = (['breakfast', 'lunch', 'dinner', 'snack'] as const).reduce(
        (a, m) => a + slotShare(m, n),
        0,
      );
      expect(total).toBeCloseTo(1, 9);
    }
  });
  it('formats quarters as glyphs', () => {
    expect([0.25, 0.5, 0.75, 1.5, 2, 1.33].map(formatQuantity)).toEqual([
      '¼',
      '½',
      '¾',
      '1½',
      '2',
      '1.33',
    ]);
  });
});

describe('TheMealDB normaliser (spec 12.3, 22.2)', () => {
  const meal = {
    idMeal: '1',
    strMeal: 'Test Chicken Bake ',
    strCategory: 'Chicken',
    strArea: 'British',
    strTags: 'Meat,Bake',
    strInstructions: 'STEP 1\r\nHeat the oven.\r\n\r\nSTEP 2\r\nBake for 20 minutes.',
    strMealThumb: 'https://example.com/a.jpg',
    strYoutube: 'http://insecure.example',
    strSource: null,
    strIngredient1: 'Chicken',
    strMeasure1: '400g',
    strIngredient2: 'Salt',
    strMeasure2: 'To taste',
    strIngredient3: '',
    strMeasure3: ' ',
    strIngredient4: null,
    strMeasure4: null,
  };
  it('maps fields, drops empty ingredients and never invents servings or nutrition', () => {
    const r = normalizeMeal(meal)!;
    expect(r).toMatchObject({
      externalId: '1',
      name: 'Test Chicken Bake',
      cuisine: 'British',
      tags: ['Meat', 'Bake'],
      servingsStated: null,
      videoUrl: null,
    });
    expect(r.ingredients.map((i) => [i.name, i.measure.status])).toEqual([
      ['Chicken', 'parsed'],
      ['Salt', 'to_taste'],
    ]);
    expect(r.instructions).toEqual(['Heat the oven.', 'Bake for 20 minutes.']);
    expect(r).not.toHaveProperty('kcal');
  });
  it('"meals: null" is an empty result, not an error; invalid items are dropped and counted', () => {
    expect(normalizeMealList({ meals: null }, normalizeSummary)).toEqual({ items: [], dropped: 0 });
    expect(
      normalizeMealList(
        { meals: [{ idMeal: '2', strMeal: 'Soup', strMealThumb: null }, { nope: true }] },
        normalizeSummary,
      ),
    ).toEqual({
      items: [{ externalId: '2', name: 'Soup', imageUrl: null }],
      dropped: 1,
    });
    expect(normalizeMeal({ strMeal: 'no id' })).toBeNull();
  });
  it('splits instructions on lines', () =>
    expect(splitInstructions('Mix.\nBake.')).toEqual(['Mix.', 'Bake.']));
});

describe('diet and allergy flags', () => {
  const prefs = {
    diet: 'omnivore' as const,
    allergies: [] as string[],
    intolerances: [] as string[],
    disliked: [] as string[],
  };
  it('flags meat for vegetarians and allergens by keyword', () => {
    expect(recipeFlags(['Beef mince', 'Onion'], { ...prefs, diet: 'vegetarian' })).toMatchObject({
      dietWarnings: ['Contains meat'],
      exclude: true,
    });
    expect(
      recipeFlags(['Plain flour', 'Butter'], { ...prefs, allergies: ['wheat/gluten'] }),
    ).toMatchObject({ matches: ['wheat/gluten'], exclude: true });
    expect(recipeFlags(['Salmon'], { ...prefs, diet: 'pescatarian' }).exclude).toBe(false);
  });
  it('disliked foods are shown but do not hide a recipe', () => {
    expect(recipeFlags(['Mushrooms'], { ...prefs, disliked: ['mushroom'] })).toMatchObject({
      matches: ['mushroom'],
      exclude: false,
    });
  });
});

describe('meal suggestions (spec 12.6)', () => {
  it('ranks by closeness to the slot and skips excluded or slow options', () => {
    const r = rankSuggestions({
      slotKcal: 800,
      remainingProteinG: null,
      maxCookingMinutes: 30,
      candidates: [
        {
          id: 'a',
          kind: 'recipe',
          name: 'A',
          kcalPerServing: 600,
          proteinPerServing: 40,
          totalMinutes: 20,
          excluded: false,
        },
        {
          id: 'b',
          kind: 'recipe',
          name: 'B',
          kcalPerServing: 820,
          proteinPerServing: 40,
          totalMinutes: 25,
          excluded: false,
        },
        {
          id: 'c',
          kind: 'recipe',
          name: 'C',
          kcalPerServing: 800,
          proteinPerServing: 40,
          totalMinutes: 90,
          excluded: false,
        },
        {
          id: 'd',
          kind: 'recipe',
          name: 'D',
          kcalPerServing: 800,
          proteinPerServing: 40,
          totalMinutes: 10,
          excluded: true,
        },
        {
          id: 'e',
          kind: 'saved_meal',
          name: 'E',
          kcalPerServing: null,
          proteinPerServing: null,
          totalMinutes: null,
          excluded: false,
        },
      ],
    });
    expect(r.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
