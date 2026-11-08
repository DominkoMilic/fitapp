# Phase 1 report: Foundation

Date: 2026-11-08 · Spec sections: 4–9, 19–21, 23–24, 26 (Phase 1), 28.1–28.3

## 1. Summary

A user can now sign up, confirm their email, sign in, and complete a 9-step onboarding that produces a transparent, safety-checked plan. That plan is saved atomically to Supabase under row-level security. After onboarding the user lands in a 5-tab app. Home shows today's planned session, the nutrition targets and upcoming matches. Profile lets the user edit every onboarding answer.

| Area | Delivered |
|---|---|
| Project | Expo SDK 58, Expo Router (`src/app`), TypeScript strict + `noUncheckedIndexedAccess`, ESLint (zero-warning gate, no `any`), Prettier, jest-expo, EAS profiles, validated runtime env with a config-error screen |
| Backend | 6 migrations: 9 tables plus the `complete_onboarding` RPC; RLS and explicit grants on every table; profile auto-created on sign-up; cascade delete |
| Auth | Sign up (no account enumeration), email confirmation with resend cooldown, sign in, sign out, forgot/reset password via `pace://auth/callback` deep links (PKCE code, token hash, implicit and error redirects), session persistence, foreground-only token refresh, routing gate (spec 6.1) |
| Domain | BMR, TDEE, calorie target with deficit caps and safety floor, macros with edit rules, water, fibre, projection range, units (imperial round trip, decimal comma), age with Feb 29 handling, timezone-aware local dates, injury restriction model, weekly plan generator with match-day rules, weight milestones, zod schemas |
| Design system | Dark/light/system themes and tokens (spec 23.1), 13 UI components, 6 feedback components, accessibility roles/labels, 44 pt touch targets, reduce-motion support |
| Onboarding | 9 steps with validation, a per-user persisted draft that resumes after an app kill, explicit health-data consent, a plan preview with calculation breakdown, editable calories or macros (floor enforced), projection range, generated week, milestones |
| App shell | 5 tabs. Home: greeting, date, starting/goal weight, today's session, targets with "no data" (not zero), upcoming matches. Training: generated week with injury notes. Nutrition and Progress: real targets/milestones plus clearly labelled "coming" states. Profile: edit personal info, targets (versioned, recalculate with preview), health (status updates, delete all), training/nutrition preferences (regenerates the plan), equipment, theme, legal, sign out |

## 2. Files

See `git log --stat claude/pace-spec-review-usad8z`. Main areas:

- `app.config.ts`, `eas.json`, `.env.example`, `eslint.config.js`, `tsconfig.json`, `package.json`
- `supabase/config.toml`, `supabase/migrations/*`, `supabase/tests/database/*`, `supabase/seed/dev.sql`
- `src/app/**` (36 route files), `src/components/**`, `src/domain/**`, `src/features/**`, `src/theme/**`, `src/integrations/supabase/**`
- `tests/unit/**`, `tests/component/**`, `tests/integration/**`, `tests/e2e/**`, `tests/fixtures/**`
- `scripts/verify-migrations.sh`, `scripts/sql/supabase-shim.sql`, `scripts/e2e-web.sh`
- `docs/decisions.md`, `docs/migrations.md`, `README.md`

## 3. Database migrations

| File | Purpose |
|---|---|
| `20261108000100_foundation_helpers.sql` | `pgcrypto`, `set_updated_at()`, no default privileges for `anon` |
| `20261108000200_profiles.sql` | `profiles`, sign-up trigger, RLS |
| `20261108000300_goals_preferences_equipment_consents.sql` | `user_goals`, `user_preferences`, `user_equipment`, `consents` (append-only) |
| `20261108000400_health_conditions.sql` | `health_conditions` |
| `20261108000500_targets_plans_recurring.sql` | `nutrition_targets` (versioned, never deleted, floor check), `training_plans`, `recurring_events` |
| `20261108000600_complete_onboarding.sql` | Atomic onboarding RPC with server-side safety checks |

## 4. Environment variables

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are required. `EXPO_PUBLIC_APP_ENV` and `EXPO_PUBLIC_LEGAL_VERSION` are optional. No server secrets are used in Phase 1. See README §2.

## 5. Commands run and actual results

| Command | Result |
|---|---|
| `npm run typecheck` | ✓ 0 errors |
| `npm run lint` (`--max-warnings 0`) | ✓ 0 errors, 0 warnings |
| `npm test` | ✓ 136 passed, 1 skipped (the DB contract writer, which runs inside `db:verify`), 11 suites |
| `npm run db:verify` | ✓ 6 migrations applied; pgTAP 62/62 passed (RLS isolation 41, onboarding 20, helpers 1); contract test: the app-built payload applied by the real `complete_onboarding()` as an authenticated user → `1,2720,2,1,7` as expected |
| `npm run e2e:web` | ✓ 7/7 checks: sign in → 9 steps → plan shows 2720 kcal / 162 g / 347 g → save → Home → Training, generated week equals spec 25.1, no page errors |
| `npx expo export --platform ios --platform android` | ✓ Hermes bundles for both platforms (≈8.3 MB each) |

Coverage of `src/domain`: about 94% of lines.

The spec's calculation vectors (C1–C13, seed profile 25.1) are all reproduced exactly in `tests/unit/domain/calculations.test.ts`.

### Bugs found and fixed by the tests during Phase 1

1. **`consents` was deletable.** Supabase grants all table privileges to `authenticated` by default. Fixed by revoking all privileges in every migration and granting only what's needed. Found by pgTAP.
2. **Weekly plan put lower-body strength the day before a hard practice, and 7 requested sessions left no rest day.** Found by unit tests.
3. **Duplicate milestone celebrations** ("3 kg lost" and "105 kg reached" are the same moment). Milestones are now deduplicated per threshold.
4. **Onboarding crashed on every step change.** The persisted store's setter returns a Promise, which was returned from a `useEffect`, so React called it as a cleanup function. Found by the browser E2E; a regression test was added.
5. **After saving onboarding, the user was sent back to step 1.** The inactive profile query was only marked stale, and the cleared draft triggered a redirect. Fixed with a forced refetch, a guard on the plan screen, and a self-healing onboarding layout. Found by the browser E2E.
6. **Ambiguous weekday and pain chips for screen readers.** Chip groups are now labelled. Found by the browser E2E.

## 6. Edge cases covered (spec 28)

- **28.1 Auth.** Covered: #1 (no enumeration), #2 (resend with cooldown), #3 (expired links), #4 (cold-start deep link), #6 (sign-out confirmation), #7 (the draft is bound per user, and the query cache is cleared on sign-out), #9 (password rules).
  - Partial: #5 (offline sign-in shows a clear error; offline logging arrives with the Phase 2 outbox).
  - Not yet: #8 (account deleted on another device; handled with account deletion in Phase 7).
- **28.2 Onboarding.** Covered: #1–#12. #13 (timezone stored and editable; `local_date` arrives with logs in Phase 2). #14 and #15 (targets are never silently recalculated: Profile shows a "targets use your old details" prompt and a recalculation preview).
- **28.3 Calculations.** Covered: #1–#9.

## 7. Known limitations and deviations

- **No real-device run yet.** This container has no phone or simulator, and Docker isn't available for `supabase start`. The app was verified with typecheck/lint/tests, native bundle builds, a Postgres + pgTAP verification of every migration, and a browser E2E with a mocked backend. **Before approving Phase 1, run it once on a real phone against a real Supabase project** (README §2–3).
- The Expo and Supabase documentation sites can't be reached from this container. Package versions come from the SDK's `bundledNativeModules.json`, and every API was checked against the installed type definitions.
- The weight shown on Home is the **starting weight** from onboarding. Weight logging, its chart and the first weight entry arrive in Phase 2.
- Training shows the generated weekly pattern. Dated sessions, the calendar and workout execution are Phase 3 (`docs/decisions.md` #4).
- Data export and account deletion are listed in Profile as "available before public release" (Phase 7).
- The legal texts are written for V1 but marked as drafts. They need review before public release.
- Not implemented in Phase 1 by design: offline outbox (Phase 2), notifications (Phase 6), avatar upload.

## 8. Manual setup still required

1. Create the Supabase project (EU region), run `npx supabase db push`, and set the auth URLs (README §2).
2. Fill in `.env.local`.
3. For production: a custom SMTP sender for auth emails (Supabase's default sender is rate-limited), app icons and a splash screen in PACE branding, an EAS project ID (`eas init`), and Apple/Google developer accounts.

## 9. Next phase

**Phase 2: Dashboard and progress.** Planned work:

1. Migrations for `weight_entries`, `body_measurements`, `user_milestones` and `daily_checkins`, with RLS and pgTAP. Backfill the first weight entry from each active goal.
2. An offline outbox (expo-sqlite) and sync engine, used first by weight, measurements and check-ins.
3. Weight logging with outlier confirmation and undo, plus a weight chart (victory-native: 7-day average, targets, ranges) and its statistics.
4. Measurements and their charts.
5. A milestone engine that unlocks idempotently on the 7-day average.
6. The goal-reached flow.
7. The daily check-in.
8. Dashboard updates.
