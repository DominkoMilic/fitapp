# Report: manual workouts, your own durations and editing

Date: 2026-11-09 · Spec sections: 10.4, 18.2, 23

## 1. Found on the phone (Galaxy A34, live account)

| Finding | Fix |
|---|---|
| A workout done without the timer was saved as 0:53, with ≈6 kcal | Duration to save: Timer / Planned / **Enter time**; a hint when the timer ran under 5 min or over 4 h |
| No way to add an exercise the plan didn't include | **+ Add an exercise** in the live workout and in the editors (library search, injury-aware) |
| Sets could be added but not removed | Remove (✕) on sets that aren't done |
| You could only finish from the last exercise | **Finish** in the header, with a confirmation about unfinished exercises |
| Timed holds had no timer | **Start** countdown per timed set; marks the set done |
| No way to log a workout done without the app | **Log a past workout** and **I already did this** |
| Saved workouts could only be deleted | **Edit workout**: time, duration, sets, exercises, effort |
| A completed planned workout only showed the plan | **See what you did** links to the saved workout |
| A running workout's page said "Start workout" | "Resume workout" |
| History merged warm-up and main sets of the same exercise ("Set 1" twice) | One card per exercise as it was done |
| The header said "Workout"; the big red "It hurts" dominated | Workout title in the header; "It hurts" is a normal secondary button |
| After saving an edit the screen briefly showed the old values | Just-synced writes stay applied until fresh data arrives |
| "1 sets done", empty line on rest days, "— kg", "0 / 100 %", calorie review shown with nutrition off | "1 set done", no empty line, "—", "0%", review hidden |

## 2. Verified on the phone

- Logged "Push-ups at home" (Something else → Push-up, 2 sets → 1 set ticked, RPE 6, 45 min) and saw it in history (then deleted it).
- Live workout: added push-ups after the warm-up (pre-filled 15 reps from the last time), Finish from the header with the confirmation, "Enter time" on the summary, and the future-time check ("That would end in the future…"). Then discarded.
- Edited today's Strength B: changed the time, saved, and the history and order updated. **Restored afterwards to 20:48 · 1 min** (the original was 0:53; the form's minimum is 1 minute).
- "See what you did" opens the saved workout; Home shows "0%"; Progress shows "—" without a unit and no calorie review.

## 3. Commands

| Check | Result |
|---|---|
| `npm run check` | ✓ 488 passed, 1 skipped (new: workout-log domain 10, workout editor component, synced-overlay test) |
| `npx supabase test db` | ✓ 244/244 (no migration) |
