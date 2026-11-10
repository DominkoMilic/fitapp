# Real-device test matrix (spec 27 #19, 29.6)

Run on a **preview** build (`npx eas-cli@latest build --profile preview`) against a **test** Supabase project. Mark ✓ / ✗ with the build number and date.

| Device | OS | Build | Date | Tester |
|---|---|---|---|---|
| iPhone (mid-range, e.g. iPhone 12/13) | iOS 18+ |  |  |  |
| Android mid-range (e.g. Pixel 6a / Galaxy A5x) | Android 14+ |  |  |  |
| Optional: older Android (8 GB RAM or less) | Android 12 |  |  |  |

## Critical flows

| # | Flow | iOS | Android |
|---|---|---|---|
| 1 | Sign up → confirm email on the phone → onboarding → plan saved | | |
| 2 | Kill the app mid-onboarding → reopen → resumes | | |
| 3 | Sign out → sign in → session persists after restart | | |
| 4 | Log weight online and in airplane mode → back online → synced once (no duplicate) | | |
| 5 | Start a workout → complete sets → rest timer notification while backgrounded → finish → history | | |
| 6 | *(Archived with nutrition.)* | | |
| 7 | Social: set up, find a friend by handle, send/accept a request, block and report | | |
| 8 | **GPS exit test:** 2+ km walk, screen locked, one 1-min pause while walking on → distance within ~5% of a known route; pause adds no distance | | |
| 9 | **GPS exit test:** 2+ km run; force-quit mid-run → reopen → "Recording in progress" → resume → finish | | |
| 10 | "While using" only: tracking banner; summary says background time is missing | | |
| 11 | Route map shows; delete route keeps totals; delete activity | | |
| 12 | Reminders: turn on weigh-in at a near time → permission once → notification arrives → tap opens the screen | | |
| 13 | Quiet hours: no reminder between 22:00 and 07:00 | | |
| 14 | Coach cards show reasons; dismiss hides until tomorrow | | |
| 15 | Weekly report: current week "In progress"; last week opens | | |
| 16 | Export my data → share sheet → file opens and contains workouts, activities, routes | | |
| 17 | Delete account (password + DELETE) → signed out → cannot sign in again | | |
| 18 | Dynamic Type / font scale 200%: Home, Social, workout screen stay usable | | |
| 19 | Screen reader (VoiceOver / TalkBack): sign in, log weight, start/finish workout | | |
| 20 | Dark and light mode on every tab | | |
| 21 | Cold start to Home under 2 s (stopwatch, 3 runs, median) | | |
| 22 | Change phone timezone → reminders and "today" follow the profile timezone setting | | |
