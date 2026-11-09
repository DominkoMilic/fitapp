/**
 * Keyword-based dietary flags for recipes (spec 12.3). Deliberately conservative and labelled
 * "check ingredients yourself": keyword matching can never guarantee a dish is safe.
 */
const MEAT = [
  'beef',
  'pork',
  'chicken',
  'lamb',
  'mutton',
  'bacon',
  'ham',
  'sausage',
  'turkey',
  'duck',
  'veal',
  'chorizo',
  'salami',
  'pancetta',
  'prosciutto',
  'goat',
  'venison',
  'mince',
  'steak',
  'gelatin',
  'lard',
];
const FISH = [
  'fish',
  'salmon',
  'tuna',
  'cod',
  'haddock',
  'prawn',
  'shrimp',
  'anchov',
  'sardine',
  'mackerel',
  'crab',
  'lobster',
  'mussel',
  'clam',
  'oyster',
  'squid',
  'scallop',
  'trout',
  'fish sauce',
];
const ANIMAL = [
  'egg',
  'milk',
  'butter',
  'cheese',
  'cream',
  'yogurt',
  'yoghurt',
  'honey',
  'ghee',
  'parmesan',
  'mozzarella',
  'feta',
  'buttermilk',
  'mayonnaise',
];

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  peanut: ['peanut'],
  'tree nuts': [
    'almond',
    'walnut',
    'cashew',
    'pecan',
    'hazelnut',
    'pistachio',
    'macadamia',
    'pine nut',
  ],
  milk: [
    'milk',
    'butter',
    'cheese',
    'cream',
    'yogurt',
    'yoghurt',
    'ghee',
    'parmesan',
    'mozzarella',
    'feta',
  ],
  egg: ['egg', 'mayonnaise'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'anchov', 'sardine', 'mackerel', 'trout'],
  shellfish: ['prawn', 'shrimp', 'crab', 'lobster', 'mussel', 'clam', 'oyster', 'scallop', 'squid'],
  soy: ['soy', 'tofu', 'edamame', 'miso', 'tempeh'],
  'wheat/gluten': [
    'flour',
    'bread',
    'pasta',
    'spaghetti',
    'noodle',
    'wheat',
    'couscous',
    'breadcrumb',
    'barley',
    'rye',
    'semolina',
  ],
  sesame: ['sesame', 'tahini'],
};

const has = (names: string[], words: string[]) =>
  names.some((n) => words.some((w) => n.includes(w)));

export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'other';

export interface RecipeFlags {
  /** Diet conflicts, e.g. "Contains meat". */
  dietWarnings: string[];
  /** Allergies or disliked foods found in the ingredients. */
  matches: string[];
  /** Hide from suggestions when true (allergy or diet conflict). */
  exclude: boolean;
}

export function recipeFlags(
  ingredientNames: readonly string[],
  prefs: {
    diet: DietType;
    allergies: readonly string[];
    intolerances: readonly string[];
    disliked: readonly string[];
  },
): RecipeFlags {
  const names = ingredientNames.map((n) => n.toLowerCase());
  const dietWarnings: string[] = [];
  const meat = has(names, MEAT);
  const fish = has(names, FISH);
  if (
    (prefs.diet === 'vegetarian' || prefs.diet === 'vegan' || prefs.diet === 'pescatarian') &&
    meat
  )
    dietWarnings.push('Contains meat');
  if ((prefs.diet === 'vegetarian' || prefs.diet === 'vegan') && fish)
    dietWarnings.push('Contains fish or seafood');
  if (prefs.diet === 'vegan' && has(names, ANIMAL)) dietWarnings.push('Contains animal products');

  const matches: string[] = [];
  for (const a of [...prefs.allergies, ...prefs.intolerances]) {
    const key = a.toLowerCase();
    const words = ALLERGEN_KEYWORDS[key] ?? [key];
    if (has(names, words)) matches.push(a);
  }
  const allergyHits = matches.length;
  for (const d of prefs.disliked) if (has(names, [d.toLowerCase()])) matches.push(d);
  return { dietWarnings, matches, exclude: allergyHits > 0 || dietWarnings.length > 0 };
}
