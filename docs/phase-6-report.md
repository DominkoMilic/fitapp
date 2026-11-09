# Phase 6 report: Personal coach

Date: 2026-11-09 · Spec sections: 8.9, 8.11, 14, 15, 16, 17, 25.5, 26 (Phase 6), 28.8, 28.9, 29.3

## 1. Summary

PACE now coaches you day to day, and adjusts your calorie target with you.

| Area | Delivered |
|---|---|
| Daily coach | All 18 rules from spec 15.2 (safety S1–S4, recovery R1–R5, training T1–T2, nutrition N1–N3, weight W1–W2, consistency C1–C2) as pure, tested functions. Home shows the top 3 cards with "Why am I seeing this?", an action button where useful, and Dismiss (hidden until tomorrow). Safety and recovery cards suppress training pushes. New users see only onboarding tips. Protein ideas follow your diet (vegan, vegetarian, pescatarian) |
| 2-week review | Runs when the app opens: at least 14 days since the last check and 21 days on the current target, weight-loss goals only. Uses adherence (complete food days), the 21-day weight trend, and observed burn = intake − trend × 7700. Proposes +150 kcal for losing over 1% of body weight a week, or −100 kcal when slow on two checks in a row (never below the floor, never when you've been tired). Otherwise "On track", or a friendly "log a few more full days". Every check is recorded with all its inputs |
| Review screen | Shows the proposal with its numbers (complete days, average intake, trend, estimated burn). **Accept** creates a new target from tomorrow in one database transaction; **Keep my current target** records your decision. History of past reviews |
| Training load | RPE × minutes per session; a load spike is the last 7 days above 1.3 × your usual week (needs 4 weeks of data). Shown in the weekly report and used for a soft "consider an easier day" card |
| Weekly report | Weight (start vs end 7-day average, trend), workouts done vs planned, training minutes and load, activities and distances, average kcal and protein **on complete days only** ("based on 3 of 7 days"), water, milestones. Every metric says "No data" rather than showing zero. The current week is live and marked "In progress". Past weeks are saved when first opened, so later edits don't rewrite them. Last 12 weeks are listed |
| Reminders | Workout (30 min / 1 h / 2 h before, 09:00 without a time, not on rest days), match (19:00 the evening before), weigh-in, meals (up to 3), water (up to 3), weekly report, and a "Rest over" alert during workouts. Quiet hours 22:00–07:00 (moved to 07:00 or dropped), at most 4 a day, 14 days ahead within the iOS limit. Rescheduled on app start, return to the app, and any plan, setting, timezone or day change. Permission is asked only when you switch a reminder on. Lock-screen text never shows weight or health details. Taps open the right screen |
| Milestones | Consistent weeks (4 and 12 weeks with at least 80% of planned workouts done). The logging streak now counts food, water, workouts and activities too |

## 2. Branches

`feature/p6-schema` → `feature/p6-domain` → `feature/p6-coach` → `feature/p6-reports` → `feature/p6-notifications`, merged into `claude/pace-spec-review-usad8z`.

## 3. Database migrations

| File | Purpose |
|---|---|
| `20261113000100_coach.sql` | `target_adjustments` (audit of every check; inputs read-only; no deletes), `accept_target_adjustment()` RPC (matches the proposal, respects the floor, at most one accepted change per 14 days, supersedes other proposals), `weekly_reports` (one snapshot per week), RLS |

**Already applied to your hosted project** through the dashboard (16 migrations; verified: 7 policies, the RPC and the guard trigger).

## 4. Configuration

- New package: `expo-notifications` (config plugin added; Android `POST_NOTIFICATIONS` declared).
- No new environment variables.

## 5. Commands run and actual results

| Check | Result |
|---|---|
| `npm run check` (typecheck, lint with 0 warnings, seed and shared-code checks, tests) | ✓ 366 passed, 1 skipped |
| Coach domain coverage (rules, recalibration, load, report, planner) | 99% of lines |
| **Exit: every rule has trigger and non-trigger tests** | ✓ 18 of 18 (one table-driven test asserts all rule ids are covered) |
| **Exit: recalibration vectors** | ✓ W5 (observed burn 2920, −100 kcal), W6 (no proposal, adherence message), W7 (+150 kcal) |
| **Exit: notifications respect caps and quiet hours** | ✓ 4 per day with priority order, quiet-hours move/drop, 60 pending, nearest 14 days, nothing in the past, no weight or health words |
| Timezone conversion | ✓ Zagreb winter and summer, New York, UTC, and a time skipped by the spring DST change |
| `npx supabase test db` on the local stack | ✓ 191/191 (19 new: proposals, direct accept refused, read-only inputs, no deletes, mismatch refused, **floor enforced**, accept creates the version and keeps the old one, 14-day limit, reject, isolation, account deletion) |
| Browser, full stack (local Supabase + web app) | ✓ with 3 weeks of data (losing 1.3 kg a week, 18 of 21 complete days): the review ran on app open → Home showed "Your 2-week review is ready" → review showed 2720 → 2870 kcal, burn ≈ 4087 kcal → Accept → DB: proposal accepted, new target 2870 from tomorrow (protein 162, fat 76 unchanged, carbs 347 → 384), old version kept. Weekly report: live week "In progress", past week stored as a snapshot and shows "No data" where there is none. Reminders screen renders (web says reminders are delivered by the phone app) |
| `expo export` web, iOS and Android | ✓ all three bundle |

### Problems found and fixed

1. **Rest days were counted as workouts.** In real data, the week showed "1 of 7" instead of "1 of 6". The same cause would have fired "Missed yesterday's session?" every day after a rest day, and scheduled workout reminders on rest days. All three are fixed, and tests now include rest days.
2. The review card's title and text were identical; the text now explains what the review is.
3. "1 weigh-ins" now reads "1 weigh-in".
4. Two test fixtures were wrong (a missing field and a lint rule on form state). These were code fixes; the behaviour didn't change.

## 6. Edge cases

**28.8 Milestones, records, reports**

| # | Case | Handling | Test |
|---|---|---|---|
| 1 | Same milestone twice | Unique row per key | ✓ (Phase 2) |
| 2 | Bulk unlock | One summary toast | ✓ (Phase 2) |
| 3 | Goal changed | Locked weight milestones regenerated | ✓ (Phase 2) |
| 4 | Weight regained | Never revoked or re-awarded | ✓ |
| 5 | Poor GPS | Excluded from records and report distances | ✓ |
| 6 | Source deleted | Records recalculated (derived) | ✓ |
| 7 | Week with no weigh-ins | "No data" | ✓ |
| 8 | 3 complete days of 7 | "based on 3 of 7 days" | ✓ |
| 9 | Current week | "In progress" | ✓ |

**28.9 Coach and notifications**

| # | Case | Handling | Test |
|---|---|---|---|
| 1 | Fatigue + workout push | Recovery card wins; push suppressed | ✓ |
| 2 | Dismissed card | Hidden until tomorrow | ✓ |
| 3 | New user | Onboarding tips only | ✓ |
| 4 | Injury + match tomorrow | S3 and R1, never "play" advice | ✓ |
| 5 | Permission denied | In-app only; screen explains and links to Settings | UI |
| 6 | More than 64 needed | Nearest 14 days within the limit | ✓ |
| 7 | Quiet hours | Moved to 07:00 or dropped | ✓ |
| 8 | Timezone change | Plan uses the profile timezone; any change reschedules | ✓ conversion |

## 7. Known limitations

- **Reminders and the rest-over alert need the phone app** (a development build). The web app saves the settings but can't schedule notifications.
- The review needs a connection to accept or decline (spec 18.1 doesn't include it for offline).
- The 2-week review applies only to weight-loss goals.
- Training load ignores activities (they have no effort rating).

## 8. Manual steps

None for the database: it's already up to date on your hosted project. For your final test:

1. Build a development client (`npx eas-cli@latest build --profile development --platform ios`, or `android`) to test GPS in the background and the reminders.
2. In the app, open **Profile → Reminders** and switch one on. You'll be asked for notification permission once.

## 9. Next phase

**Phase 7: Production readiness** (spec 26): data export, the account deletion function, privacy policy and terms content, an accessibility audit, performance (start under 2 s on a mid-range phone, virtualised lists), Maestro E2E flows, optional Sentry, EAS production config, store listing and privacy labels (health, fitness, location), the real-device test matrix, and submission.
