# Phase 7 report: Production readiness

Date: 2026-11-09 · Spec sections: 19, 23.3, 26 (Phase 7), 27, 28.10, 29.6

## 1. Summary

PACE V1 is feature-complete and set up for release. What remains needs you: a legal review, real-device testing and the store submissions. All of it is listed in [`release/checklist.md`](release/checklist.md).

| Area | Delivered |
|---|---|
| Account deletion | Profile → Your data → Delete my account. You re-enter your password and type DELETE; a warning shows if changes haven't synced. The `delete-account` Edge Function removes your route files, then your account, and every table cascades. It's safe to retry after a failure. The phone is then cleared: outbox, in-progress recording and workout, GPS points, scheduled reminders, drafts. **Deployed to your hosted project** |
| Data export | Profile → Your data → Export. One JSON file with every table of your data, read page by page so years of history work, plus your route files. Shared through the phone's share sheet (a download on web) |
| Legal | Final privacy policy (every data flow, processors, legal bases, retention, rights), terms (outdoor safety, third-party content, liability), expanded health disclaimer (when to stop, when to see a professional first, eating disorders), and a new **data sources and licences** page. All reachable from onboarding and Profile |
| Accessibility | Automated WCAG contrast test for both themes; 5 colour pairs fixed. Decorative images hidden from screen readers. Static scan: every tappable element has a role |
| Performance | Long lists are virtualised (weight history, workout history, activities, exercise library). Workout history counts sets once instead of per row |
| Navigation | A safe "back" everywhere: screens opened from a link, a notification or a reload no longer fail when saving or closing. A lint rule prevents regressions |
| Release setup | GitHub Actions CI (checks, pgTAP on a real local Supabase plus a clean reset, iOS and Android bundles). Maestro smoke flows plus an EAS workflow. Production config: version 1.0.0, only the background modes and permissions PACE uses, no export-compliance prompt. Play internal-track submit profile |
| Store and test docs | [`release/store-listing.md`](release/store-listing.md) (listing text, App Store privacy labels, Google Data safety, background-location declaration), [`release/device-test-matrix.md`](release/device-test-matrix.md) (22 critical flows), [`release/checklist.md`](release/checklist.md) |

## 2. Branches

`feature/p7-account` → `feature/p7-legal` → `feature/p7-quality` → `feature/p7-release`, merged into `claude/pace-spec-review-usad8z`.

## 3. Database and functions

No new migrations. New Edge Function `delete-account` (`verify_jwt = false`; it authenticates the caller itself). Deployed to the hosted project and answers 401 without a session.

## 4. Environment variables

- New: `EXPO_PUBLIC_SUPPORT_EMAIL`, required for production builds (shown in the privacy policy and terms).
- `EXPO_PUBLIC_LEGAL_VERSION` default is now `2026-11-09` because the legal texts changed. Update it in your `.env.local`, which still says `2026-11-08`.
- New packages: `expo-file-system`, `expo-sharing`.

## 5. Commands run and actual results

| Check | Result |
|---|---|
| `npm run check` | ✓ 388 passed, 1 skipped |
| `npx supabase test db` | ✓ 191/191 |
| `delete-account` on the local stack, scripted | ✓ no confirmation → 400, bad token → 401, password older than 10 min → 403, deletion → 200 with 3 route files removed, **no user, rows, profile or files left**, retry → 401 |
| Deletion domain tests | ✓ paged storage cleanup, the user is never deleted while cleanup fails, a retry finishes, an already-deleted user counts as success, objects outside the folder are refused |
| Account deletion in the browser (local stack) | ✓ wrong password → "That password is not correct." → right password → signed out to the welcome screen → database has nothing left for that account |
| Export in the browser (local stack) | ✓ 30 tables; counts match the database (21 weights, 18 complete days, 1 review…); no rows from any other user. The file was captured in the page, nothing was downloaded |
| Export completeness test | ✓ every table with `user_id`/`owner_id` in the generated types is exported |
| Contrast test | ✓ 14/14 after fixes (6 failed before) |
| Production config introspection | ✓ iOS background modes: `location` only; no Face ID or motion strings; Android overlay and external-storage permissions removed; version 1.0.0 |
| Maestro flows | ✓ 6 files parse with the expected structure. **Not run**: Maestro isn't installed here and needs a device or emulator |
| CI workflow | ✓ valid YAML, Supabase CLI version pinned. **Not run yet**: it runs when you push to GitHub |
| `expo export` web, iOS, Android | ✓ |
| Hosted `delete-account` | ✓ deployed, legacy JWT check off, 401 without a session |

### Problems found and fixed

1. **Colour contrast below WCAG AA** for five pairs, though the tokens file claimed otherwise: dark-theme red text (3.99:1 on cards), light-theme green text and white-on-green buttons (3.36–3.77:1), and light amber and red on raised cards. All now at least 4.5:1, checked by a test.
2. **Weight history stopped at 60 entries**, so older weigh-ins couldn't be opened or edited.
3. **"Back" failed on 13 screens** opened without history (links, notification taps, reloads), including quick add, weight log and check-in, which are exactly where reminders land.
4. **Unused permissions** that store review flags: iOS `fetch` background mode, Face ID and motion usage strings; Android overlay and external-storage permissions.
5. The existing "complete config" test described a production build without a support email. Updated for the new requirement.

## 6. Acceptance criteria (spec 27): where each stands

| # | Status |
|---|---|
| 1–7, 9–12, 14–17 | ✓ automated (unit, pgTAP, browser on the real stack); device confirmation in the test matrix |
| 8 Recurring sessions across DST | ✓ unit tests (Phase 3) |
| 13 GPS with the screen locked | Built; **needs the device exit test** (matrix rows 8–10) |
| 18 Deletion removes everything; export contains everything | ✓ tested end to end and by the completeness test |
| 19 Real iOS and Android devices | **Your step** (matrix) |
| 20 Typecheck, lint, unit, RLS, Maestro in CI | Unit, lint and RLS in GitHub Actions; Maestro via the EAS workflow (needs an EAS account and a test account) |

## 7. Known limitations

- **Legal texts need review** by a qualified person before public release. They're written for the actual data flows but aren't legal advice.
- **Cold start under 2 s** can only be measured on a real phone (matrix row 21).
- Maestro and the CI workflow haven't run yet (no device here, and the repo isn't on GitHub yet).
- The EAS Maestro workflow passes credentials as environment variables. Check the current EAS Workflows docs when you first run it.
- iOS keeps a local-network usage string added by the development client tooling. Confirm it isn't in a production build's Info.plist.
- No crash reporting in V1 (decision Phase 7 #3).

## 8. Your steps to release

Follow [`release/checklist.md`](release/checklist.md). In short:

1. Legal review; host the privacy policy and a support page; set `EXPO_PUBLIC_SUPPORT_EMAIL`.
2. Create a separate production Supabase project (EU), apply the migrations, deploy both functions, set Auth URLs and custom SMTP.
3. Configure EAS environments and build `preview`; run the Maestro smoke flows and the device test matrix, including both GPS exit tests.
4. Fill in the store listings and privacy answers from `release/store-listing.md`, then `eas build --profile production` and `eas submit`.

## 9. After V1

V1.1 from the spec: barcode scanning with Open Food Facts, progress photos, a monthly report, carb adjustment, GPX export, split PRs.
