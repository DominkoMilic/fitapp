# Push notifications setup (Phase 8B-2)

Social push notifications ("Ana cheered your run") are built but switched off. Turning them on needs a few steps in accounts only you can sign in to. Steps 1–3 are yours; tell me when they're done and I'll do 4–7 and test on the phone.

## 1. Link the app to Expo (EAS project ID)

1. Create or sign in to an Expo account at https://expo.dev.
2. In this repo run `npx eas-cli login`, then `npx eas-cli init`. It creates the project and writes `extra.eas.projectId` into the app config (keep that change).

## 2. Firebase (Android delivery)

1. At https://console.firebase.google.com create a project (e.g. "PACE").
2. Add an Android app with the package name `app.pace.fitness.preview` (and later `app.pace.fitness` for production).
3. Project settings → Service accounts → **Generate new private key** (a JSON file). Keep it private.
4. Run `npx eas-cli credentials` → Android → `app.pace.fitness.preview` → Google Service Account → **Push notifications (FCM V1)** → upload the JSON file.

## 3. Expo access token (optional but recommended)

expo.dev → Account settings → Access tokens → create one named "pace-push". In Expo project settings you can then require it for push ("enhanced security").

## 4. Database (I can do this)

- Enable the `pg_net` extension (Database → Extensions).
- Insert the function URL and a random shared secret: `insert into push_config values ('function_url', 'https://<project>.supabase.co/functions/v1/social-push'), ('secret', '<random>');`

## 5. Edge Function

- Secrets: `PUSH_SECRET` (same random value) and `EXPO_ACCESS_TOKEN` (step 3).
- Deploy: `npx supabase functions deploy social-push` (`verify_jwt = false` comes from `supabase/config.toml`).

## 6. Switch on

`update app_config set value = 'true' where key = 'push_enabled';` — the app registers each signed-in device's token when social is on (notification permission is the one reminders already ask for). Set it back to `'false'` to stop all social pushes at once.

## 7. Test

Build the app (needs the projectId from step 1), sign in as Dev, have Dev Two cheer and comment through the SQL editor, and check: one push for many cheers, nothing between 22:00 and 07:00, tapping opens the post, no numbers or health details in the text.
