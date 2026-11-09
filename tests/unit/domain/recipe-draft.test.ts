import {
  draftToRow,
  duplicateRecipe,
  emptyDraft,
  moveItem,
  nutritionForDraft,
  nutritionNote,
  type RecipeDraft,
  recipeDraftSchema,
  rowToDraft,
} from '@/domain/nutrition/recipe-draft';
import { readIngredients } from '@/domain/nutrition/recipe-ingredients';

const rice = { kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fibre_g: 0.4 };
const chicken = { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fibre_g: 0 };

const draft = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
  ...emptyDraft(),
  name: 'Chicken rice',
  servings: 2,
  ingredients: [
    { kind: 'food', foodId: 'f-chicken', name: 'Chicken breast', grams: 300, per100: chicken },
    { kind: 'food', foodId: 'f-rice', name: 'Rice, cooked', grams: 400, per100: rice },
    { kind: 'text', name: 'soy sauce', amount: '2 tbsp' },
    { kind: 'text', name: 'salt', amount: 'to taste' },
  ],
  steps: ['Cook the rice.', 'Fry the chicken.'],
  ...over,
});

describe('recipe draft nutrition', () => {
  it('calculates per serving from food rows and reports coverage', () => {
    const n = nutritionForDraft(draft());
    // (300 g chicken = 495 kcal) + (400 g rice = 520 kcal) = 1015 / 2 servings
    expect(n.perServing?.kcal).toBeCloseTo(507.5, 1);
    expect(n.perServing?.protein_g).toBeCloseTo(51.9, 1);
    expect([n.covered, n.total]).toEqual([2, 4]);
    expect(nutritionNote(n)).toMatch(/2 of 4 ingredients/);
  });
  it('has no nutrition when nothing is a food (never invented)', () => {
    const n = nutritionForDraft(
      draft({ ingredients: [{ kind: 'text', name: 'stew', amount: '' }] }),
    );
    expect(n.perServing).toBeNull();
    expect(nutritionNote(n)).toBeNull();
  });
  it('uses the typed estimate in estimate mode', () => {
    const n = nutritionForDraft(
      draft({
        nutritionMode: 'estimate',
        estimate: { kcal: 600, protein_g: 40, carbs_g: null, fat_g: null, fibre_g: null },
      }),
    );
    expect(n.perServing).toMatchObject({ kcal: 600, protein_g: 40, carbs_g: null });
    expect(nutritionNote(n)).toBe('Your estimate');
  });
});

describe('recipe draft validation', () => {
  it('accepts a complete draft', () => {
    expect(recipeDraftSchema.safeParse(draft()).success).toBe(true);
  });
  it('requires a name, an ingredient, valid servings and an https link', () => {
    const issues = (d: RecipeDraft) =>
      (recipeDraftSchema.safeParse(d).error?.issues ?? []).map((i) => i.message);
    expect(issues(draft({ name: ' ' }))).toContain('Enter a name');
    expect(issues(draft({ ingredients: [] }))).toContain('Add at least one ingredient');
    expect(issues(draft({ servings: 0 }))).toContain('Servings must be 1–50');
    expect(issues(draft({ sourceUrl: 'http://example.com/x' }))).toContain(
      'Links must start with https://',
    );
  });
  it('an estimate needs calories', () => {
    const r = recipeDraftSchema.safeParse(draft({ nutritionMode: 'estimate' }));
    expect(r.error?.issues[0]?.message).toBe('Enter the calories per serving for your estimate');
  });
});

describe('stored rows', () => {
  it('round-trips through the database shape', () => {
    const d = draft({
      description: 'Quick dinner',
      tags: ['easy'],
      prepMinutes: 10,
      cookMinutes: 20,
      sourceUrl: 'https://example.com/r',
    });
    const row = draftToRow(d, 'r1');
    expect(row).toMatchObject({
      source: 'user',
      nutritional_confidence: 'calculated',
      kcal_per_serving: 507.5,
      servings_stated: 2,
    });
    const back = rowToDraft({ ...row, description: row.description });
    expect(back).toEqual(d);
  });
  it('free-text amounts are parsed so they scale and reach the shopping list', () => {
    const row = draftToRow(draft(), 'r1');
    const [, , soy, salt] = readIngredients(row.ingredients);
    expect(soy?.measure).toMatchObject({ quantityMin: 2, unit: 'tbsp', status: 'parsed' });
    expect(salt?.measure.status).toBe('to_taste');
  });
  it('stores an estimate as user_estimate and no nutrition as none', () => {
    const est = draftToRow(
      draft({
        nutritionMode: 'estimate',
        estimate: { kcal: 600, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null },
      }),
      'r',
    );
    expect(est).toMatchObject({ nutritional_confidence: 'user_estimate', kcal_per_serving: 600 });
    const none = draftToRow(
      draft({ ingredients: [{ kind: 'text', name: 'stew', amount: '1 pot' }] }),
      'r',
    );
    expect(none).toMatchObject({ nutritional_confidence: 'none', kcal_per_serving: null });
  });
});

describe('duplicate', () => {
  const mealdb = {
    name: 'Teriyaki Chicken',
    description: null,
    source: 'themealdb',
    tags: ['Meat'],
    instructions: ['Mix the sauce.', 'Cook.'],
    ingredients: [
      {
        name: 'soy sauce',
        raw_measure: '3/4 cup',
        quantity_min: 0.75,
        unit: 'cup',
        parse_status: 'parsed',
      },
      { name: 'chicken', raw_measure: '2 lb', quantity_min: 2, unit: 'lb', parse_status: 'parsed' },
    ],
    preparation_minutes: null,
    cooking_minutes: null,
    servings_stated: null,
    source_url: 'https://example.com/teriyaki',
    nutritional_confidence: 'none',
    kcal_per_serving: null,
    protein_per_serving: null,
    carbs_per_serving: null,
    fat_per_serving: null,
    fibre_per_serving: null,
  };
  it('a TheMealDB copy keeps text ingredients, method and link, with no nutrition', () => {
    const d = duplicateRecipe(mealdb);
    expect(d.name).toBe('Teriyaki Chicken');
    expect(d.ingredients).toEqual([
      { kind: 'text', name: 'soy sauce', amount: '3/4 cup' },
      { kind: 'text', name: 'chicken', amount: '2 lb' },
    ]);
    expect(d.sourceUrl).toBe('https://example.com/teriyaki');
    expect(nutritionForDraft(d).perServing).toBeNull();
  });
  it('a copy of your own recipe is marked as a copy', () => {
    const row = draftToRow(draft(), 'r1');
    expect(duplicateRecipe(row).name).toBe('Chicken rice (copy)');
  });
});

it('moves list items up and down', () => {
  expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
  expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
});
