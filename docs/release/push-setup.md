# Push notifications setup (Phase 8B-2)

Social push notifications ("Ana cheered your run") are built but switched off. Turning them on needs a few steps in accounts only you can sign in to. Steps 1–3 need your Expo and Firebase accounts; 4–7 finish the setup and test it.

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

## 4. Edge Function

`npx supabase login` once, then `npx supabase functions deploy social-push --project-ref <project ref>` (`verify_jwt = false` comes from `supabase/config.toml`). Optional secret: `EXPO_ACCESS_TOKEN` (Edge Functions → Secrets), only needed if "enhanced security" is switched on for push in the Expo project.

## 5. Firebase app config in the app

Firebase console → Project settings → General → Your apps → Android app → download **google-services.json** and put it in the project root (it is git-ignored; `app.config.ts` picks it up). Rebuild the app.

## 6. Switch on (SQL editor)

Enables `pg_net`, stores the function URL and a **database-generated** shared secret in `push_config` (the function reads it from there, so no one copies a secret), and sets `app_config.push_enabled = true`:

```sql
create extension if not exists pg_net with schema extensions;
insert into public.push_config (key, value) values
  ('function_url', 'https://<project ref>.supabase.co/functions/v1/social-push'),
  ('secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do update set value = excluded.value;
update public.app_config set value = 'true' where key = 'push_enabled';
```

To stop all social pushes at once: `update app_config set value = 'false' where key = 'push_enabled';`

## 7. Test

Build the app (needs the projectId from step 1), sign in as Dev, have Dev Two cheer and comment through the SQL editor, and check: one push for many cheers, nothing between 22:00 and 07:00, tapping opens the post, no numbers or health details in the text.
