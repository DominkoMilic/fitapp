# Nutrition archive

Nutrition (food logging, calorie and macro targets, water, recipes from TheMealDB and your own, meal planner, shopping list, the 2-week calorie review and meal/water reminders) was removed from PACE on 2026-11-18 to keep the app focused on training. This branch, `archive/nutrition` (tag `nutrition-archive-2026-11`), is the last full app **with** nutrition, including social Phase 8A.

## Bringing it back

1. Start a branch from `master` and bring the code back from here: `git checkout archive/nutrition -- <paths>` for the nutrition areas (`src/app/nutrition`, `src/features/nutrition`, `src/domain/nutrition`, `src/integrations/recipes`, `src/domain/calculations/{targets,plan}.ts`, the coach recalibration, `supabase/functions/recipes-proxy`, tests), or revert the removal commit on `master` and resolve conflicts.
2. The database tables were **dropped** (`20261118000100_remove_nutrition.sql` on `master`). Add one new migration that recreates them. Its body is these old migrations, concatenated in order (they stay in history and can't be re-run under their own versions):
   - `20261111000100_nutrition.sql`
   - `20261111000200_usda_foods_seed.sql` (food catalogue; or regenerate with `npm run db:seed-usda`)
   - `20261111000300_food_search.sql`, `20261112000100_food_search_ranking.sql`
   - `20261114000200_recipe_images.sql`, `20261115000300_own_recipes.sql`
   - `20261116000100_nutrition_toggle.sql`
   - and the targets parts of `complete_onboarding` / `server_side_safety` (floor guard, `accept_target_adjustment`).
   Check the exact file list with `ls supabase/migrations` on this branch.
3. Redeploy the `recipes-proxy` Edge Function (with `verify_jwt = false`, and `THEMEALDB_API_KEY` if used) and recreate the `recipe-images` storage bucket (the migration above does the policies).
4. Restore the spec sections from this branch's `docs/PACE_SPEC.md` (§6.5, §7 food step, §8.2–8.9, §12, §15 nutrition rules, §16, §17, §20.6, §21.2, §22.2–22.3, §25, §26 Phase 4, §28.7, §29.5).
