import { EmptyState } from '@/components/feedback';
import { Screen } from '@/components/ui';
import { useFeatures, useSetNutritionEnabled } from '@/features/profile/features';
import { SignedInStack } from '@/features/progress/StackLayout';

export default function NutritionLayout() {
  const features = useFeatures();
  const set = useSetNutritionEnabled();
  // Old links and notifications can still open nutrition screens after it was switched off.
  if (!features.nutrition)
    return (
      <Screen>
        <EmptyState
          title="Nutrition is turned off"
          message="Food logging, targets and water are hidden. Your history is kept."
          actionLabel={set.isPending ? 'Turning on…' : 'Turn nutrition on'}
          onAction={() => set.mutate(true)}
        />
      </Screen>
    );
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
