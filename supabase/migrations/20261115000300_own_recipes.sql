-- Your own recipes: a user can type in nutrition per serving for their own recipe ("Your estimate").
-- TheMealDB rows still can never carry nutrition (recipes_no_invented_nutrition is unchanged).
alter table public.recipes drop constraint recipes_nutritional_confidence_check;
alter table public.recipes add constraint recipes_nutritional_confidence_check
  check (nutritional_confidence in ('none', 'calculated', 'user_estimate'));
