# Store listing and privacy answers

Answers match what the V1 app actually does (see `src/features/legal/documents.ts`). Re-check them whenever a data flow changes.

## Listing text

**Name:** PACE: Fitness Coach
**Subtitle (iOS, 30 chars):** Training, food and runs in one
**Short description (Android, 80 chars):** Realistic targets, workouts around your schedule, food logging and GPS runs.
**Category:** Health & Fitness · **Age rating:** 17+ (iOS: unrestricted web access = No; medical info = Infrequent/Mild) / PEGI 3 equivalent with "health" disclosures. The app requires users to be 18+ in its terms.

**Description:**

> PACE is a personal fitness coach that is honest about what it knows.
>
> • Realistic calorie and protein targets that never go below a safety minimum, reviewed with you every two weeks from your real weight trend.
> • A weekly training plan built around your schedule, equipment and injuries. Play basketball, tennis, handball or another sport? Your games and practices go on the calendar, with drills for your sport. No sport? No problem.
> • Food logging from 6,800+ reference foods. Type in your own recipes and meals (with your own numbers if you like), a meal planner and a shopping list.
> • Walk, run and ride tracking with GPS, pause, routes and personal records. Routes are private.
> • A daily coach that explains why it suggests something, milestones, and a weekly report.
> • Works offline and syncs when you're back online. Export or delete all your data at any time.
>
> PACE is not a medical device. Estimates are labelled as estimates.

**Keywords (iOS):** fitness,workout,calorie,diet,weight,run tracker,gps,training plan,meal planner,protein

**Support URL / marketing URL:** needed before submission (a simple page with the support email and the privacy policy).
**Privacy policy URL:** required by both stores; host the in-app privacy policy text at a public URL.

## Screenshots to capture (6.7" iPhone, 6.5" iPhone, Android phone)

1. Home with coach cards and today's plan
2. Training calendar / workout in progress
3. Food diary with remaining calories and macros
4. Activity summary with route map
5. Weight chart with 7-day average
6. Weekly report

## App Store: App Privacy ("nutrition labels")

Tracking: **No** (no data used to track users across apps or websites; no ad or tracking SDKs).

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info: Email address | Yes | Yes | No | App functionality (account) |
| Contact info: Name | Yes | Yes | No | App functionality (greeting) |
| Health & fitness: Health | Yes | Yes | No | App functionality (injuries, conditions, pain, weight, measurements) |
| Health & fitness: Fitness | Yes | Yes | No | App functionality (workouts, activities, food logs) |
| Location: Precise location | Yes | Yes | No | App functionality (routes of recorded activities) |
| User content: Other user content | Yes | Yes | No | App functionality (notes, custom foods and recipes) |
| Identifiers: User ID | Yes | Yes | No | App functionality (account id) |
| Other data: date of birth, sex, height | Yes | Yes | No | App functionality (energy calculation) |
| Diagnostics, usage data, purchases, contacts, browsing | **No** | | | |

## Google Play: Data safety

- Data collected: **Yes**. Shared with third parties: **No** (Supabase is a processor acting for us; TheMealDB receives only search words, not user data).
- Encrypted in transit: **Yes**. Users can request deletion: **Yes** (in-app, Profile → Your data → Delete my account).

| Category | Types | Collected | Optional | Purposes |
|---|---|---|---|---|
| Location | Precise location | Yes | Yes (only when recording) | App functionality |
| Personal info | Name, email address, user IDs, other info (date of birth, sex) | Yes | Name optional; email required | App functionality, account management |
| Health and fitness | Health info, fitness info | Yes | Health info optional | App functionality |
| App activity | Other user-generated content | Yes | Yes | App functionality |
| App info and performance, device IDs, financial, messages, photos, contacts | No | | | |

## Permission declarations

**Android `ACCESS_BACKGROUND_LOCATION` (Play Console declaration + short video):**
> PACE records the route and distance of walks, runs and rides the user starts. Background location is used only while a recording the user started is running, so tracking continues with the screen locked. A persistent notification is shown while recording. Location is never collected outside a recording.

Video: start a run → lock screen → show the notification → unlock → finish → route shown.

**Android foreground service type `location`:** same justification; the service runs only during a user-started recording.

**iOS Location "Always":** the in-app explainer appears before the system prompt; tracking without "Always" still works with the app open (App Review 5.1.1).

**Notifications:** asked only when the user turns on a reminder.
