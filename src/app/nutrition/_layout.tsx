import { SignedInStack } from '@/features/progress/StackLayout';

export default function NutritionLayout() {
  return (
    <SignedInStack
      titles={{
        add: 'Add food',
        'food/[id]': 'Add food',
        'quick-add': 'Quick add',
        'food-new': 'Your food',
        'item/[id]': 'Edit entry',
        'saved-meals': 'Saved meals',
        'meal-edit': 'Your meal',
        recipes: 'Recipes',
        'recipe/[id]': 'Recipe',
        'recipe-new': 'New recipe',
        'recipe-edit': 'Your recipe',
        planner: 'Meal planner',
        shopping: 'Shopping list',
      }}
    />
  );
}
