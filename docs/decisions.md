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
