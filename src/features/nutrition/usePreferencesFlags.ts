import { useMemo } from 'react';

import { type DietType, recipeFlags } from '@/domain/nutrition/diet-flags';
import { usePreferences } from '@/features/profile/api';

/** Diet/allergy flags for a recipe's ingredient names, from the user's preferences. */
export function useRecipeFlagger() {
  const { data: p } = usePreferences();
  return useMemo(() => {
    const prefs = {
      diet: (p?.diet_type ?? 'omnivore') as DietType,
      allergies: p?.allergies ?? [],
      intolerances: p?.intolerances ?? [],
      disliked: p?.disliked_foods ?? [],
    };
    return (names: readonly string[]) => recipeFlags(names, prefs);
  }, [p]);
}
