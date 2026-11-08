# Database migrations

All schema changes live in `supabase/migrations/` as timestamped SQL files. Never edit a migration that has been applied to any shared database. Write a new one instead.

## Current migrations (Phase 1)

| File | Purpose |
|---|---|
| `20261108000100_foundation_helpers.sql` | `pgcrypto`, the `set_updated_at()` trigger function, default privileges (no access for `anon`) |
| `20261108000200_profiles.sql` | `profiles` table, automatic profile creation on sign-up (`on_auth_user_created` trigger), RLS |
| `20261108000300_goals_preferences_equipment_consents.sql` | `user_goals` (one active goal per user), `user_preferences`, `user_equipment`, `consents` (append-only), RLS |
| `20261108000400_health_conditions.sql` | `health_conditions` (special-category health data), RLS |
| `20261108000500_targets_plans_recurring.sql` | `nutrition_targets` (versioned by `effective_from`, never deleted, never below the stored safety floor), `training_plans` (one active per user), `recurring_events`, RLS |
| `20261108000600_complete_onboarding.sql` | `complete_onboarding(payload jsonb)`: saves the whole onboarding result in one transaction and re-checks the safety rules (18+, target BMI ≥ 18.5, weekly rate ≤ 1%, required consents, health-data consent) |

## Security model

- RLS is enabled on every table. Each table revokes all privileges from `anon` and `authenticated`, then grants `authenticated` exactly what it needs (for example, `consents` is insert and select only, and `nutrition_targets` has no delete).
- Policies compare `(select auth.uid())` with `user_id` (`id` for `profiles`).
- Every user-owned table references `auth.users(id) on delete cascade`, so deleting the auth user removes all their rows.
- `complete_onboarding` is `security invoker`, so it runs under the caller's RLS policies. `handle_new_user` is `security definer`, can't be called by clients, and only inserts the caller's own empty profile.

## Tests

pgTAP tests live in `supabase/tests/database/`:

- `00_helpers.test.sql`: helper functions (`tests.create_user`, `tests.authenticate_as`, `tests.become_anon`, `tests.clear_authentication`).
- `10_rls_isolation.test.sql`: user B can't read, update, delete or insert for user A, `anon` can't read anything, and deleting a user cascades.
- `20_onboarding.test.sql`: the profile trigger, every safety rejection in `complete_onboarding`, atomicity (a failed call leaves no partial data), the happy path, and that onboarding can't run twice.

Run them in one of two ways:

```bash
# With Docker (full Supabase stack, recommended)
npx supabase start
npx supabase test db

# Without Docker: throwaway local PostgreSQL + pgTAP + a small Supabase compatibility shim
npm run db:verify
```

`npm run db:verify` needs PostgreSQL 15+ server binaries and the pgTAP extension (`apt install postgresql-16 postgresql-16-pgtap`). The shim in `scripts/sql/supabase-shim.sql` only exists for this script. Never run it on a Supabase project.

## Workflow for a schema change

1. `npx supabase migration new <short_description>` (or create `supabase/migrations/<UTC timestamp>_<description>.sql`).
2. Write the SQL: the table, constraints, indexes, `updated_at` trigger, `revoke`/`grant`, `enable row level security`, and policies.
3. Add or extend pgTAP tests for RLS isolation and constraints.
4. `npx supabase db reset` (with Docker) or `npm run db:verify`.
5. Regenerate types with `npm run db:types` (local stack running). Without Docker, keep a verified DB running with `KEEP_DB=1 npm run db:verify` and run `npx supabase gen types --schema public --remote='postgresql://postgres@localhost:55432/postgres?sslmode=disable'`.
6. Commit the migration, tests and `src/integrations/supabase/database.types.ts` together.

## Deploying to a hosted project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push        # applies pending migrations
```

Seed data in `supabase/seed/dev.sql` is development-only. `db push` does not apply it.
