# CLAUDE.md — PACE

Guidance for coding agents working in this repository.

## Source of truth

- `docs/PACE_SPEC.md` is the complete product and engineering specification. Read it before any work. Where anything else conflicts with it, the spec wins.
- `PACE_Specification.pdf` is generated from the spec for human reading. Never edit the PDF; edit the Markdown and run `python3 docs/tools/build_pdf.py`.
- Record decisions that deviate from or clarify the spec in `docs/decisions.md` (date, decision, reason).
- Every change or improvement updates `docs/PACE_SPEC.md` in the same branch, and the PDF is rebuilt (`python3 docs/tools/build_pdf.py`, needs reportlab).

## How to work

1. Implement **one phase at a time** (spec Section 26). Do not start the next phase until the current one is reviewed and approved.
2. Before each phase: inspect the repo, then write a short plan listing the files you will create or change.
3. After each phase: run typecheck, lint, unit tests and RLS tests, and deliver the Phase Report (spec Section 31) with **actual** command output.
4. Do not add features outside the current phase. If a requirement is unclear or impossible, ask, or record the decision in `docs/decisions.md`.

## Architecture rules

- Expo Router routes live in `src/app` and stay thin.
- All business logic (calculations, GPS filtering, totals, scheduling, milestones, recommendations) lives in `src/domain` as pure TypeScript: no React, no I/O, time passed in as a parameter.
- Only repositories in `src/features/*/api` or `src/integrations/*` talk to Supabase or external APIs. UI components never call them directly.
- All external data is validated with zod and normalised before use.
- TypeScript strict; no `any`; use the generated Supabase types (`supabase gen types typescript`).
- Every screen implements loading, empty, error and success states.
- Store metric units internally; convert only in the UI. Store `timestamptz` (UTC) plus a `local_date` fixed at event time.
- Every user-created row uses a client-generated UUID; writes go through the offline outbox (spec Section 18).

## Database

- Every schema change is a new migration in `supabase/migrations/`; never edit an applied migration or change the database by hand.
- RLS on every table, with pgTAP isolation tests in `supabase/tests/`.
- `user_id` on every user-owned table, including child tables, with `on delete cascade`.
- Development seed data (`supabase/seed/dev.sql`) is never applied to production. Never hardcode the example user.

## Safety and honesty (non-negotiable — spec Section 3)

- Not a medical device: never diagnose, never recommend training through pain, never override injury restrictions.
- Calorie targets never go below the safety floor, and are never changed without user confirmation.
- Never invent recipe quantities or nutrition; "Nutrition unavailable" is a valid state.
- Label estimates (TDEE, calories burned, projections, GPS distance) as estimates.
- No fake functionality and no fake success messages; hide or label anything unfinished.
- Never silently discard user data.

## Security

- The app uses only the Supabase URL and publishable (anon) key. Service role keys and API keys (e.g. TheMealDB) live only in Edge Function secrets.
- Never commit `.env` files or secrets.
- Never send weight, food, health or location data to logs, analytics or crash reports.

## Testing

- Every formula and every edge case marked (T) in spec Section 28 needs an automated test; test vectors in spec Section 29 must match exactly.
- Tools: jest-expo (unit/component), pgTAP via `supabase test db` (RLS), Maestro (E2E).

## Git

- Small, focused commits with descriptive messages.
- Do not commit generated build output, `node_modules`, or `.env*` files.
