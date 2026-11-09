# Phase 4 report: Nutrition

Date: 2026-11-09 · Spec sections: 12, 22, 25 (USDA), 26 (Phase 4), 28.7

## 1. Summary

PACE now does daily nutrition. You can:

- search a food database, log foods by portion or grams, and quick-add calories
- create your own foods and save meals
- track water and mark a day complete
- browse and save TheMealDB recipes with honest "nutrition unavailable" handling and servings scaling
- build your own recipes with calculated nutrition
- plan the week's meals and turn the plan into a shopping list

**This is the first phase tested on the real stack, not mocks.** I used the local Supabase on your Mac (real Postgres, Auth, RLS and Edge Function) and drove the web app in Chrome against it. The recipes came from live TheMealDB.

| Area | Delivered |
|---|---|
| Food catalogue | 6,862 USDA reference foods (public domain) with kcal, protein, carbs, fat and fibre per 100 g, plus named portions ("1 large = 50 g"). Ranked server search; your own foods; recent foods offline |
| Logging | Portions or grams with a live nutrition preview, quick add (kcal and optional macros), custom foods with a check that kcal matches the macros, edit/move/delete (scales the stored snapshot), repeat yesterday's meal, save a meal, saved meals. Every entry is a nutrition snapshot |
| Day view | Remaining kcal, macro and fibre bars ("no data" until something is logged), a partial-data warning, water with undo and over-2 L / over-10 L confirmation, day-complete toggle. Home shows real intake |
| Recipes | `recipes-proxy` Edge Function (signed-in users only, validated input, 60/min per user, server-side key, 24 h cache). Browse/search/categories, saved recipes, your own recipes. Detail shows diet/allergy flags, "Nutrition unavailable" for external recipes, asks for the base servings when the source doesn't say, scales for 1–4 or a custom number of servings, and shows attribution |
| Planner | Week and day view, 4 meals, planned kcal vs target (partial when unknown), suggestions ranked by the meal's share of your target that respect allergies, diet and cooking time. Mark eaten (logs the portion; meals without nutrition open quick add), skip, remove |
| Shopping list | Built from the week's plan, scaled by servings ÷ base. Lines merge only when ingredient and unit match. Unparsed measures stay as text. Ticking works offline, plus manual items. Rebuilding archives the old list |

## 2. Branches

`feature/p4-schema` → `feature/p4-domain` → `feature/p4-logging` → `feature/p4-recipes` → `feature/p4-planner-shopping`, merged into `claude/pace-spec-review-usad8z`.

## 3. Database migrations

| File | Purpose |
|---|---|
| `20261111000100_nutrition.sql` | `foods`, `meal_log_items`, `water_logs`, `day_log_status`, `saved_meals`, `recipes`, `saved_recipes`, `meal_plan_entries`, `shopping_lists`, `shopping_list_items`, RLS |
| `20261111000200_usda_foods_seed.sql` | **Generated**: 6,862 USDA foods (1.6 MB) |
| `20261111000300_food_search.sql` | `search_foods()` RPC (security invoker) |
| `20261111000400_rate_limits.sql` | `edge_rate_limits` + `hit_rate_limit()` (service role only) |
| `20261111000500_food_search_ranking.sql` | Ranking tuned from real searches |

Edge Function: `supabase/functions/recipes-proxy`.

## 4. Environment variables

No app changes. Optional Edge Function secret: `THEMEALDB_API_KEY` (defaults to TheMealDB's public test key `1`; get a supporter key before release).

## 5. Commands run and actual results

| Check | Result |
|---|---|
| `npm run check` (typecheck, lint with 0 warnings, seed and shared-code checks, tests) | ✓ 278 passed, 1 skipped; domain line coverage ≈ 97% |
| `npx supabase test db` on the **real local Supabase stack** | ✓ 158/158 (30 nutrition, 11 search, 5 rate limiter, plus all earlier phases). Also passes after `supabase db reset` from scratch |
| Parser vs **421 real TheMealDB recipes** (4,326 measures) | 87% parsed, 10% "no measurable amount", 3% kept verbatim, 0 crashes |
| `recipes-proxy` on the local stack vs **live TheMealDB** | ✓ search, empty results, lookup normalised with no nutrition and no servings, second lookup from cache, categories, bad input → 400, signed out → 401, cache can't be modified by users |
| Browser, full stack (local Supabase + web app in Chrome) | ✓ sign in → Home (real plan, 108 kg from trigger) → search "egg" → 3 × large egg logged (215 kcal; DB row 150 g / 214.5 kcal snapshot) → water → TheMealDB recipe → base 4 → cook for 2 (scaled) → save (DB row) → plan for dinner → shopping list (9 items) → tick (DB updated) |
| `expo export` iOS + Android **on your Mac** | ✓ (≈9.3 MB each) |

### Problems found and fixed

Found by the real stack and browser testing:

1. **`expo-asset` wasn't directly installed** on your Mac's install. `expo-sqlite` (offline storage) imports it, so phone builds could have failed. Added at the SDK version; both bundles verified.
2. **Search ranking:** "egg" showed dried yolk first. Processed forms now rank after plain foods ("Egg, whole, raw, fresh", "Bananas, raw" and raw salmon come first).
3. **After adding a food the app returned to the search screen.** It now returns to the diary.
4. **Diary label "3 1 large"** now reads "3 × 1 large".
5. **Kitchen amounts:** "0.38 cup" is now "⅜ cup", plurals are fixed ("1½ cups"), and unscaled amounts keep the source's wording.
6. **Deleted accounts:** a session for an account deleted elsewhere was sent into onboarding. The app now signs out and says why (spec 28.1 #8).

Found by unit tests or by me:

7. Count scaling: ¾ egg is marked approx., but doubling 2–3 cloves (4–6) is exact.
8. A failing test file got committed because a `grep` in my command chain succeeded. It was fixed in the next commit, and I now gate commits on the check's exit code.

## 6. Edge cases (spec 28.7)

- #1 partial data: badges and a totals warning.
- #2 ml only for per-100 ml foods.
- #3 quantity limits and confirmation.
- #4 history is a snapshot (pgTAP).
- #5 copying appends.
- #6 `meals: null` is empty, not an error.
- #7 API down: error with retry, and manual logging still works.
- #8 servings question when the base is unknown.
- #9 and #10 measure parsing and approx. amounts.
- #11 one cached row per recipe (unique constraint).
- #12 and #13 allergy and diet flags, hidden from suggestions.
- #14 shopping merge rules.
- #15 water undo and the 10 L confirmation.
- #16 logging any past date.
- #17 day complete stays on until you turn it off.

## 7. Known limitations

- **Not yet on your hosted project.** The 5 new migrations and the Edge Function need to be pushed (§8). Your hosted database still has Phases 1–3.
- Barcode scanning / Open Food Facts is V1.1, as planned.
- Food search needs a connection. Recent foods, your foods, quick add and saved meals work offline.
- External recipes have no nutrition by design. For exact numbers, rebuild them as your own recipe.
- Not run on a real phone yet.

## 8. Manual steps

These need you once, because `supabase login` opens your browser:

```bash
cd ~/codes/training/fitapp
npx supabase login
npx supabase link --project-ref nxdpvklztuwvmuqczpmn
npx supabase db push                                    # applies the 5 Phase 4 migrations
npx supabase functions deploy recipes-proxy
```

After that, I can run these steps myself in future phases.

## 9. Next phase

**Phase 5: GPS activity tracking.** Planned work:

1. Foreground and background location during a walk, run or ride.
2. Point filtering and distance (haversine).
3. Pause and resume.
4. Recovery after the app is killed, from SQLite.
5. Live and summary screens with a route map.
6. Manual activities.
7. Route privacy and deletion.
8. Distance and pace records and milestones.

This needs a development build and a real phone for the background part.
