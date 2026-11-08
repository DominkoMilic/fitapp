# PACE — Personal Fitness & Nutrition Platform

A mobile fitness coach, workout planner, nutrition tracker and activity tracker for iOS and Android.

**Status:** planning complete — implementation has not started. Next step: Phase 1 (Foundation).

## Documents

| File | What it is |
|---|---|
| [`PACE_Specification.pdf`](PACE_Specification.pdf) | Full specification as a PDF, for reading (60 pages, with clickable contents) |
| [`docs/PACE_SPEC.md`](docs/PACE_SPEC.md) | The same specification in Markdown — the source of truth for the coding agent |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for the coding agent in this repository |
| [`docs/tools/build_pdf.py`](docs/tools/build_pdf.py) | Regenerates the PDF from the Markdown |

## Specification at a glance

- **Stack:** React Native · Expo · TypeScript (strict) · Expo Router · Supabase (Postgres, Auth, Storage, Edge Functions) · TanStack Query · Zustand · React Hook Form + Zod · Expo SQLite · victory-native · react-native-maps · Jest + pgTAP + Maestro.
- **Tabs:** Home · Training · Nutrition · Progress · Profile.
- **V1 scope:** auth and onboarding, transparent calorie/macro targets, weight and measurement tracking, training calendar and workout execution (injury-aware), nutrition logging with food catalogue and recipes, walk/run/cycle GPS tracking, rule-based daily coach, milestones, personal records, weekly report, offline sync, data export, account deletion.
- **Later:** V1.1 barcode scanning, progress photos, monthly reports · V2 HealthKit/Health Connect, AI coach · Future social and subscriptions.

## Implementation phases

1. Foundation — project, auth, database + RLS, design system, onboarding, calculations
2. Dashboard and progress — weight, measurements, goals, milestones
3. Training — exercise library, plan generator, calendar, workout execution
4. Nutrition — food logging, recipes, meal planner, shopping list
5. GPS activity tracking
6. Personal coach — recommendations, recalibration, weekly reports, notifications
7. Production readiness — tests, privacy workflows, store submission

Each phase ends with a Phase Report (spec Section 31) and requires review before the next one starts.

## Starting development

Give the coding agent `docs/PACE_SPEC.md` and the Phase 1 kickoff prompt from spec Section 32. Setup, environment variables and launch instructions will be added to this README during Phase 1.

## Updating the PDF

After editing `docs/PACE_SPEC.md`:

```bash
pip install reportlab   # once; also needs DejaVu fonts (fonts-dejavu-core on Debian/Ubuntu)
python3 docs/tools/build_pdf.py
```
