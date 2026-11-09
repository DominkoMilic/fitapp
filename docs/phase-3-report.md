# Phase 3 report: Training

Date: 2026-11-09 · Spec sections: 10, 14.3, 25.2–25.4, 26 (Phase 3), 28.5

## 1. Summary

PACE now plans, adapts and tracks training. Your weekly plan turns into a real calendar for the next 8 weeks. Every workout is built for your equipment and current injuries, a workout runs set by set (and survives the app being killed), and history, personal records and training milestones follow from it.

| Area | Delivered |
|---|---|
| Exercise library | 56 exercises (spec 25.2), each with 3–4 step instructions, caution notes, equipment and contraindication tags. Search, category filter, "safe for my injuries", "equipment I have". Custom exercises (work offline; archived rather than deleted so history keeps them) |
| Templates | 9 templates (spec 25.3): Strength A, Strength B, ankle-safe Strength B, Full body 45, Full body 20, low-impact conditioning, Recovery, Mobility 15, Futsal skills. Warm-up and cool-down, injury-safe alternatives |
| Adaptation | Built at start time from your current injuries and equipment: swaps to alternatives, removed exercises listed with the reason, "recovery is better today" when fewer than 3 main exercises remain |
| Calendar | 8 weeks generated from the weekly plan and recurring matches. Week view (Training tab) and month view. Move with warnings (match the next day, third hard day in a row), skip/restore, one-off workouts, edit or end a recurring session (future only), "short on time?" 20-minute version |
| Workout runner | Sets pre-filled from last time, reps/weight/time (kg or lb), progression hint for 5 kg equipment, instructions, rest timer that stays correct in the background, pause, skip, add set, "It hurts" button (stops the exercise, never "push through"), resume after the app is killed |
| Summary | Duration (excluding pauses), sets, volume, calories (labelled estimate), RPE, feeling, notes, a check for workouts over 4 hours, discard. Saved offline and marks the calendar entry done |
| Sport | Log a match or practice with duration and RPE; caution when your injury isn't cleared for sport |
| History and records | History list and detail (sets per exercise, pain flags), delete. Personal records: push-ups, plank, best reps at your heaviest weight, most minutes in a week. Calculated from history |
| Milestones | First workout, 5/10/25/50/100 workouts, 10/25 strength sessions, 10/25/50/100 hours of training |

## 2. Branches

`feature/p3-schema` → `feature/p3-domain` → `feature/p3-library` → `feature/p3-calendar` → `feature/p3-workout` → `feature/p3-history`, all merged into `claude/pace-spec-review-usad8z`.

## 3. Database migrations

| File | Purpose |
|---|---|
| `20261110000100_training.sql` | `exercises` (system and custom), `workout_templates`, `workout_template_exercises`, `scheduled_workouts` (occurrence key), `workout_sessions`, `exercise_sets`, RLS |
| `20261110000200_training_seed.sql` | **Generated** from the catalogue: 56 exercises, 9 templates, 80 template rows |

## 4. Environment variables

No changes.

## 5. Commands run and actual results

| Command | Result |
|---|---|
| `npm run check` (typecheck, lint with 0 warnings, seed-up-to-date check, tests) | ✓ 233 passed, 1 skipped; domain line coverage ≈ 97% |
| `npm run db:verify` | ✓ 112/112 pgTAP (24 new: catalogue integrity, custom exercise isolation, system rows read-only, idempotent occurrences, sessions/sets isolation, cascade delete); contract test ✓ |
| `npm run e2e:web` | ✓ 19/19. On top of Phases 1–2: calendar generated from the plan; add Full body 20 today; start it; complete all 9 sets; finish; RPE; save. One session plus 9 sets synced, the one-off workout marked completed, "First workout" unlocked, history shows it, no phantom workout after saving, no page errors |
| `expo export` iOS + Android | ✓ (≈9.1 MB each) |

### Bugs found by tests and fixed

1. `stableUuid` could produce a negative hex value, i.e. an invalid UUID (found by the database seed).
2. `verify-migrations.sh` didn't stop its temporary server (`pg_ctl` refuses to run as root). This explains the orphaned servers in Phase 2.
3. When an alternative was already in the workout, the original exercise was dropped without being reported (unit test).
4. Saving a pain check-in remounted the form, so the "saved" state and "Done" button vanished (browser E2E).
5. After saving a workout, the screen underneath started a new empty workout, a "phantom workout" (browser E2E).
6. The summary counted warm-up sets as done but not as planned ("9 of 8").
7. A cross-user pgTAP test passed for the wrong reason (RLS hid the ID it looked up), so it now uses a fixed ID.

## 6. Edge cases (spec 28.5)

All covered:

- #1 move warnings
- #2 and #3 recurring "this and future" edits and series end
- #4 idempotent generation (unit + pgTAP)
- #5 DST: the 20:00 match stays at 20:00
- #6 resume after the app is killed
- #7 rest timer in the background
- #8 the over-4-hours check
- #9 abandoned status
- #10 bodyweight volume
- #11 adjusted at start time (decision #2)
- #12 archived custom exercises keep their names in history
- #13 an injury added later re-filters workouts
- #14 alternative also unsafe → removed, plus the "recovery instead" suggestion
- #15 two devices create two sessions; the occurrence is completed once

## 7. Known limitations

- **Not yet tested on a real phone or against a real Supabase project.** Please include Phase 3 in your device test (see §8).
- The rest timer doesn't send a notification yet. Local notifications are Phase 6. The timer itself stays correct when the app is backgrounded.
- Calendar generation and recurring-series edits need a connection. Moves, skips, one-offs and workouts work offline.
- Exercise media (videos and images) is empty until licensed media is available, as the spec requires.
- Training load is stored (RPE × minutes), but recovery recommendations based on it come with the coach in Phase 6.

## 8. Manual steps

1. Run `npx supabase db push` to apply the two new migrations.
2. On the phone:
   1. Open Training and check the week matches your plan.
   2. Start a workout.
   3. Kill the app partway through, then reopen it and resume.
   4. Finish and save the workout.
   5. Check that History, Personal records and the "First workout" milestone show it.

## 9. Next phase

**Phase 4: Nutrition.** Planned work:

1. Food catalogue (USDA subset) and custom foods.
2. Meal logging with nutrition snapshots, saved meals and water.
3. "Day complete" status.
4. TheMealDB recipes through an Edge Function proxy, with honest "nutrition unavailable" handling.
5. Recipe measure parser and servings scaling.
6. User recipes built from foods.
7. Meal planner.
8. Shopping list.
