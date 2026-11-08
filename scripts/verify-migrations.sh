#!/usr/bin/env bash
# Applies all migrations + pgTAP tests to a throwaway local PostgreSQL cluster.
#
# Prefer `npx supabase start && npx supabase test db` when Docker is available — that runs
# the real Supabase stack. This script is a fallback for environments without Docker.
#
# Requirements: PostgreSQL 15+ server binaries (initdb, pg_ctl) and the pgTAP extension.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PORT:-55432}"
export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

cleanup() {
  if [ "${KEEP_DB:-0}" = "1" ]; then echo "DB kept running: postgresql://postgres@localhost:$PORT/postgres?host=$WORK"; return; fi
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run_as_pg() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
if [ "$(id -u)" = "0" ]; then chown postgres "$WORK"; fi

run_as_pg "'$PG_BIN/initdb' -D '$WORK/data' -U postgres -A trust >/dev/null"
run_as_pg "'$PG_BIN/pg_ctl' -D '$WORK/data' -o '-p $PORT -k $WORK -c listen_addresses=localhost' -l '$WORK/log' -w start >/dev/null"

psql_q() { psql -v ON_ERROR_STOP=1 -q -X "$@"; }

echo "→ Supabase compatibility shim"
psql_q -f "$ROOT/scripts/sql/supabase-shim.sql"

echo "→ Migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  psql_q -f "$f"
done

echo "→ Dev seed"
psql_q -c "create extension if not exists pgtap with schema extensions;"
if [ -f "$ROOT/supabase/seed/dev.sql" ]; then psql_q -f "$ROOT/supabase/seed/dev.sql"; fi

echo "→ pgTAP tests"
status=0
for t in "$ROOT"/supabase/tests/database/*.test.sql; do
  out="$(psql -X -q -t -A -v ON_ERROR_STOP=1 -f "$t" 2>&1)" || status=1
  if echo "$out" | grep -qE "^not ok|ERROR|Looks like"; then status=1; fi
  pass=$(echo "$out" | grep -cE "^ok" || true)
  fail=$(echo "$out" | grep -cE "^not ok" || true)
  echo "   $(basename "$t"): $pass passed, $fail failed"
  if echo "$out" | grep -qE "^not ok|ERROR|Looks like"; then echo "$out" | grep -E "^not ok|#|ERROR" | head -40; fi
done

echo "→ Contract test: app-built onboarding payload → complete_onboarding()"
if [ -f "$ROOT/node_modules/.bin/jest" ]; then
  PACE_PAYLOAD_OUT="$WORK/payload.json" "$ROOT/node_modules/.bin/jest" --rootDir "$ROOT" \
    "$ROOT/tests/integration/onboarding-contract.test.ts" >/dev/null 2>&1 || { echo "   could not build payload"; status=1; }
  if [ -f "$WORK/payload.json" ]; then
    result="$(psql -X -q -t -A -v ON_ERROR_STOP=1 -v payload="$(cat "$WORK/payload.json")" <<'SQL' 2>&1
begin;
insert into auth.users (id, email) values ('eeeeeeee-0000-0000-0000-000000000005', 'contract@example.com');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select public.complete_onboarding(:'payload'::jsonb);
select concat_ws(',',
  (select count(*) from public.profiles where onboarding_completed_at is not null),
  (select kcal from public.nutrition_targets),
  (select count(*) from public.recurring_events),
  (select count(*) from public.health_conditions),
  (select jsonb_array_length(weekly_pattern) from public.training_plans where status = 'active'));
rollback;
SQL
)" || status=1
    echo "   result: $(echo "$result" | tail -1) (expected 1,2720,2,1,7)"
    if [ "$(echo "$result" | tail -1)" != "1,2720,2,1,7" ]; then echo "$result" | head -20; status=1; fi
  fi
else
  echo "   skipped (run npm install first)"
fi

if [ "$status" -ne 0 ]; then echo "✗ verification failed"; exit 1; fi
echo "✓ all migrations applied and all pgTAP tests passed"
