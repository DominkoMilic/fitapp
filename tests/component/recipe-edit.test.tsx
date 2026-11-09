import { fireEvent, screen } from '@testing-library/react-native';

import RecipeEditScreen from '@/app/nutrition/recipe-edit';
import type { RecipeDraft } from '@/domain/nutrition/recipe-draft';

import { renderWithTheme } from '../setup/render';

const mockSaveRecipe = jest.fn((_d: RecipeDraft) => Promise.resolve('new-id'));
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/features/nutrition/recipes-api', () => ({
  useFoodNutrition: () => ({ data: undefined }),
  useMyRecipes: () => ({ rows: [], serverKeys: new Set() }),
  useRecipe: () => ({ recipe: null, isPending: false, isError: false }),
  useRecipeActions: () => ({ saveRecipe: (d: RecipeDraft) => mockSaveRecipe(d) }),
}));
jest.mock('@/features/nutrition/api', () => ({
  useFoodSearch: () => ({ data: [], isError: false, isPending: false }),
  useCustomFoods: () => ({ rows: [] }),
}));
jest.mock('@/integrations/recipes/themealdb.provider', () => ({
  recipeErrorMessage: () => 'error',
}));

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const type = async (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

async function addTextIngredient(name: string, amount: string) {
  await press('Type an ingredient');
  await type('Ingredient', name);
  await type('Amount (optional)', amount);
  await press('Done');
}

it('builds a recipe from typed ingredients with an own estimate', async () => {
  await renderWithTheme(<RecipeEditScreen />);
  await type('Recipe name', 'Grandma’s stew');

  await press('Type an ingredient');
  await type('Ingredient', 'flour');
  await type('Amount (optional)', '2 cups');
  expect(screen.getByText(/Understood as 2 cups/)).toBeTruthy();
  await press('Done');
  await addTextIngredient('salt', 'to taste');
  await addTextIngredient('pepper', '');

  // Reorder and remove with the accessible row buttons.
  await press('Move salt up');
  await press('Remove pepper');
  expect(screen.queryByText('pepper')).toBeNull();
  expect(screen.getByText('No nutrition yet')).toBeTruthy();

  // An estimate needs calories before it can be saved.
  await fireEvent.press(screen.getByRole('radio', { name: 'My own estimate' }));
  await press('Save recipe');
  expect(screen.getByText('Enter the calories per serving for your estimate')).toBeTruthy();
  expect(mockSaveRecipe).not.toHaveBeenCalled();

  await type('Calories', '450');
  await press('Save recipe');
  expect(mockSaveRecipe).toHaveBeenCalledTimes(1);
  const saved = mockSaveRecipe.mock.calls[0]![0];
  expect(saved.name).toBe('Grandma’s stew');
  expect(saved.ingredients.map((i) => i.name)).toEqual(['salt', 'flour']);
  expect(saved.nutritionMode).toBe('estimate');
  expect(saved.estimate.kcal).toBe(450);
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/nutrition/recipe/[id]',
    params: { id: 'new-id' },
  });
});
