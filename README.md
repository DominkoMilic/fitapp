# PACE: Personal Fitness & Nutrition Platform

A mobile fitness coach, workout planner, nutrition tracker and activity tracker for iOS and Android, built with Expo (React Native) and Supabase.

**Status:** Phases 1–5 (Foundation, Progress, Training, Nutrition, GPS activities) are implemented. Phase 6 (Personal coach) is next, after review. See the phase reports in [`docs/`](docs/).

## Documents

| File                                               | What it is                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| [`PACE_Specification.pdf`](PACE_Specification.pdf) | The full specification as a PDF, for reading                           |
| [`docs/PACE_SPEC.md`](docs/PACE_SPEC.md)           | The same specification in Markdown: the source of truth                |
| [`CLAUDE.md`](CLAUDE.md)                           | Working rules for coding agents in this repository                     |
| [`docs/decisions.md`](docs/decisions.md)           | Decisions that clarify or deviate from the spec                        |
| [`docs/migrations.md`](docs/migrations.md)         | Database migrations, the security model and DB tests                   |
| [`docs/phase-1-report.md`](docs/phase-1-report.md) | What Phase 1 delivered, test results and known limitations             |
| [`docs/phase-2-report.md`](docs/phase-2-report.md) | Phase 2: weight, measurements, check-in, milestones, offline sync      |
| [`docs/phase-3-report.md`](docs/phase-3-report.md) | Phase 3: exercise library, calendar, workouts, history, records        |
| [`docs/phase-4-report.md`](docs/phase-4-report.md) | Phase 4: food logging, USDA catalogue, recipes, planner, shopping list |
| [`docs/phase-5-report.md`](docs/phase-5-report.md) | Phase 5: GPS walk/run/ride recording, routes, manual activities        |

## Tech stack

Expo SDK 58 · React Native 0.88 · TypeScript (strict) · Expo Router · Supabase (Postgres, Auth, RLS) · TanStack Query · Zustand · React Hook Form + Zod · expo-sqlite (offline outbox) · react-native-svg (charts) · Jest + React Native Testing Library · pgTAP · Playwright (web smoke test) · Maestro (device E2E).

## Prerequisites

- Node.js 20 or newer, and npm
- A Supabase account (hosted), **or** Docker for the local Supabase stack
- To run on a phone: the [Expo Go](https://expo.dev/go) app for quick UI checks, or a development build (`eas build --profile development`). Later phases (background GPS) need a development build.
- Optional, for DB tests without Docker: PostgreSQL 15+ and pgTAP (`apt install postgresql-16 postgresql-16-pgtap`)

## 1. Install

```bash
git clone https://github.com/dominkomilic/fitapp.git
cd fitapp
npm install
```

## 2. Configure Supabase

You need a Supabase project and two values from it: the **project URL** and the **anon (publishable) key**.

### Option A: hosted project (recommended for using the app on your phone)

1. Create a project at [supabase.com](https://supabase.com/dashboard). Choose an **EU region** (the app stores health-adjacent personal data; see spec §19).
2. Apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. In the dashboard, go to **Authentication → URL Configuration**:
   - Site URL: `pace://`
   - Redirect URLs: add `pace://auth/callback` and, for Expo Go during development, `exp://**`
4. Under **Authentication → Providers → Email**, keep **Confirm email** turned on.
5. Under **Project Settings → API**, copy the **Project URL** and the **anon / publishable** key. **Never** use the `service_role` / secret key in the app.

### Option B: local stack (Docker)

```bash
npx supabase start      # prints the API URL and anon key
npx supabase db reset   # applies migrations + the dev seed
```

The local `supabase/config.toml` already enables email confirmation, 8-character passwords and the `pace://` redirects. Confirmation emails are caught by the local mail viewer at http://127.0.0.1:55324 (PACE uses the 553xx ports so it can run beside other local Supabase projects). On a physical phone, use your computer's LAN IP instead of `127.0.0.1`.

### Recipes Edge Function

Recipes come from TheMealDB through the `recipes-proxy` Edge Function, so the API key never ships in the app.

```bash
npx supabase functions deploy recipes-proxy                 # hosted project (after `supabase link`)
npx supabase secrets set THEMEALDB_API_KEY=<key>            # optional; defaults to TheMealDB's public test key "1"
npx supabase functions serve recipes-proxy                  # local stack
```

Before release, get a TheMealDB supporter key (the test key is for development only).

### Using the local stack from the app

Expo bundles `.env.local` into development builds, and it wins over shell variables. To point a dev build at the local stack, create `.env.development.local` with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321` and the local publishable key from `npx supabase status`. Delete the file to go back to the hosted project.

### Environment variables

```bash
cp .env.example .env.local
```

| Variable                        | Required | Description                                                            |
| ------------------------------- | -------- | ---------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | yes      | Project URL, e.g. `https://abcd.supabase.co`                           |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes      | Anon / publishable key (safe in the app because RLS protects the data) |
| `EXPO_PUBLIC_APP_ENV`           | no       | `development` (default), `preview` or `production`                     |
| `EXPO_PUBLIC_LEGAL_VERSION`     | no       | Version of the legal documents stored with each consent                |

If a required variable is missing, the app shows a configuration error screen and doesn't fail silently. `EXPO_PUBLIC_*` values are bundled into the app, so never put secrets in them.

## 3. Launch the app

```bash
npm start            # Expo dev server; scan the QR code with Expo Go, or press i / a for a simulator
npm run ios          # iOS simulator (macOS)
npm run android      # Android emulator
npm run web          # browser (handy for quick UI checks)
```

First run: create an account → open the confirmation email **on the same phone** → complete the 9 onboarding steps → your plan is saved and the Home tab opens.

### Development builds and environments

`eas.json` has three profiles. Each sets `EXPO_PUBLIC_APP_ENV` and uses a separate bundle ID, so the builds can sit side by side on one phone:

| Profile       | Use                              | Bundle ID                      |
| ------------- | -------------------------------- | ------------------------------ |
| `development` | Dev client for daily development | `app.pace.fitness.development` |
| `preview`     | Internal test builds             | `app.pace.fitness.preview`     |
| `production`  | Store builds                     | `app.pace.fitness`             |

```bash
npx eas-cli@latest build --profile development --platform ios   # or android
```

**GPS recording needs a development build.** Expo Go can't run background location. Install a `development` build on a real phone to record with the screen locked. For maps on Android, set `GOOGLE_MAPS_ANDROID_API_KEY` (see `.env.example`). Without it, Android shows the route as a shape.

Store the Supabase values per environment in EAS (`eas env:create`), or in `.env.local` for local runs. Use separate Supabase projects for development and production.

## Scripts

| Command                                                 | What it does                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                         | Typecheck + lint (zero warnings) + unit/component tests                                                                              |
| `npm test`                                              | Jest unit and component tests                                                                                                        |
| `npm run typecheck` / `npm run lint` / `npm run format` | Individual checks                                                                                                                    |
| `npm run db:verify`                                     | Applies all migrations to a throwaway PostgreSQL, runs the pgTAP tests and the app↔DB contract test (no Docker needed)               |
| `npm run db:test`                                       | pgTAP tests against the local Supabase stack (`supabase test db`)                                                                    |
| `npm run db:reset`                                      | Rebuilds the local database (Docker)                                                                                                 |
| `npm run db:types`                                      | Regenerates `src/integrations/supabase/database.types.ts`                                                                            |
| `npm run db:seed-training`                              | Regenerates the exercise/template seed migration from `src/domain/training/catalogue.ts` (`npm run check` verifies it is up to date) |
| `npm run db:seed-usda -- <csv dir>`                     | Regenerates the USDA food seed migration from the downloaded SR Legacy CSVs                                                          |
| `npm run functions:sync`                                | Copies the shared parser/normaliser into `supabase/functions/_shared` (`npm run check` verifies it)                                  |
| `npm run e2e:web`                                       | Builds the web bundle and runs the Playwright onboarding smoke test (mocked backend)                                                 |

Device E2E: `maestro test tests/e2e/maestro/onboarding.yaml -e EMAIL=… -e PASSWORD=…` against a development build.

## Project structure

```
src/
  app/            Expo Router routes (thin screens): (auth), onboarding, (tabs), settings, legal
  components/     ui/ (design system), feedback/ (empty, error, loading, banner, dialog), forms/
  domain/         Pure TypeScript: calculations, injury model, weekly plan, milestones, validation
  features/       auth, onboarding, profile, dashboard, legal (hooks, API, feature components)
  integrations/   supabase client + generated database types
  services/       query client
  theme/          tokens + ThemeProvider (dark default, light, system)
  constants/      safety constants (calorie floors, rate limits…)
supabase/
  migrations/     version-controlled schema (RLS on every table)
  tests/database/ pgTAP tests
  seed/dev.sql    development-only seed
tests/            unit/, component/, integration/, fixtures/, e2e/
scripts/          verify-migrations.sh, e2e-web.sh
docs/             spec, decisions, migrations, phase reports
```

## Updating the specification PDF

```bash
pip install reportlab   # once; also needs DejaVu fonts
python3 docs/tools/build_pdf.py
```

## Branches

Phase 1 was built feature by feature. Each branch builds on the one before it:

1. `feature/p1-project-setup`: Expo, TypeScript, lint, tests, env config
2. `feature/p1-supabase-schema`: migrations, RLS, onboarding RPC, pgTAP
3. `feature/p1-domain-calculations`: calculation engine, injury model, weekly plan
4. `feature/p1-design-system`: theme and components
5. `feature/p1-auth`: Supabase auth and routing gate
6. `feature/p1-onboarding`: 9-step onboarding and plan preview
7. `feature/p1-app-shell`: tabs, dashboard, profile editing, E2E

Phase 2 branches, built the same way:

1. `feature/p2-schema`: weight, measurements, check-in and milestone tables
2. `feature/p2-offline-sync`: outbox and sync engine
3. `feature/p2-weight`: weight logging, chart and statistics
4. `feature/p2-measurements-checkin`: measurements and daily check-in
5. `feature/p2-milestones-goal`: milestone engine, goal editing and goal-reached flow
6. `feature/p2-dashboard`: Home dashboard, sync status, E2E

Phase 3 branches: `feature/p3-schema`, `feature/p3-domain`, `feature/p3-library`, `feature/p3-calendar`, `feature/p3-workout`, `feature/p3-history`.

Phase 4 branches: `feature/p4-schema`, `feature/p4-domain`, `feature/p4-logging`, `feature/p4-recipes`, `feature/p4-planner-shopping`.

Phase 5 branches: `feature/p5-schema`, `feature/p5-domain`, `feature/p5-tracking`, `feature/p5-activities`.

`claude/pace-spec-review-usad8z` contains all of them.
