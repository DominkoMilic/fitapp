# PACE full audit report

Date: 2026-11-09 · Scope: the whole app (Expo/React Native, Supabase database, Storage and Edge Functions)

Method: the audit prompts in `frima/resources/propmpts` (security, design/UX, accessibility, launch QA, GDPR/privacy, reliability, performance, forms, i18n), applied to a mobile app. SEO and the CMS setup prompts don't apply.

Evidence came from read-only sweeps of every route, migration and function. The key claims were then verified by hand and with tests on the real local stack.

**Not done:** penetration testing of the hosted project, and real-device screen-reader runs (manual checklist below). This report does not claim the app is "100% secure", "WCAG compliant" or "GDPR compliant". It lists the technical controls in place and what still needs human review.

## 1. Executive summary

The foundations were strong:

- RLS on all tables, nothing exposed to anonymous users
- generic error messages, no trackers, no secrets in the repo
- validated Edge Function input

The audit found **5 high-severity problems**, all now fixed:

1. Safety rules were enforced only by the app.
2. A deep link could sign a user into someone else's account (login CSRF).
3. Reads were silently cut off at 1,000 rows.
4. Sign-out left reminders, GPS and drafts on the phone.
5. Session tokens were stored unencrypted.

The audit also fixed a privacy-policy contradiction (recipe photos loaded straight from TheMealDB) and about 40 UX and accessibility defects.

**Largest remaining risk:** nothing has run on real phones yet.

## 2. Findings and fixes

| # | Severity | Finding | Where | Fix | Verified |
|---|---|---|---|---|---|
| 1 | High | Calorie floor, 18+, goal BMI, health consent and recalibration rules could be bypassed by writing to the API directly | `nutrition_targets`, `profiles`, `user_goals`, `health_conditions`, `target_adjustments` | Database triggers for user writes (migration `20261114000100`) | pgTAP `80_server_safety`: 22 tests; 17 fail without the fix |
| 2 | High | Login CSRF: `pace://auth/callback#access_token=…` signed the victim into the attacker's account | `deep-link.ts`, `AuthProvider` | Raw tokens refused (PKCE only); "Signed in as …" confirmation; link error text never shown verbatim | Unit tests |
| 3 | High | Reads stopped at 1,000 rows (PostgREST `max_rows`), so milestones, records, reviews and reports used partial data | sets, food/water range, weights, measurements, targets, schedule, export | `fetchAllPages` with a stable order | Local stack: 1,000 of 1,500 rows before, 1,500 after |
| 4 | High | Sign-out left scheduled reminders (with workout titles), running GPS and the onboarding draft (DOB, weight, health) | `AuthProvider` | `clearLocalData(…, 'sign-out')` on every sign-out event | Browser: draft cleared, signed out to the welcome screen |
| 5 | Med-High | Session tokens in plain AsyncStorage | `integrations/supabase/client.ts` | Chunked Keychain/Keystore adapter plus migration | Unit tests |
| 6 | Medium | Recipe photos loaded from themealdb.com (IP and viewed recipes exposed), contradicting the policy | `recipes.tsx`, `recipe/[id].tsx` | Photos copied to PACE Storage by `recipes-proxy`; app resolves only its own bucket | Live TheMealDB: 25/25 photos from PACE, 0 external; pgTAP `85` |
| 7 | Medium | No network timeouts; offline queries retried and failed | Supabase client, React Query | 20 s / 60 s timeouts; `onlineManager` follows the network state | Unit tests |
| 8 | Medium | No error boundary; unknown links showed the developer screen | root layout | `ErrorBoundary` (no internals shown) and `+not-found` | Component test; browser |
| 9 | Medium | `delete-account` rate limit failed open | Edge Function | Fails closed (503) | Code review |
| 10 | Medium | 8 save buttons could submit twice and swallowed failures; one-tap actions failed silently; injury delete had no confirmation; sign-out spinner could stick | various screens | `useSubmit`, `useGuardedAction`, confirmation dialog, try/finally | Typecheck, lint, tests |
| 11 | Medium | Screen-reader defects: tappable cards hid their numbers; toasts and errors silent on iOS; per-second live regions; glyphs read aloud; wrong roles | shared components | Hint instead of label, `announce()`, error in the field label, radio roles, `spokenLabel` | Component tests |
| 12 | Medium | Screens with no error state, or a misleading empty state on failure | 11 screens | `LoadErrorBanner` / `ErrorState` | Typecheck |
| 13 | Medium | Raw ISO dates (12 places), raw enum values, dead "Available before public release" row, hard-coded "56 exercises" | various screens | `src/domain/format`, label maps | Unit tests; browser |
| 14 | Low | kg/ml hard-coded for imperial users; naive plurals | weight log, review, history | Unit-aware text, `plural()` | Unit tests |
| 15 | Low | Two primary buttons per screen; Profile had 16 rows with Sign out outside a section | workout/recipe detail, Profile | One primary; 4 sections | Browser |
| 16 | Low | Tap targets under 44 pt | coach links, segmented control, "Forgot your password?" | `minHeight: 44` | Code review |
| 17 | Low | Weight history capped at 60 entries, measurements at 80 (older entries uneditable) | weight, measurements | Virtualised full lists | Browser |
| 18 | Low | Defence in depth: `https:`-only external links, legal lookup ignored inherited keys, consents backdatable, export files left in the cache, `decided_at` movable | various | Fixed | Tests |
| 19 | Info | 21 moderate and 1 low npm advisories, all in build/CLI/test tooling | dependencies | Not reachable in the app; downgrade not worthwhile | `npm audit --omit=dev` |

## 3. Security questions (from the security prompt)

1. **Can an unauthenticated user access anything?** No. Anonymous users have no grants, and both functions require a session.
2. **Can a user read or modify another user's resources?** No. RLS checks the owner on every table and on Storage paths (pgTAP isolation tests).
3. **Can a user become an administrator?** There are no roles. Privileged work runs only in Edge Functions with the service role.
4. **Can input become executable HTML/JS?** No. There is no `innerHTML`, `eval` or WebView, and text is rendered as text.
5. **Can input alter a SQL query?** No. Queries are parameterised by PostgREST, and RPC bodies use typed parameters.
6. **Can input reach a shell?** No. There are no subprocesses.
7. **Can a user make the server fetch arbitrary URLs?** No. The fixed TheMealDB host is enforced, photos come only from its image path, redirects are refused, and input is URL-encoded.
8. **Can forms be abused for spam?** There are no email or lead forms. Auth email is rate-limited by Supabase, and the functions are rate-limited per user.
9. **Can endpoints be abused without rate limits?** The functions have database-backed limits. Auth endpoints use Supabase's limits.
10. **Dangerous uploads?** Users can upload only route JSON (2 MB, JSON only, own folder). Photo writes are service-role only and limited to images under 1 MB.
11. **Secrets in bundles?** No. Only the URL, publishable key, environment, legal version and support email are public.
12. **Stealable session tokens?** Tokens are now in the OS keychain. On web they're in localStorage (there is no web release).
13. **Can other sites trigger operations?** No. Auth uses bearer tokens, not cookies. CORS `*` allows nothing without a token.
14. **Open redirects?** No. Only `next=reset-password` is honoured.
15. **Private responses cached publicly?** No. There is no CDN caching of user data; photos are public by design.
16. **i18n bypass?** Not applicable (English only).
17. **Errors exposing internals?** No. The crash screen hides error text and functions return generic codes.
18. **Security headers?** There is no web deployment yet. Add a CSP and headers if a web build is ever hosted.
19. **Vulnerable dependencies in production code?** None found. All advisories are in build tooling.
20. **Did the fixes introduce issues?** None known. Re-audited: triggers step aside for other users' rows so RLS reports them, the onboarding flag is transaction-local, and the photo mirror allowlists the host and path.

## 4. UX health

The flows are complete and honest, with estimates labelled and no fake features. The biggest systemic issue was inconsistent feedback: silent failures, double submits, raw values, missing error states. Shared helpers now fix that across the app.

**Quick wins applied:**

- one primary button per screen
- 44 pt tap targets
- readable dates and labels

**Still worth considering later:**

- splitting the 9-input onboarding steps (schedule, health)
- trimming the workout session screen (12 buttons)
- an empty-state message on the calendar

## 5. Privacy data-flow map

| Data | Where it goes |
|---|---|
| Account, profile, logs, health info, routes | Supabase (EU), RLS per user |
| Recipe search words | PACE function → TheMealDB (no identity) |
| Recipe photos | PACE Storage → phone (TheMealDB never sees the user) |
| Map tiles | Apple/Google Maps from the phone (disclosed) |
| Reminders | Local notifications on the phone only |
| Analytics, ads, crash reporting | None |

On-device storage:

- **Keychain:** session tokens.
- **SQLite / AsyncStorage:** outbox, GPS points, drafts. These are protected by OS device encryption and cleared on deletion; the onboarding draft is also cleared on sign-out.

## 6. Accessibility manual test checklist (real devices)

- **VoiceOver (iPhone):**
  - Home cards read their numbers.
  - Toasts are spoken.
  - Form errors are spoken when a field is focused.
  - Rest timer: only "Rest over" is announced.
  - Single-choice chips read as radio buttons.
- **TalkBack (Android):** the same checks, plus no continuous announcements on the GPS screen.
- **Text size at 200%:**
  - Home, food diary, workout session (set row) and onboarding are usable.
  - Nothing is clipped.
- **Reduce motion:** dialogs and skeletons respect it.
- **Dark and light themes:** contrast is enforced by `a11y-contrast.test.ts`.

## 7. Verification results

| Check | Result |
|---|---|
| `npm run check` | ✓ 417 passed, 1 skipped |
| `npx supabase test db` | ✓ 218/218 (40 new) |
| Browser, local stack | ✓ sign-in, Home, Profile sections, not-found page, recipe photos from PACE (25/25), formatted dates, sign-out cleanup; no console errors |
| Scripted local stack | ✓ row-cap paging, photo mirror and bucket permissions, onboarding still works through the triggers |

## 8. Manual actions

1. Hosted project: apply migrations `20261114000100` and `20261114000200`, then redeploy `recipes-proxy` and `delete-account`. I did this through the dashboard; see the final message.
2. Production Auth:
   - remove `exp://**` from the redirect URLs
   - enable secure password change
   - set up custom SMTP
3. Turn on backups/PITR and alerts (`docs/release/operations.md`).
4. Run the real-device checklist (`docs/release/device-test-matrix.md`) and the accessibility checks above.
5. Get the legal texts reviewed by a qualified person.

## 9. Launch decision

**GO WITH WARNINGS** for TestFlight / internal testing. **NO-GO** for public store release until:

- the real-device test matrix passes, including both GPS exit tests and the screen-reader checks
- the legal texts are reviewed
- the production Auth, backup and monitoring steps above are done

No critical journey is known to be broken.
