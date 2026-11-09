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
10. **`recipes-proxy` runs with `verify_jwt = false`.** The gateway's check only accepts tokens signed with the legacy JWT secret, while new projects sign sessions with asymmetric keys. The function already verifies the caller with `auth.getUser()` and returns 401 otherwise.
11. **Hosted deploy without the CLI (2026-11-09):** the Phase 4 and 5 migrations were applied through the SQL editor, each batch in a transaction that also records its version in `supabase_migrations.schema_migrations`, so a later `supabase db push` treats them as applied. The function was deployed through the dashboard editor as a single-file bundle of `recipes-proxy` + `_shared`, type-checked before deploy.

## 2026-11-09: Phase 6

1. **Every recalibration check is recorded**, not only proposals. Outcomes without a change are stored with status `no_change` (a fifth status beyond the spec's four), so the next check knows when the last one ran and whether it was "slow" (spec 8.9: slow on this check *and* the previous one).
2. **Accepting goes through `accept_target_adjustment()`**, one transaction that creates the new target version from tomorrow and marks the proposal. The database refuses a target that doesn't match the proposal, anything below the floor, and a second accepted change within 14 days. A trigger stops clients from setting `accepted` directly or editing a proposal's inputs. Recalibration needs the server anyway (spec 18.1 doesn't list it for offline), so this is online-only.
3. **The new target keeps protein and fat; carbs absorb the change**, the same rule as manual calorie edits (`targetsFromEditedCalories`).
4. **Recalibration runs only for weight-loss goals.** The spec's rules (loss rate vs target rate, +150 / −100) are defined for loss. Other goals get no review.
5. **Coach dismissals are stored on the device** (until the end of the local day). They're short-lived UI state and don't need syncing.
6. **Rule suppression:** S1–S3 (safety), R1, R3 and R4 (recovery) hide the training pushes T1 and T2. New users (under 3 days of data) see only onboarding tips and safety cards.
7. **"Hard day"** for R4 means a completed session with RPE ≥ 7, a match, or one that completed a workout planned as hard.
8. **Training load counts only sessions with an RPE.** Activities have no RPE, so they don't add load.
9. **Rest days are calendar entries, not workouts.** They're excluded from planned counts (report, C1, consistent weeks), from "missed yesterday", and from reminders.
10. **Consistent weeks:** a finished week with nothing planned neither counts nor breaks the run.
11. **Weekly reports:** the current week is always computed live. A finished week is stored as a snapshot the first time it's opened, so later edits don't rewrite it.
12. **Logging streak** now also counts food, water, workouts and activities (spec 25.5 "any log"), from the last 90 days.
13. **Reminders** are planned in the profile timezone and converted with a DST-safe `instantFromLocal`. At most 60 are pending (iOS allows 64; room is kept for the rest timer). When the daily cap of 4 bites, the order is match > workout > weekly report > weigh-in > meal > water. Reminder times can only be set between 07:00 and 21:59.
14. **Rest timer:** a "Rest over" notification is scheduled while a rest is running and cancelled when it ends or is skipped. It has no separate setting.

## 2026-11-09: Phase 7

1. **Account deletion runs in an Edge Function** (`delete-account`), because deleting an auth user needs the service role. The order is Storage objects first, then the auth user (every table cascades). If storage cleanup fails, the user is not deleted, and a retry finishes the job. Re-authentication is enforced on the server: the password must have been entered in the last 10 minutes (`last_sign_in_at`), and the body must be `{ "confirm": "DELETE" }`. The logic is a pure shared module, tested in Jest and copied into the function by `scripts/sync-shared.mjs`.
2. **Data export is built on the device** with the user's own session, so RLS guarantees it holds only their data. It reads every user table page by page (1000 rows) plus the route files. A test compares the table list with the generated database types, so a new user table can't be left out. Technical rate-limit counters are excluded.
3. **No Sentry or other crash-reporting SDK in V1.** The spec makes it optional, the privacy promise is "no third-party SDKs", and health data must never reach crash reports. Errors are handled in the UI. This can be revisited with strict scrubbing if needed.
4. **Support contact comes from `EXPO_PUBLIC_SUPPORT_EMAIL`**, required for production builds (the config check fails without it). I don't invent the operator's identity: the policy refers to the developer named on the store pages.
5. **Colour tokens adjusted for WCAG AA.** Five pairs were below 4.5:1: dark red text, light green text and its button, and light amber and red text on raised cards. A unit test now checks every text/surface and label/fill pair in both themes.
6. **Long lists are virtualised** with `ListScreen` (FlatList). Weight history previously stopped at 60 entries, so older weigh-ins couldn't be edited; it now lists all of them.
7. **`goBack(fallback)` replaces `router.back()`** everywhere, enforced by a lint rule. Screens opened from a link, a notification or a reload have no history, and `router.back()` failed there.
8. **Production config trims what isn't used:** only the `location` background mode (expo-task-manager adds `fetch`), no Face ID or motion usage strings, and no overlay or external-storage permissions on Android. Version 1.0.0. `usesNonExemptEncryption: false`.
9. **E2E:** Maestro smoke flows navigate with deep links (`pace://…`), so layout changes don't break them. They run locally against a dev or preview build, or on EAS Workflows. GitHub Actions runs the unit, pgTAP and bundle jobs; a phone emulator in CI was left out for cost and flakiness.

## 2026-11-09: Full audit (security, UX, accessibility, privacy, reliability, performance)

1. **Safety rules are enforced in the database for user writes**, through triggers that apply to requests made with a user session: the calorie floor (sex floor, can't be lowered), 18+, goal BMI ≥ 18.5, health data only with consent, recalibration proposals that follow the rules, a server-set decision time, and server-set consent times. Server-side writes stay trusted. `complete_onboarding()` is the only path that sets `onboarding_completed_at`.
2. **Auth links accept only PKCE `code` and `token_hash`.** Raw session tokens in a link are refused, because they make login CSRF possible. After any link signs someone in, the app shows the account email with "This isn't my account".
3. **Session tokens live in the OS keychain** (chunked `expo-secure-store`, since sessions exceed the ~2 KB value limit), with a one-time move from AsyncStorage. Web keeps localStorage.
4. **Sign-out cleans the device** (GPS stopped, reminders cancelled, onboarding draft and export files removed) but keeps the user-bound workout/recording draft and the unsynced outbox, so nothing is lost and nothing is shown to another account.
5. **Every read that can exceed 1,000 rows is paged** with a stable order (`fetchAllPages`). PostgREST caps responses at 1,000 rows.
6. **Recipe photos are copied to PACE Storage** (`recipe-images`, public read, service-role write) and referenced as `storage:recipe-images/<path>`, which the app resolves against its own Supabase URL. The app never loads a TheMealDB URL.
7. **Requests time out** (20 s for API calls, 60 s for Storage and Functions). React Query follows the network state.
8. **A root error boundary and a not-found route** replace the framework's developer screens.
9. **Shared UX helpers:** `useSubmit` (one save at a time, error toast), `useGuardedAction`, `LoadErrorBanner`, `announce()` for screen readers, display formatters in `src/domain/format`.
10. **npm audit:** 21 moderate and 1 low advisories, all in build/CLI/test tooling (`minimatch`/`glob` via the Expo CLI, the jest chain). The suggested fix is a major downgrade, so no change. Re-check when Expo SDK updates.

## 2026-11-09: Test runner

1. **Jest runs tests in worker threads** (`"workerThreads": true` in `package.json`). On Node 24, Jest's child-process workers occasionally crashed with SIGSEGV (about 1 run in 6), dropping a random test file from the run. With worker threads, 10 of 10 runs were clean. CI uses Node 22.

## 2026-11-09: All-sport support

1. **Sports are a catalogue, not a schema enum.** `src/domain/sports/catalogue.ts` lists 17 sports (labels, game/practice words, METs, the body areas each one loads, drill pack). Events are stored as `<sport>_match` / `<sport>_practice`, so existing `futsal_*` / `football_*` rows stay valid. The database checks only the shape; the app checks the catalogue.
2. **Injury checks are per sport.** A sport is restricted only when an injury that isn't cleared for sport affects a body area that sport loads. Unknown sports and "Other" use every area.
3. **Per-sport drill packs** (11 packs, no contact or sparring drills). Ball drills accept the old "football" equipment value. One weekly session becomes "<Sport> skills" (first sport's pack) when the user plays a sport, has the sport focus, trains at least 3 days and isn't restricted for that sport. The drill content should be reviewed by a coach or physiotherapist before public release.
4. **The training seed moves to a new migration** (`20261115000200_training_seed_sports.sql`). Applied migrations are never edited, and the original seed runs before the `exercises.sports` column exists. The seed is an idempotent upsert, so the newest seed file brings any database up to date.

## 2026-11-09: Your own recipes and meals

1. **Two kinds of recipe ingredients.** Foods from the database (grams, with a per-100 g snapshot so the recipe can be recalculated offline) and free text (a name plus an optional amount, parsed so it scales and reaches the shopping list). Free text never gets nutrition.
2. **"Your estimate" is a new nutrition confidence** (`recipes.nutritional_confidence = 'user_estimate'`, migration `20261115000300`). It is allowed only on the user's own recipes; TheMealDB rows still cannot carry nutrition. Estimates are labelled wherever they appear, including logged entries (`confidence_snapshot`).
3. **Partial calculation is allowed and labelled** ("Calculated from 3 of 5 ingredients") rather than blocked, because many home recipes include salt, spices or water that have no meaningful nutrition.
4. **Saved meal items are nutrition snapshots** (food, recipe or quick item). Changing an amount scales the snapshot linearly, which is exact. Old rows without a `kind` are read as food (with `food_id`) or quick items.
5. **Editing never rewrites history.** Recipes, meals and foods are full-row upserts through the outbox; logged entries keep their own snapshot.
6. **No recipe photos** for user recipes (decided with the product owner).

## 2026-11-09: Touch feedback and transitions

1. **Press feedback uses React Native's `Animated` on the native driver**, not Reanimated, so every pressable keeps working in tests and on web without extra setup. Reanimated is used only for list-row enter/exit/layout animations.
2. **One stack transition everywhere** (`ios_from_right`) so Android and iOS feel the same; modals slide up; onboarding keeps its cross-fade.
3. **Haptics are subtle and optional by design**: selection ticks, a light tap on primary actions, a success pulse after saving. They follow the reduce-motion setting.

## 2026-11-09: Nutrition can be switched off

1. **A single preference** (`user_preferences.nutrition_enabled`, migration `20261116000100`) rather than per-screen settings. Off hides food, calories and water everywhere; weight and goals stay.
2. **Targets are still calculated and saved while off**, so turning nutrition back on is instant and the safety rules (floor, BMI) keep applying to stored targets.
3. **The two-week calorie review doesn't run while off**, because it depends on logged intake (8.9).
4. **Older app versions keep working**: onboarding treats a missing value as on.

