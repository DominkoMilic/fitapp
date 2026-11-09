# Release checklist (Phase 7)

## Before the first store build

- [ ] **Legal review** of the privacy policy, terms and disclaimer (`src/features/legal/documents.ts`) by a qualified person; bump `EXPO_PUBLIC_LEGAL_VERSION` if the texts change.
- [ ] Host the privacy policy at a public URL (both stores require one) and a support page.
- [ ] Separate Supabase projects for **preview/test** and **production**, both in an EU region. Apply all migrations to each (`npx supabase db push`), deploy `recipes-proxy` and `delete-account` with `verify_jwt = false` (see `supabase/config.toml`).
- [ ] Production Auth settings: Site URL `pace://`, redirect URLs `pace://auth/callback`; email confirmation on; custom SMTP for auth emails (Supabase's built-in sender is rate-limited).
- [ ] EAS environment variables per environment (`npx eas-cli@latest env:create`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPPORT_EMAIL` (production requires it), optional `GOOGLE_MAPS_ANDROID_API_KEY` (restricted to the package and signing certificate).
- [ ] Optional: TheMealDB supporter key as the Edge Function secret `THEMEALDB_API_KEY`.
- [ ] Apple Developer and Google Play developer accounts; create the app records (bundle id `app.pace.fitness`).

## Quality gates

- [ ] CI green: `npm run check`, pgTAP, iOS/Android bundles (`.github/workflows/ci.yml`).
- [ ] Maestro smoke flows pass on a preview build (`tests/e2e/maestro/README.md`).
- [ ] Device test matrix complete (`device-test-matrix.md`), including both GPS exit tests.
- [ ] Store privacy answers match the build (`store-listing.md`).

## Build and submit

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios      # asks for the App Store Connect app
npx eas-cli@latest submit --profile production --platform android  # internal track, draft
```

Then in App Store Connect / Play Console: screenshots, description, privacy answers, background-location declaration (Android) and review notes with a **test account** for the reviewer (onboarded, in the production project, with sample data; never a real person's account).
