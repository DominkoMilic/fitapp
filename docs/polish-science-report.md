# Report: touch polish, nutrition switch, science pass

Date: 2026-11-09 · Spec sections: 6.5, 7, 8.4, 8.6, 8.7, 10.2, 15.2, 17, 20, 23.2, 23.5, 25.3

## 1. Summary

| Area | Delivered |
|---|---|
| Touch feedback | Every button, card, row, chip, segment and toggle springs slightly smaller and dims while pressed (native driver, no bounce). Reduce motion leaves only the dim |
| Transitions | One slide for screen pushes on Android and iOS, modals slide up, onboarding cross-fades, tabs shift. List rows fade in, fade out and slide when reordered |
| Haptics | Selection ticks (chips, segments, toggles), a light tap on primary actions, a success pulse after saving. Off on web and with reduce motion |
| Labels | One-word labels never break inside the word. Segments share space by label length, so "Breakfast" fits |
| Nutrition switch | Settings → App features, or the onboarding question "Track food in PACE?". Off hides the Nutrition tab, food on Home, calorie targets, water, food reminders, the nutrition coach cards and the two-week calorie review. Nothing is deleted, and switching back on is instant |
| Nutrition science (v2.1.0) | 500 kcal maximum deficit with 4+ hard sessions a week; a carbohydrate note for sport players under 3 g/kg; a training-day hydration note. The spec 29 vectors are unchanged |
| Training science | RAMP dynamic warm-up in every sport pack; ≥ 90 s rest for sprint-type drills; ≤ 30 jump contacts per pack; smarter placement of the sport-skills session |
| Expert review pack | `docs/expert-review-pack.md`: every number with its source and status, questions for the dietitian, physiotherapist and S&C coach, and a sign-off table for the drill packs |

## 2. Database

| Migration | What it does |
|---|---|
| `20261116000100_nutrition_toggle.sql` | `user_preferences.nutrition_enabled` (default on); onboarding saves it; older payloads keep it on |
| `20261116000200_training_seed_warmup.sql` | Generated seed: 93 exercises (6 new warm-up exercises), 20 templates with the new warm-ups and dosage |

## 3. Commands run and actual results

| Check | Result |
|---|---|
| `npm run check` | ✓ 477 passed, 1 skipped |
| `npx supabase db reset` + `npx supabase test db` | ✓ 244/244 (new: `92_nutrition_toggle` 5) |
| Browser, local stack, 384 px wide | ✓ segments and button rows without broken words; nutrition off removes the tab, Home card and nutrition settings, and old links show "Nutrition is turned off"; back on shows the same targets (2,900 kcal) |

## 4. Mistake caught

Regenerating the training seed overwrote an already-applied migration. It was restored from git, and the generator now writes a new migration. The rule is in the generator's comment.

## 5. Still needs people

- The experts' answers to `docs/expert-review-pack.md`
- Haptics and transitions checked on a real phone (the APK build is in the next step)
