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
