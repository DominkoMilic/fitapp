# Operations

What keeps PACE running after launch. Supabase is the only backend: Postgres, Auth, Storage and Edge Functions.

## Backups

- **Turn on daily backups and point-in-time recovery (PITR)** for the production project: Project settings → Add-ons. The free plan has no PITR; the Pro plan keeps daily backups for 7 days, and PITR is an add-on.
- Backups also contain deleted accounts until they expire. The privacy policy says this. If you change plan or retention, update the policy.
- Route files (Storage `routes`) and recipe photos (`recipe-images`) are not in database backups. Routes can be re-uploaded from phones only while recordings are still on the device. Recipe photos are re-copied from TheMealDB automatically.

## Monitoring

- **Edge Functions:** Supabase → Edge Functions → `recipes-proxy` / `delete-account` → Logs and Metrics. Watch the error rate and 5xx responses. Logs contain only the action and an error class, never user data.
- **Database:** Reports → API and Database. Watch for slow queries; the largest reads are the 90-day food range and the exercise-set history (paged at 1,000 rows).
- **Auth:** Authentication → Logs. Watch for sign-in error spikes, which may mean the SMTP provider is down.
- Set up an alert or an external uptime check on `https://<project>.supabase.co/functions/v1/recipes-proxy`: an `OPTIONS` request should return 200.

## Deploying changes

1. **Migrations first:** `npx supabase db push`. Every migration is additive, and the app tolerates new columns and tables.
2. **Then Edge Functions:** `npx supabase functions deploy recipes-proxy` and `npx supabase functions deploy delete-account`. Both use `verify_jwt = false` from `supabase/config.toml`, because they authenticate the caller themselves.
3. **Then app builds** through EAS. Old app versions keep working against the new schema.
4. **Rollback:** redeploy the previous function version from the dashboard. Database changes are rolled forward with a new migration; never edit an applied one.

## Credentials

- The app only ships the publishable key. If the service role key or a database password ever leaks, rotate it in Project settings → API / Database, then redeploy the functions (they read the injected keys).
- `THEMEALDB_API_KEY` is an optional function secret.

## Incidents

- **Recipe search failing:** the app shows "Recipes need a connection", and food logging still works. Check the function logs and TheMealDB status.
- **Sync failures:** users see "N changes couldn't be saved" with Retry. Nothing is lost on the phone. Check the API logs for 4xx/5xx errors on the affected table.
- **Suspected data exposure:** RLS isolates every table (pgTAP `10_rls_isolation`). Check the policies with `select * from pg_policies` and the auth logs, then follow your GDPR breach process (notify within 72 hours if personal data was affected).
