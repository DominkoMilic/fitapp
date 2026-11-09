# Decisions

Clarifications of, and deviations from, `docs/PACE_SPEC.md`. Newest first.

## 2026-11-08: Phase 1

1. **Match-day rules apply to matches, not practices.** In the spec, section 10.2 says the day before a match (MD-1) is rest only, but the example week in 25.1 schedules a strength session on Monday, the day before Tuesday's practice match. Resolution: MD-1 and MD+1 apply to commitments with a `*_match` category. Practices still count as hard days, and the day after any hard commitment prefers recovery. This reproduces the 25.1 example exactly. The test is in `tests/unit/domain/weekly-pattern.test.ts`.
2. **Lower-body strength goes on the day furthest from the next hard day**, not just the next match. This avoids heavy leg work the day before a hard practice.
3. **One rest day is always reserved.** If the week has no MD-1 rest, one free day is kept as rest even when the user asks for 7 training days. The plan then raises the warning `fewer_sessions_than_requested`.
4. **Phase 1 stores the weekly pattern, not dated sessions.** The plan preview shows a generated 7-day pattern, saved in `training_plans.weekly_pattern`. Dated `scheduled_workouts` arrive with their table in Phase 3, which will turn the stored pattern and the `recurring_events` into occurrences.
5. **The 18+ rule is not a CHECK constraint.** It depends on today's date, and Postgres CHECK constraints must be immutable. It's enforced in `complete_onboarding()` (server) and in the zod schema (client).
6. **Onboarding is saved by one RPC** (`complete_onboarding`) so the result is all-or-nothing. It's `security invoker`, so RLS still applies.
7. **The starting weight lives on `user_goals.starting_weight_kg`.** The `weight_entries` table arrives in Phase 2. Its migration will backfill a first weight entry from the active goal.
8. **Explicit grants.** Supabase grants all table privileges to `anon` and `authenticated` by default, so every migration revokes them and grants only what's needed. The pgTAP tests caught this: `consents` was still deletable before the fix.
9. **Package versions** come from the `expo` package's own `bundledNativeModules.json`, because `npx expo install` (api.expo.dev) and the Expo/Supabase documentation sites are unreachable from the development container. APIs were checked against the installed type definitions.

## 2026-11-09: Phase 2

1. **Outbox storage.** iOS and Android use expo-sqlite (`pace-sync.db`, one row per op, rewritten in a transaction). Web and Jest use AsyncStorage, because expo-sqlite on web needs WASM and cross-origin-isolation headers. The queue rules live in `src/domain/sync/outbox.ts` and are the same on every platform.
2. **Conflict resolution.** Records use client UUIDs and are upserted on their id. `client_updated_at` is the time the write was queued. Concurrent edits of the same record from two devices resolve by last write to reach the server. Append-only data (weights, measurements, milestones) can't conflict.
3. **`daily_checkins` uses `(user_id, local_date)` as its primary key** instead of a separate `id`. One check-in per day is the rule, and a natural key keeps offline upserts idempotent across devices.
4. **Failed writes are never dropped automatically.** Network, 5xx and 429 errors retry with exponential backoff (capped at 5 min). A 401 refreshes the session once and retries. Other 4xx errors mark the op as failed, and it stays visible in Sync status with Retry and Discard.
5. **Charts use react-native-svg instead of victory-native.** The spec (1.3) chose victory-native, which needs `@shopify/react-native-skia`, a large native module, plus WASM on web. The charts PACE needs are line and point charts, so they're drawn with `react-native-svg` (already installed). The geometry (scales, ticks, gap segments) lives in `src/domain/charts` and is unit-tested. The same charts render on iOS, Android and web, which lets the browser E2E check them. Revisit this if interactive zoom or pan is needed later.
6. **Sign-out keeps unsynced changes on the phone.** The spec says to clear local caches after confirmation, but clearing would discard data, which spec 3.2 forbids. The outbox is stored per user, so it's never visible to or synced under another account. It syncs the next time the same user signs in. The sign-out dialog first tries to sync, then says how many changes are still waiting.
7. **Weight milestones count the onboarding weigh-in.** It's a real weight entry, so on the onboarding day the daily value is the mean of the onboarding weight and any later entry that day.
8. **Quick actions on Home** only show actions that work in this version (log weight, check-in, measure, progress). Meal, water and workout actions are added with their phases.

## 2026-11-09: Phase 3

1. **One catalogue, two consumers.** System exercises and templates live in `src/domain/training/catalogue.ts`. The app bundles it, so the library works offline. `scripts/gen-training-seed.mjs` generates the database seed migration from it with deterministic UUIDs, and `npm run check` fails if the migration is out of date.
2. **No `scheduled_workout_exercises` table.** A scheduled workout stores its `template_slug`. The exercise list is built when you open or start the workout, applying your **current** injuries and equipment. A workout planned before an injury is therefore adjusted automatically (spec 28.5 #13). System templates only change through migrations, so the snapshot the spec asked for has no practical benefit.
3. **Idempotent calendar generation with `occurrence_key`** (`plan:<plan id>:<date>` or `event:<event id>:<date>`) and a full unique constraint `(user_id, occurrence_key)`. PostgREST can't upsert on a partial unique index. Generation runs online once a day with ON CONFLICT DO NOTHING. Changing the plan or a series deletes only future, unmodified, still-planned occurrences, then regenerates.
4. **Personal records are derived from history, not stored.** Deleting a workout recalculates them automatically (spec 14.3), and there's no table to keep in sync.
5. **Calendar edits send full rows through the outbox.** Postgres checks NOT NULL columns on the proposed row before ON CONFLICT runs, so a partial upsert payload would fail.
6. **Equipment is a list of requirements where "a|b" means either.** Floor, mat, wall, chair and step are assumed. "No equipment" means bodyweight only. Exercises that can't be done are swapped for their template alternative or left out, and the workout says which and why.
7. **Training hours count workouts and logged sport.** GPS activities are added to the total in Phase 5.

## 2026-11-09: Phase 4

1. **Reference foods come from USDA FoodData Central SR Legacy (CC0)**: 6,862 foods after dropping baby, fast-food, restaurant, branded and QC categories. The seed is generated by `scripts/gen-usda-seed.mjs` from the downloaded CSVs. Search runs on the server (`search_foods`), because a 1.6 MB catalogue is too big to bundle into the app. Recent foods, custom foods and saved meals work offline.
2. **No food-log header table.** The spec's `meal_logs` + `meal_log_items` became one `meal_log_items` table. A meal is the items for a given (date, meal type). This avoids a header that can drift from its items, and avoids parent/child ordering in offline sync. Totals are always derived.
3. **Saved meals and recipe ingredients are jsonb snapshots** in one row instead of child tables. Their contents are snapshots anyway, and one row syncs atomically.
4. **No favourites table.** "Recent" (the last 200 logged items) and "My foods" cover quick re-logging. Favourites can be added later if needed.
5. **Search ranking** was tuned against real queries: own foods first, processed forms (dried, powder, mix, canned, frozen) after the plain food unless you type that word, then main-name match, whole-word match, generic before brands, whole/raw first. Tests pin "egg", "banana" and "canned salmon".
6. **TheMealDB only through the `recipes-proxy` Edge Function.** The key is a server secret (`THEMEALDB_API_KEY`; TheMealDB's public test key `1` is the default). There's a DB-backed rate limit of 60/min per user (in-memory limits reset per isolate), and results are cached for 24 h in `recipes`. A CHECK constraint stops external recipes from ever storing nutrition.
7. **Shared code for Edge Functions** (`supabase/functions/_shared`) is copied from the app by `scripts/sync-shared.mjs`. `npm run check` fails if the copies drift. Deno can't resolve the app's `@/` imports, and this keeps one tested implementation.
8. **Measure display:** kitchen volumes (cup, tbsp, tsp) round to eighths (⅜ cup), counts to quarters, and g/ml to 1 or 5. An amount is marked "approx." when rounding changed it or a count isn't whole. Unscaled amounts keep the source's own wording. Volumes are never converted to grams.
9. **A deleted account is detected by a missing profile row.** Every account gets one from the sign-up trigger, so a session without one belongs to a deleted account. The app signs out and says why (spec 28.1 #8).
10. **Local development** uses ports 553xx so PACE can run beside other local Supabase projects. Expo bundles `.env.local` into dev web builds and it overrides shell variables, so to point a dev build at the local stack, put the local values in `.env.development.local`.

## 2026-11-09: Phase 5

1. **Every raw GPS point is stored; the track is always rebuilt.** The background task writes each fix to SQLite (`pace-gps.db`) as it arrives. The live screen, the summary and recovery after a kill all rebuild the track the same way, from the stored points plus the pause intervals (`buildTrack`). There's no in-memory state that can drift or be lost. The recording itself (id, type, start, pauses) is persisted in AsyncStorage after every change.
2. **Pausing stops location updates** to save battery, and points timed inside a pause are ignored anyway. Resume restarts updates. A recording is offered for resume when its last stored point or change is under 6 hours old. Otherwise it can only be finished or discarded.
3. **Route file is plain JSON at `routes/<user>/<activity>.json`**, not `.json.gz` as the spec says. Coordinates are polyline-encoded (≈1 m precision) with delta times, accuracy and altitude per point. That makes it about as small as gzip of the raw format, and it needs no compression library on the phone. A DB check constraint pins the path to the owner's folder. Only accepted points are stored (spec 11.7).
4. **Route upload is its own outbox entity (`activity_routes`) that runs after the activity row.** It uploads the file, then sets `route_storage_path`. Deleting the route removes the file and sets `route_deleted_at`; totals are kept.
5. **Approximate location** is detected from the OS permission (iOS reduced accuracy, Android coarse), not only from fixes over 100 m. Weak fixes show as "Weak (±x m)" while acquiring, and the 25 m filter plus the quality rating handle the rest.
6. **Changing the type after saving** re-filters the stored route with the new type's speed cap (for example, a ride relabelled as a walk loses its implausible distance). The route holds only points accepted under the old type, so moving to a type with a higher cap can't bring back points that were rejected. Without a route (manual, or route deleted), distance is kept and pace, speed and calories are recalculated.
7. **Manual activities:** calories only when a distance is given (spec 11.8). They count toward distance records and milestones (they're user-entered, not GPS) but never toward the fastest pace.
8. **Maps:** Apple Maps on iOS (no key). Google Maps on Android needs `GOOGLE_MAPS_ANDROID_API_KEY` at build time; without it, and on web, the route is drawn as an SVG shape.
9. **Activities count toward training hours** milestones (moving time), as planned in Phase 3.
