# Phase 5 report: GPS activity tracking

Date: 2026-11-09 · Spec sections: 11, 14.3, 25.4, 26 (Phase 5), 28.6, 29 (G vectors)

## 1. Summary

PACE now records walks, runs and rides with GPS, and you can add activities by hand.

The key design choice: **every raw GPS point is written to the phone's SQLite database the moment it arrives**, including from the background task while the screen is locked. The live screen, the summary and recovery after the app is killed all rebuild the activity the same way, from those stored points plus your pause times. Nothing that matters lives only in memory.

| Area | Delivered |
|---|---|
| Recording | Choose walk / run / ride → permission explainers → GPS signal check ("Ready (±6 m)" or "Weak, move to open sky", with "Start anyway") → live screen → Pause / Resume / Finish / Discard (with confirmation) |
| Live screen | Distance, moving time, total time, current and average pace (speed for rides), estimated kcal, GPS quality, route map following you |
| Background | iOS "Always" location with the blue indicator; Android foreground service with a "PACE is recording" notification. If you only allow "While using", tracking works with the app open and a banner says so. The summary then says time may be missing |
| Filtering | Spec 11.4: points over 25 m accuracy rejected, out-of-order or duplicate points rejected, speed caps (walk 3.5, run 8, ride 25 m/s), jitter adds no distance, no distance across pauses or implausible gaps |
| Recovery | After a kill or reboot, the Training tab shows "Recording in progress". Under 6 h old: resume. Older: finish with what was recorded, or discard |
| Summary | Route map, stats, GPS quality, notes. "Save this very short activity?" under 1 min or 50 m. Resume recording or discard |
| Saving | Through the offline outbox: the activity row first, then the route file to private storage. Works offline and syncs later |
| History | Activities list, detail with the map, **change type** (recalculates from the route), delete route only (totals kept), delete activity |
| Manual | Walk / run / ride / other, date, duration, optional distance and notes. Calories only with a distance (spec 11.8) |
| Records & milestones | Longest walk / run / ride and fastest run pace (GPS good or fair, at least 1 km, never manual), shown on Personal records. Milestones: first 5 km walk, 5 / 10 km run, 10 / 25 km ride. Moving time counts toward training-hours milestones |

## 2. Branches

`feature/p5-schema` → `feature/p5-domain` → `feature/p5-tracking` → `feature/p5-activities`, merged into `claude/pace-spec-review-usad8z`.

## 3. Database migrations

| File | Purpose |
|---|---|
| `20261112000100_activities.sql` | `activities` table with RLS, sanity checks (moving ≤ elapsed, distance ≤ 1000 km, route path must be in the owner's folder), private `routes` storage bucket (2 MB, JSON only) with owner-folder policies |

## 4. Configuration and environment

- `app.config.ts`: `expo-location` (permission texts, background location, Android foreground service), `expo-task-manager`, `react-native-maps`.
- New optional **build-time** variable `GOOGLE_MAPS_ANDROID_API_KEY` (see `.env.example`). Without it, Android draws the route as a shape. iOS uses Apple Maps and needs no key.
- New packages: `expo-location`, `expo-task-manager`, `react-native-maps`.

## 5. Commands run and actual results

| Check | Result |
|---|---|
| `npm run check` (typecheck, lint with 0 warnings, seed and shared-code checks, tests) | ✓ 310 passed, 1 skipped |
| Activity domain coverage | 99% of lines (geo, filter, recording, codec, records, manual, type change) |
| Spec test vectors G1–G9 | ✓ all match |
| `npx supabase test db` on the local Supabase stack | ✓ 172/172 (14 new: activity isolation, constraints, route bucket policies, cascade on account deletion) |
| Route storage, end to end on the local stack as a real user | ✓ activity upsert → route upload → path set → download round-trip → **upload into another user's folder refused** → route deleted with totals kept → activity deleted |
| Browser, full stack (local Supabase + web app in Chrome) | ✓ manual 5 km / 30 min run → list (synced) → detail: 6:00 /km and 529 kcal (MET 9.8 × 108 kg × 0.5 h) → Personal records "Longest run 5.00 km · entered manually" → **"First 5 km run" milestone unlocked** in the DB → delete with confirmation → empty state. The location explainer shows before any system prompt |
| `expo export` web, iOS and Android | ✓ all three bundle (iOS ≈ 9 MB) |

Not tested: real GPS recording. A browser can't record in the background, and Expo Go can't either. That's the exit test below, and it needs your phone.

### Problems found and fixed

1. **Confirm dialogs put their buttons inside a full-screen "Dismiss" button** (since Phase 1). This is invalid on web, and screen readers read the whole dialog as one button. The backdrop is now a separate layer. This affects every confirm dialog in the app.
2. **Opening an activity screen directly** (a link or a page reload) and then saving or deleting crashed the "go back" step, because there was no history. It now falls back to the activity list.
3. The milestone engine only runs inside the tab screens, so it only unlocked "First 5 km run" once Home was opened. That's expected: milestones are checked whenever the main tabs are open.
4. Manual calories without a distance were estimated from a typical speed. The spec says calories only when a distance is given, so I changed it.
5. A test expected the wrong MET bracket (5 km/h walking is 3.5, not 4.3). The test was fixed, not the code.

## 6. Edge cases (spec 28.6)

| # | Case | How it's handled | Test |
|---|---|---|---|
| 1 | Permission denied | Explainer, then "Open Settings" plus "Add an activity manually" | UI |
| 2 | Foreground only | Banner while recording; the summary says background time is missing | UI |
| 3 | Approximate location | Warning from the OS accuracy flag; quality rated poor | ✓ quality |
| 4 | GPS acquiring | "Start anyway"; weak points are filtered until accurate | ✓ filter |
| 5 | Accuracy > 25 m | Rejected | ✓ |
| 6 | Speed spike | Rejected | ✓ |
| 7 | Stationary jitter | No distance | ✓ |
| 8 | Pause | No distance across a pause, also when rebuilt from stored points | ✓ |
| 9 | Signal loss, then a jump | Plausible: bridged; implausible: new piece, no distance | ✓ |
| 10 | Out-of-order or duplicate points | Rejected (and ignored by the SQLite primary key) | ✓ |
| 11 | App killed | Recovery card; the activity id is fixed at Start, so saving twice upserts one row | ✓ outbox collapse |
| 12 | Phone reboot | Same recovery from SQLite | device |
| 13 | Very short activity | "Save a very short activity?" | ✓ isShort |
| 14 | Across midnight | `local_date` is the start date | ✓ G9 |
| 15 | Type changed after save | Re-filtered with the new type's cap; records update | ✓ |

## 7. Known limitations

- **Real-device exit test not done yet** (spec: a walk and a run of at least 2 km with the screen locked on iOS and Android, distance within about 5% of a known route, pause excludes distance, killing the app recovers). It needs a development build on your phone (§8).
- **Not yet on your hosted project.** The Phase 4 and Phase 5 migrations and the Edge Function still need pushing (§8).
- Changing a ride to a walk can drop distance. Changing a walk to a ride can't add back points the walk filter rejected (decisions, Phase 5 #6).
- Android maps need your Google Maps key; until then the route is drawn as a shape.

## 8. Manual steps

**1. Push the database and function** (once; `supabase login` opens your browser):

```bash
cd ~/codes/training/fitapp
npx supabase login
npx supabase link --project-ref nxdpvklztuwvmuqczpmn
npx supabase db push                                    # Phase 4 + Phase 5 migrations
npx supabase functions deploy recipes-proxy
```

**2. Build a development client for your phone** (GPS in the background doesn't work in Expo Go):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform ios      # or android
```

Install it, then run `npm start` and open the project in the dev build.

**3. Exit test:** walk 2+ km on a route you know the length of, with the phone locked in your pocket. Pause once for a minute while walking on. Then do the same as a run, and once force-quit the app mid-run and reopen it.

## 9. Next phase

**Phase 6: Personal coach.** The recommendation engine and rules, weight-trend recalibration with confirmable target adjustments, training load, the weekly report, notifications with quiet hours and caps, and the remaining milestones.
