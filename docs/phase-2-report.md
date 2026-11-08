# Phase 2 report: Dashboard and progress

Date: 2026-11-09 · Spec sections: 8.9, 13, 14, 18, 25.5, 26 (Phase 2), 28.4, 28.8, 28.10

## 1. Summary

You can now log weight, body measurements and a daily check-in, online or offline. A weight chart shows a 7-day average and honest statistics, milestones unlock like achievements under health-safe rules, the app handles reaching your goal, and the Home dashboard shows all of it.

| Area | Delivered |
|---|---|
| Schema | `weight_entries`, `body_measurements`, `daily_checkins` (one per day), `user_milestones` (unique, never revoked), RLS. The onboarding weight becomes the first weight entry (trigger and backfill) |
| Offline sync | SQLite outbox on phones (AsyncStorage on web). Writes show instantly and sync in the background: after each write, when the app returns to the foreground, when the network comes back, and every 60 s. Network errors retry with backoff, an expired session is refreshed, rejected writes stay visible with Retry/Discard, and nothing is dropped silently. Sync status screen and banner |
| Weight | Log, edit and delete (works offline). A "Is this correct?" check for likely typos (e.g. 180 instead of 108). Future dates and dates before birth are blocked. 5-second Undo |
| Weight chart | Daily points, a 7-day average line that breaks across gaps of more than a week, start/target/secondary lines, tap a point to inspect it, a screen-reader summary, ranges from 7D to All |
| Weight statistics | Current weight (7-day average), change since start, last 7 and 30 days ("Not enough data" instead of a fake 0), goal progress %, an estimated target-date range from the 21-day trend (only with a downward trend) |
| Measurements | 10 body sites, a multi-entry form (cm or in), per-site latest value, change since first, mini trend charts, delete |
| Daily check-in | Sleep, tiredness, soreness, pain + body area, note. Pain of 4 or more keeps a "rest that area, consider professional advice" message on screen |
| Milestones | Weight (1, 3, 5 kg, every 5 kg, round numbers, target, secondary target), 7- and 30-day logging streaks, 30 weigh-ins within 45 days. Unlocked on the 7-day average; idempotent; one toast for several at once; never revoked; milestones screen |
| Goal | Edit goal (same type: edited in place; new type: a new goal starting from current weight). When the 7-day average reaches the target: go for the secondary target, switch to maintenance, or set a new goal. Targets are recalculated from current weight and only change after you confirm |
| Home | Quick actions, weight + goal progress, check-in prompt, today's plan, targets, recent milestones, upcoming matches, sync banner. Sign-out first tries to sync and warns about unsynced changes |

## 2. Branches

`feature/p2-schema` → `feature/p2-offline-sync` → `feature/p2-weight` → `feature/p2-measurements-checkin` → `feature/p2-milestones-goal` → `feature/p2-dashboard`. All of them are merged into `claude/pace-spec-review-usad8z`.

## 3. Database migrations

| File | Purpose |
|---|---|
| `20261109000100_progress_tracking.sql` | 4 tables, RLS and grants, the first-weight trigger, and a backfill for existing users |

## 4. Environment variables

No changes.

## 5. Commands run and actual results

| Command | Result |
|---|---|
| `npm run typecheck` | ✓ 0 errors |
| `npm run lint` | ✓ 0 errors, 0 warnings |
| `npm test` | ✓ 192 passed, 1 skipped (DB contract writer), 15 suites; `src/domain` line coverage ≈ 96% |
| `npm run db:verify` | ✓ 88/88 pgTAP (26 new); contract test `1,2720,2,1,7,1` (now also checks the onboarding weight entry) |
| `npm run e2e:web` | ✓ 12/12: onboarding (as in Phase 1), then 3 weights logged across 3 days, synced through the outbox, "First 1 kg lost" unlocked once on the 7-day average, Home shows 106.2 kg, check-in with pain 5 synced and shows the rest guidance, no page errors |
| `expo export` iOS + Android | ✓ bundles build (≈9 MB each) |

### Problems found by tests and fixed

- The browser E2E showed the 7-day average line was invisible when only one day had an average. It's now drawn as a dot.
- The Progress tab links to measurements, milestones and check-in were missing (a scripted edit hadn't applied). Every other edit was audited after this.
- `verify-migrations.sh` could talk to a leftover server from an earlier run. It now refuses to start if its port is in use.
- The E2E confirmed the app correctly doesn't unlock "First 1 kg lost" when one light weigh-in is averaged with the same day's onboarding weight. The test data was wrong, not the app.

## 6. Edge cases covered (spec 28)

- **28.4 Weight.** Covered: #1 (daily mean), #2 (future blocked), #3 (typo check), #4 (no average with fewer than 3 days), #5 (gaps break the line), #6 (unit switch is display-only), #7 (deleting an entry never revokes a milestone), #8 (goal-reached flow), #9 (no date without a downward trend; neutral wording), #10 (last write wins).
- **28.8 Milestones.** Covered: #1 (unique key + outbox key), #2 (one toast for many), #3 (locked ones follow the goal; unlocked ones kept, including from earlier goals), #4 (never revoked or re-awarded), #7 (missing data shows "No data" / "Not enough data").
- **28.10 Sync.** Covered: #1 (create + delete → nothing sent), #2 (FIFO with parent ordering), #3 (rejected → failed, visible, not retried endlessly), #4 (backoff, idempotent upserts).
- **28.1 #6 and #7.** Sign-out warning; outboxes are per user.

## 7. Known limitations and deviations

- Charts use react-native-svg instead of victory-native (`docs/decisions.md`, Phase 2 #5).
- Sign-out keeps unsynced changes on the phone instead of clearing them (#6).
- Progress photos are V1.1, as planned in the spec.
- Check-ins are stored, but only used for the immediate pain/tiredness messages. Recovery recommendations come with the coach in Phase 6.
- The 30-day streak looks at the last 60 days of check-ins plus all weights and measurements.
- **Not yet run on a real phone or against a real Supabase project.** Please include Phase 2 in your device test. On an offline phone, log a weight in airplane mode, kill the app, reopen it, turn the network back on, and check that the entry syncs once.

## 8. Manual setup

Run `npx supabase db push` to apply the new migration to your project.

## 9. Next phase

**Phase 3: Training.** Planned work:

1. Exercise library (seed from spec 25.2, custom exercises).
2. Workout templates (25.3) with short versions and injury-safe alternatives.
3. Dated scheduled workouts generated from the weekly plan and recurring events (idempotent, DST-safe).
4. Week and month calendar (move, skip, recurring edits).
5. Workout execution (sets, reps, weight, rest timer, drafts that survive an app kill, a pain button).
6. Workout summary with RPE.
7. Workout history.
8. Logging sport events.
9. Progression suggestions.
10. Training milestones and strength PRs.
