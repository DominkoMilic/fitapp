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

## 2026-11-09: Science pass before expert review

1. **Calculation version 2.1.0.** With 4+ hard sessions a week the maximum deficit is 500 kcal (was 750 for everyone), to lower the risk of low energy availability (IOC REDs consensus). Without known training the results are identical to 2.0.0, so the spec 29 vectors stand.
2. **Sport carbohydrate guidance is information only** (≥ 3 g/kg for sport players with 3+ sessions a week). Changing the macro split automatically would need expert input first.
3. **Hydration on training days is a note, not a target change**, for the same reason.
4. **Sport packs get a RAMP dynamic warm-up**; the old mobility warm-up stays for strength sessions. Sprint-type rests ≥ 90 s and ≤ 30 jump contacts per pack are enforced by tests.
5. **The sport-skills session avoids MD-2 and days next to hard practices**, and counts towards the hard-day warning.
6. **The training seed moves to `20261116000200_training_seed_warmup.sql`**; earlier seed migrations are applied and frozen.
7. **`docs/expert-review-pack.md`** lists every number with its source and status, and the questions for each expert.

## 2026-11-09: Manual workouts, own durations and edits

1. **One editable workout model for live, logged and edited workouts.** Logging afterwards and editing reuse the live workout state machine (`active-workout.ts`), so volume, completion and calories always follow the same rules (`sessionRecord`).
2. **Added exercises don't count as planned** (`targetSets = 0`), so doing more never lowers the completion rate.
3. **Edits replace the session's sets** (old set rows deleted, new ones written) instead of diffing; sets are never referenced elsewhere, and records and milestones are recalculated from sets.
4. **Manual times must lie in the past** (start and end at most 5 minutes in the future), 1–300 minutes, up to 60 days back.
5. **Just-synced writes stay applied locally for 15 s** (sync engine overlay), fixing a flash of old values after saving while the refetch is in flight.
6. **No schema change**: sessions already support `source = 'manual'`, and sets can be deleted by their owner.


## 2026-11-10: Food tracking is opt-in

1. **Onboarding pre-selects "Track food too?" = no.** PACE is training-first, and the nutrition step was the most overwhelming part of onboarding. Users who want it switch it on in one tap; the detailed diet questions appear only then.
2. **Nutrition is kept, not removed.** It is finished, tested and already switchable (6.5); a default hides it from users who don't want it without throwing that work away.
3. **The DB default stays `true`** so older app versions behave as before (see "Nutrition can be switched off"). A submitted draft with no `trackNutrition` value (from a version before the toggle existed) is still read as on.
4. **App features links to Food preferences when nutrition is on**, so people who turn it on later can fill in the diet questions they skipped.
5. **Social "clubs" are the planned first post-launch feature** (small invite-only groups, shared workout feed, cheers, a shared weekly goal rather than a ranked leaderboard). They will get their own spec phase before any work starts.

## 2026-11-10: Simpler navigation (reorganize, nothing removed)

1. **Reorganize only.** No feature, table or domain rule was removed; screens moved one level deeper or were merged. Routes that lost their link stay, so notifications and deep links still work (`/activity`, `/training/calendar`, `/settings/sports`, `/onboarding/activity`, `/onboarding/equipment`).
2. **Training tab: one "+ Add" button** (`training/add`) instead of four links. It lists every way to add training directly (record; log a gym/home workout, a game or practice, or a walk/run/ride without GPS; plan) instead of asking a follow-up question. It has no "start a workout" entry: today's planned workout already starts from the Today card, and there is no empty-workout mode to point at.
3. **One History** for workouts and activities (`mergeHistory` in `src/domain/training/history.ts`, newest first by start instant). The month calendar is a button at the top of History.
4. **Home**: two quick actions (Log weight, Check-in). "Measure" moved to Progress → Body measurements (which has Add). "Progress" duplicated a tab. "Recent milestones" left Home (milestones still celebrate and are listed in Progress). "Coming up" became one "Next: …" line on the Today card.
5. **Progress**: the check-in link duplicated Home. The 2-week review link is gone because the W2 coach card already appears on Home when a review is waiting; past reviews are under Goal and targets.
6. **Profile: "Training setup" is a short page linking Sports, Schedule and Equipment**, not one combined form. Each of the three has its own Save, and three Save buttons on one screen would be more confusing than one extra tap. The four legal documents moved into "Data and privacy". Sync status is only listed while changes are waiting or failed (the Home sync banner uses the same check).
7. **Onboarding 9 → 7 steps.** Activity level is part of "About you"; equipment is part of "Your week". Each screen validates both of its forms at once and still saves them to the separate draft keys, so the payload and drafts saved by older versions are unchanged.

## 2026-11-10: UX polish from real-device testing

1. **`react-native-keyboard-controller` for all keyboard handling.** Android 15+ forces edge-to-edge (Expo SDK 58 enables it by default), so `adjustResize` no longer resizes the window and the old `KeyboardAvoidingView` (no behaviour on Android) let the keyboard cover inputs. The library's `KeyboardAwareScrollView` scrolls the focused field into view on both platforms, `KeyboardStickyView` keeps the footer on the keyboard, and `KeyboardController.setFocusTo('next')` gives "Return → next field" in every form without wiring each one. It needs a native rebuild (new dev/preview builds).
2. **Keyboard defaults live in `TextField`** (`keyboardDefaults`), so every field gets them; callers can still override. Destructive forms (delete account) never submit on Return.
3. **All buttons have a border.** Ghost buttons were easy to miss (e.g. Cancel in the sign-out dialog); a visible edge makes every tappable thing obvious.
4. **Completed state is a card tone, not only an icon** (`Card tone="success"`), with a new `successSurface` token that keeps every text colour ≥ 4.5:1 (contrast test extended). The spec's token table was also brought in line with the code (accent/warning/danger had drifted).
5. **One `SwipeToDismiss` component** for coach cards and toasts: slide out, then collapse height so the layout doesn't jump. Reduce motion removes the item at once.

## 2026-11-10: Weight chart shows the ups and downs

1. **Daily weights are a connected line**, with the 7-day average kept on top (decided with the user): seeing the daily line go down is motivating, and the average keeps day-to-day water swings from looking like the trend.
2. **Gaps of more than 7 days are dashed**, so a stretch without weigh-ins is never shown as measured data (consistent with the average line breaking over gaps).
3. **Calendar ranges (Week · Month · Year · All) replace the rolling 7D…1Y on the weight screen** (decided with the user): they match how people think about progress. The overview cards keep the rolling 30 days, so no other numbers change.
4. **Dots only while ≤ 45 days are in view**; with long histories the line alone stays readable.
5. **`Screen` corrects the scroll position when its content shrinks.** Android keeps the old offset, which left a blank area on Home after turning nutrition off.

## 2026-11-10: Quieter chart, goal-aware stats, visible tap targets

1. **No lines across the weight chart.** Grid lines and full-width Start/Target lines made the data hard to read (user feedback). Start and Target are tags on the y-axis instead, and the y-range spans target → start, expanding when a weight passes either.
2. **Change tiles are goal-aware and amber, not red** (decided with the user): green when moving toward the goal (down for lose weight, up for build muscle), amber when moving away, neutral for maintenance. Red would contradict spec 23.4 (weight changes are reported neutrally, never shaming) and would be wrong for muscle-gain goals.
3. **Every tappable card shows an affordance** ("Details ›" or a specific label; a chevron for list-like cards), because several Home and Progress cards weren't recognisable as tappable.
4. **Chart scrubbing uses gesture-handler** (pan + tap) instead of RN responders, which the scroll view could take over mid-drag.

## 2026-11-10: Field errors, stricter new passwords, Change password

1. **Validation messages belong on the field** (red border + message under it, cleared on edit). Banners stay only for errors that aren't about one field, and now animate in.
2. **New passwords need an uppercase letter, a lowercase letter, a number and 8+ characters**, with a live checklist (user request). Applied to sign-up, reset and change password only; sign-in accepts any existing password. The hosted Supabase project must use the same `lower_upper_letters_digits` policy (release checklist).
3. **Change password re-checks the current password** with a sign-in before updating, which also satisfies Supabase's "secure password change" if enabled. Its forgot link sends the reset email directly, because the auth screens redirect signed-in users away.
4. **Chart scale is back** (grid + round numbers on the right) alongside the Start/Target tags on the left: the grid wasn't the readability problem, the full-width reference lines were.

## 2026-11-10: Calendar date picker, Start · Now · Goal on Home

1. **A calendar sheet replaces typing day / month / year** (user request). One tap picks a day; the year and month lists make a date of birth quick. Ranges are enforced in the picker (and still validated), so impossible dates can't be chosen.
2. **The sheet has its own `GestureHandlerRootView`**: on Android a Modal is outside the app's gesture root, so the month swipe would otherwise crash.
3. **Home shows Start · Now · Goal** with "x down · y to go", so the direction of travel is clear at a glance.

## 2026-11-10: Sheets no longer jump when opening

1. **Cause (measured from a screen recording, 60 fps):** an Android Modal window was laid out above the navigation bar and then grew under it, so the calendar sheet overshot its final place by ~68 px (the gesture-bar height) for a frame as it finished sliding in.
2. **Fix:** `ModalShell` uses a full-screen (status- and navigation-bar translucent) window, no native animation, and only mounts its content once the window has its final size (250 ms fallback). The sheet now rises monotonically and stops exactly in place. `ConfirmDialog` uses the same shell.

## 2026-11-10: App logo and icon set

1. **Logo: "Pace ring"** (chosen by the product owner from five concepts): a running stick figure inside an open mint progress ring on the app's dark background. The ring echoes goal progress; the gap ahead means "keep going". The head rests on the shoulders (no neck).
2. **One source, one folder.** `scripts/gen-brand-assets.mjs` draws everything from the same geometry into `assets/brand/`: master SVGs (`pace-logo`, `pace-mark`, `pace-mono`), the iOS icon (full bleed, no transparency), the Android adaptive foreground and Android 13+ monochrome icon (inside the 66 dp safe zone, on the `#121417` background colour), the splash tile, the favicon and the notification small icon. `app.config.ts` points only at that folder; `expo prebuild` generates the native sizes. Old default icons and the concept files were removed.
3. **Notification small icon** is a white, bolder-stroke silhouette (Android uses only its alpha and tints it with `#34D399`); iOS uses the app icon.

## 2026-11-10: Chart scale on the left, goal lines back as pale lines

User feedback after using the quieter chart: numbers belong on the left axis, and start/goal read best as full-width lines. They are now pale (45% opacity; start solid, targets dashed) and labelled at their right end, so they guide the eye without competing with the data.

## 2026-11-10: Paged history lists

Long lists render 20 rows per page (next page near the end of the scroll, or "Show more"). FlatList already virtualises, but the weight-details screen puts a large header (chart and tiles) above its history; paging keeps first render and scrolling light as history grows. Data loading is unchanged (the queries already cap and cache); pagination is in the shared `ListScreen`, so every long list gets it.

## 2026-11-10: Social (Phase 8) design decisions

1. **Effort-only leaderboards among friends and clubs, opt-in** (decided with the product owner). Replaces the blanket "no competitive leaderboards" rule: ranking sessions, active minutes, distance or active days motivates; ranking weight, body or food is still out of scope (spec 2.3, 3.4).
2. **Private by default.** Nothing is shared until the user chooses per type; weight, food, health, notes, routes and clock times are never shareable. Other people only read sanitised snapshots and server aggregates; source tables keep owner-only RLS.
3. **Online-only social writes**, not the offline outbox: permissions are checked on the server, and replaying a queued friend request or cheer later would surprise people.
4. **Five tabs at most:** when nutrition and social are both on, Profile leaves the tab bar (it opens from the Home header).
5. **Staged delivery 8A–8D** (friends and safety → feed, cheers, push → clubs → challenges and leaderboards), each a reviewed phase.
6. **Daily caps** on counted effort (240 active minutes, 60 km on foot, 150 km cycling) guard against cheating and against overtraining for a ranking.

## 2026-11-17: Phase 8A implementation decisions

1. **Handles are `text` with a check constraint**, always stored lower-case, instead of `citext`: no extension needed and the rule is the same in the app and the database.
2. **New `app_config` table** for the social kill switch (none existed). Signed-in users can read it; only the service role can change it.
3. **Friendships, blocks and reports are written only through security-definer functions.** RLS alone can't express "not blocked, not banned, accepts requests, under 500 friends, rate-limited" cleanly; the functions do, and the tables grant no direct writes.
4. **A block never reveals itself:** the blocked person gets `not_found`, sees no block row and can't open the blocker's profile.
5. **"Delete my social profile" keeps the blocks you made**, so people you blocked can't reach you if you come back. Account deletion removes everything (cascade).
6. **Rate-limit counters roll back when an action fails** (it runs in one transaction). Accepted: repeated failing requests are cheap and have no effect.
7. **The social consent is recorded on setup and on each switch on or off**, with the legal version, which is bumped to 2026-11-17 (privacy: Social features; terms: Community rules). There is no re-acceptance prompt; the version is recorded with each consent.

## 2026-11-18: Nutrition removed (archived)

1. **Why:** the product owner found nutrition (food logging, calorie and macro targets, water, recipes, meal planner, shopping list) overwhelming and felt it made PACE more of a cooking app than a fitness app.
2. **Archive:** the last full app with nutrition (including social 8A) is branch `archive/nutrition`, tag `nutrition-archive-2026-11`. `docs/NUTRITION_ARCHIVE.md` explains how to bring it back.
3. **Tables dropped** (chosen by the product owner): migration `20261118000100_remove_nutrition.sql` drops the 13 nutrition tables, their functions and guards, and the food-preference columns, and rewrites `complete_onboarding` without targets (old payloads that still send them are accepted and ignored). The `recipe-images` bucket and the `recipes-proxy` function are removed from the hosted project. This deleted nutrition data permanently; bringing it back needs a new migration that recreates the schema.
4. **Kept:** MET-based "calories burned" estimates for workouts and activities (exercise estimates, not food); the activity-level question (describes the user); weight goal, weekly rate and BMI rule.
5. **Goal date** is now estimated from the chosen weekly rate (`projectGoalDate`, spec 8.8) instead of the calorie deficit; progress screens keep the observed-trend estimate.
6. **Removed with it:** coach rules S4, N1–N3, W2; the 2-week calorie review; meal and water reminders (old stored settings are ignored); nutrition in the weekly report (stored snapshots keep their old fields, which the view ignores); food and water in the logging streak.
7. **Old devices:** queued sync operations for the removed tables are dropped when the outbox loads; onboarding drafts saved on the removed food step resume at Health. App builds from before this change can't use the nutrition screens any more and must be replaced (only test accounts were affected).
8. **Legal:** privacy, terms, disclaimer and licences lose the food, recipe, TheMealDB and USDA parts; legal version 2026-11-18.

## 2026-11-19: Phase 8B-1 (feed, cheers, comments) decisions

1. **Push is split out (8B-2).** It needs the product owner's Expo and Firebase accounts; the tables, hook and function are built and tested but stay off behind `app_config.push_enabled` (`docs/release/push-setup.md`).
2. **Existing posts keep their audience.** Switching a type off stops new posts; earlier ones stay until removed from their ⋯ menu ("Remove from feed"). Edits still update an existing post.
3. **Never shared:** weight milestones, including `weigh_in_30` (it is about weighing), and every source field outside the whitelist (notes, start/end times, effort, feeling, calories, route).
4. **One cheer per person**, kind changeable; no cheering your own post. **Comments** are removed softly (row kept, text gone) so threads keep their order; the author or the post owner can remove one.
5. **Batching:** events on the same topic within 15 minutes, or during quiet hours, are counted and folded into the next push for that topic. A batched event with no later event is not sent on its own (8B-2 may add a scheduled flush).
6. **Rows reach snapshot functions as jsonb** (`to_jsonb(new)`): functions taking a table row are exposed by the API as computed columns.
7. **Export** gains feed items, cheers and comments; push tokens and push batching state are technical (not exported). Legal version 2026-11-19 (privacy: what friends see in a post, comments).

## 2026-11-20: Hiding earlier posts when sharing is switched off

Replaces decision 2 of 2026-11-19 ("existing posts keep their audience"), at the product owner's request.

1. Switching a sharing type off stops new posts at once, then asks **"Hide your earlier … too?"** with **Hide them** / **Keep them**. Hiding sets `hidden_at` with `hidden_reason = 'sharing_off'` on all your visible posts of that type (`hide_my_posts`).
2. Switching the type back on offers **"Show your earlier … again?"** when posts were hidden that way (`hidden_post_count`, `show_my_posts`). Posts removed one by one ("Remove from feed", `hidden_reason = 'removed'`) stay removed.
3. Hidden posts keep their cheers and comments, so showing them again restores them as they were.

## 2026-11-20: Phase 8B-2 (push notifications) decisions

1. **Shared secret generated by the database** (`push_config`), read by the `social-push` function itself, instead of a function secret: no one copies a secret between places.
2. **Deployed from the dashboard editor** as a single file (the shared push rules inlined), because the Supabase CLI isn't signed in to this account on the development Mac. The repo keeps the two-file version (`_shared/social-push.ts` generated from `src/domain/social/push.ts`).
3. **High priority, own channel.** Normal-priority pushes were held back for minutes on the Samsung test phone, and pushes for a channel that doesn't exist yet are dropped, so pushes use `priority: 'high'` and the "Friends" (`social`) channel, created when the app starts.
4. **Privacy:** Expo and Firebase Cloud Messaging are processors for social notifications (name, event type and in-app link only); privacy policy updated, legal version 2026-11-20. `google-services.json` stays out of git.

## 2026-11-20: Phase 8B close-out fixes

1. **Animated switches.** `Toggle` draws its own Reanimated switch (`AnimatedSwitch`: thumb slides, track fades, 200 ms ease-out, instant with reduce motion) instead of the native Switch, which jumped when its value changed from the row press, the optimistic value or a refetch.
2. **Social tab without a jump.** The title and Feed · Friends switch are rendered once; both parts stay mounted and the inactive one is hidden, so switching neither rebuilds the screen nor loses scroll position.
3. **Offline start.** The read cache is now persisted (spec 18.2 always said so; it had not been built): before, opening the app with no connection left every screen on loading placeholders. Kept 3 days, successful reads only, searches excluded, removed on sign-out.
4. Personal information and onboarding label the field "Sex" (the calorie calculation it fed was archived with nutrition).

## 2026-11-21: UX batch after Phase 8B

1. **Social identity is fixed.** One username (3–20 letters, numbers, `_`, `.`; no spaces) chosen once; the handle is always its lowercase form, so Dominko and DoMInKo are the same name; the avatar colour is assigned from the user id. None of the three can be changed later (fewer moving parts, no broken invite links). Existing profiles had their name set to their handle where the two didn't match (test accounts only). Profile photos are a later feature.
2. **Quiet hours are 22:00–06:00** (were 07:00) for reminders and social pushes: many users are up before 7. The deployed `social-push` function needs redeploying with the new rule.
3. **Times are picked** (hours + 5-minute steps) instead of typed, everywhere a time is entered; errors show on the field.
4. **Forms lock while saving**, so no one edits values that won't be part of the save.
5. **Home:** Your progress comes before Quick log; the Check-in quick action became Start/Log workout (the Daily check-in card stays).
6. **Training tab:** week strip with one selected day instead of the whole week as cards; the injury notice opens Health.
7. **Planned workouts:** editable before starting (kept on this phone for that occurrence, not synced: the plan itself doesn't change, so another phone just shows the planned version); no starting or logging before the day; "Move to another day" removed (no other screen moves workouts; planning a one-off workout still works); Skip first suggests the 20-minute version, with the safety line about illness and pain.

## 2026-11-21: Google Maps on Android

Android preview builds now use a Google Maps SDK key (project `pace-c46ed`, restricted to the app package and signing SHA-1, Maps SDK for Android only), so routes are drawn on a real map instead of the plain route shape. The key lives only in `.env.local` / EAS environment variables. The privacy policy already names Google Maps map tiles, so the legal version is unchanged.

GPS check on the Samsung (stationary, 2026-11-21): background recording with the screen locked, pause/resume, recovery after a force-stop and discard all work; GPS stops after discard. Fixed: the live map opened on the whole continent (now street level on your location), the second stats row overflowed narrow screens (now one compact card), and Home had no card for a recording in progress. Known, unchanged: indoors, GPS wander can add ~20 m over a few minutes standing still (the filter ignores moves smaller than half the reported accuracy), and calories count all unpaused time.

## 2026-11-21: Back on the first screen of every stack

Record activity (opened from Training → +) and the first screen of every nested stack had no back arrow, because a native header only shows one when its own stack has history. They now get a shared `HeaderBack` (back with history, else the parent tab: activity/training → Training, progress/reports/weight/measurements → Progress, social → Social, settings → Profile).

## 2026-11-21: Home shows the latest weigh-in as Now

A "Now" figure that differed from what the scale showed felt wrong. Home's Now is the latest weigh-in (with when it was); goal progress, kg down/to go, milestones and goal reached keep using the 7-day average (one day's water swing doesn't move them), shown as a small line under the bar. Matches the Progress tab's separate Current weight and 7-day average tiles.

## 2026-11-22: Comment moderation

1. **Flag swearing, don't ban.** Automatic bans can't tell a joke between friends from abuse, and a wrong ban has no one to appeal to. Swearing in comments is accepted and flagged, and the post owner gets an alert (which they can turn off) so they decide. Slurs, hate, sexual-violence and self-harm words stay refused. Names, handles and bios refuse both.
2. **Croatian/regional words** were added, and č ć š ž đ are folded before matching (the old filter split words at them, so "pička" passed).
3. **Post owners can turn comments off.** The comments are hidden, not deleted, so turning comments back on restores them (consistent with hiding earlier posts). Cheers remain.
4. Legal version 2026-11-22: privacy and terms describe the automatic word check, owner alerts and comment removal.

## 2026-11-23: Removed comments disappear completely

Replaces the soft removal of 2026-11-19 (decision 4), at the product owner's request. A placeholder ("Comment removed") kept drawing attention to what was removed. Removing a comment now deletes the row; existing placeholders were deleted by the migration. While comments are off, the post screen doesn't invite anyone to comment.

## 2026-11-23: Progress tab in the same style as the others

The big Log weight button became the round "+" next to the title (as on Training), the four large stat tiles became one compact card, and the list rows became icon tiles. `Tile`, `HeaderAddButton` and `MiniStat` are shared components used by both tabs.
