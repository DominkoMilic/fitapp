# Report: any sport, your own recipes and meals

Date: 2026-11-09 · Spec sections: 1.4, 7, 9.1, 10, 12.2, 12.5, 12.7, 15 (S3), 20, 25 · Plan: all-sport support plus your own recipes and meals

## 1. Summary

PACE is no longer football-only. People can play any of 17 sports, several at once, or none. Users can also type in their own recipes and meals, with their own nutrition numbers if they want.

| Area | Delivered |
|---|---|
| Sports catalogue | 17 sports with their own words ("Basketball game", "Martial arts class", "Swimming race"), METs, the body areas each loads, and a drill pack. Events are stored as `<sport>_match` / `<sport>_practice`, so existing futsal rows are unchanged |
| Onboarding and settings | "Your sports" picker (or "I don't play a sport"). Commitments pick a sport plus game/practice, or a run, walk, ride or workout. **Settings → Your sports** edits the sports and lists, adds and edits weekly games and fixed activities (this was impossible after onboarding before). Adding, editing or ending one regenerates the plan |
| Plan and safety | Game-day rest/recovery for every sport. Injury checks per sport (an ankle blocks basketball, not swimming). Coach, reminders and notes use the sport's own words. No-sport users see no sport wording |
| Drill packs | 31 new drills, 11 packs, no contact or sparring. One weekly "<Sport> skills" session when safe. Every pack still works with no equipment; an active ankle injury removes every jumping, sprinting and cutting drill. Library filter "Only drills for my sports" |
| Your recipes | Editor for create/edit/duplicate: foods with grams or typed ingredients ("2 cups flour", "salt to taste") that scale. Nutrition calculated ("from 3 of 5 ingredients") or "Your estimate". "Make it my own" for TheMealDB recipes. Log ¼-servings to any meal today or the two days before. Confirm before removing |
| Your foods | Edit and remove your own foods; logged entries keep their numbers |
| Your meals | Build a meal from scratch from foods, your recipes and quick items. Edit, duplicate, remove. "Save as a meal" opens the editor pre-filled. "Log it" can log only the items you actually had |
| Planner and shopping | Recipe items keep their recipe and estimate label when logged. A recipe inside a planned meal expands into its ingredients, scaled |

## 2. Branches

`feature/sports-catalogue` → `feature/sports-ui` → `feature/sport-drills` → `feature/own-recipes` → `feature/own-meals` → `docs/sports-recipes`, each branched from the previous one.

## 3. Database

| Migration | What it does |
|---|---|
| `20261115000100_all_sports.sql` | `user_preferences.sports`; any `<sport>_match/practice` event category; focus tag `futsal` → `sport` (with a trigger so older app versions keep working); `ball`, `racket`, `stick` equipment; `sport_skills` exercise category and `exercises.sports`; onboarding saves the sports. Backfills sports for existing futsal users from their events (else football) |
| `20261115000200_training_seed_sports.sql` | Generated seed: 87 exercises and 20 templates (the original seed migration is unchanged) |
| `20261115000300_own_recipes.sql` | `nutritional_confidence` allows `user_estimate` (own recipes only) |

**Not yet applied to the hosted project.** These need applying through the SQL editor, the same way as before.

## 4. Commands run and actual results

| Check | Result |
|---|---|
| `npm run check` | ✓ 459 passed, 1 skipped (typecheck, lint with 0 warnings, seed and shared-code checks) |
| `npx supabase test db` | ✓ 239/239 (new: `90_sports` 14, `91_own_recipes` 7) |
| `npx supabase db reset` | ✓ all migrations apply from scratch |
| Browser, local stack | ✓ basketball + tennis player: sports picker, game/practice forms, adding a Tuesday tennis practice reshapes the week, "Basketball skills" session built from the user's ball and band, library filter. ✓ Recipe with a food + typed ingredient (180 kcal, "1 of 2 ingredients"), edited to an estimate (520 kcal), logged 1.5 servings (780 kcal, `user_estimate`, carbs left empty instead of 0), duplicated. ✓ Food edited and removed. ✓ Meal built from a recipe (2 servings) + quick item, logged only the stew, planned it: shopping list shows 300 g chicken and ¾ kg potatoes (half the 4-serving recipe). No console errors |

## 5. Bugs found and fixed while testing

- The football pack had only one exercise left without a ball → bodyweight alternatives.
- Recipe detail showed missing macros as "0 g" → now "—".
- Shopping empty state said "2 planned meal(s)" for one meal → counts planned meals.
- Jest worker crashes on Node 24 (about 1 run in 6) → worker threads.

## 6. Not verified / still needs you

- "Make it my own" against live TheMealDB (the local stack doesn't run the recipe proxy; covered by unit tests).
- Real devices (see `release/device-test-matrix.md`).
- A coach or physiotherapist should review the drill content before public release (added to `release/checklist.md`).
- Apply the three migrations to the hosted project.
