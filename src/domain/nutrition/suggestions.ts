/**
 * Meal suggestions for a planner slot (spec 12.6). Pure. Only options with reliable nutrition
 * (user recipes, saved meals) are ranked by closeness to the slot's calorie share; options that
 * conflict with allergies, diet or cooking time are excluded.
 */
export interface SuggestionCandidate {
  id: string;
  kind: 'recipe' | 'saved_meal';
  name: string;
  kcalPerServing: number | null;
  proteinPerServing: number | null;
  totalMinutes: number | null;
  excluded: boolean;
}

export interface RankedSuggestion extends SuggestionCandidate {
  score: number;
}

export function rankSuggestions(input: {
  candidates: readonly SuggestionCandidate[];
  slotKcal: number;
  remainingProteinG: number | null;
  maxCookingMinutes: number | null;
  skipIds?: ReadonlySet<string>;
}): RankedSuggestion[] {
  return input.candidates
    .filter((c) => !c.excluded && c.kcalPerServing !== null && !input.skipIds?.has(c.id))
    .filter(
      (c) =>
        input.maxCookingMinutes === null ||
        c.totalMinutes === null ||
        c.totalMinutes <= input.maxCookingMinutes,
    )
    .map((c) => {
      const kcalGap =
        Math.abs((c.kcalPerServing as number) - input.slotKcal) / Math.max(input.slotKcal, 1);
      const proteinBonus =
        input.remainingProteinG && c.proteinPerServing
          ? Math.min(c.proteinPerServing / input.remainingProteinG, 1) * 0.2
          : 0;
      return { ...c, score: Math.round((kcalGap - proteinBonus) * 1000) / 1000 };
    })
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
}
