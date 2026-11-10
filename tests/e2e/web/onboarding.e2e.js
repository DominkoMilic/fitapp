/**
 * Web E2E smoke test: sign-in → 7 onboarding steps → plan preview → save → Home → Training.
 * Supabase is replaced by Playwright route handlers, so no backend is needed; the payload the
 * app sends to complete_onboarding is captured and checked.
 *
 * Usage: npm run e2e:web   (builds the web bundle, serves it on :8765 and runs this script)
 * Requires the `playwright` package and a Chromium build available to it.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const UID = '11111111-2222-4333-8444-555555555555';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp, aud: 'authenticated', email: 'dev@example.com' })}.sig`;
const user = {
  id: UID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'dev@example.com',
  email_confirmed_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
let payload = null;
// Rows the app writes through the sync engine (Phase 2 tables).
const store = {
  weight_entries: [],
  body_measurements: [],
  daily_checkins: [],
  user_milestones: [],
  scheduled_workouts: [],
  workout_sessions: [],
  exercise_sets: [],
  exercises: [],
};
const writes = [];
const keyOf = {
  weight_entries: 'id',
  body_measurements: 'id',
  daily_checkins: 'local_date',
  user_milestones: 'milestone_key',
  scheduled_workouts: 'id',
  workout_sessions: 'id',
  exercise_sets: 'id',
  exercises: 'id',
};
let idSeq = 0;
const now = new Date().toISOString();

(async () => {
  const out = process.argv[2] || 'e2e-screenshots';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  global.page = null;
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  global.page = page;
  const errors = [];
  global.errors = errors;
  page.on('pageerror', (e) =>
    errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 6).join(' <- ')),
  );
  await page.route('https://placeholder.invalid/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token')
      return json({
        access_token: jwt,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: exp,
        refresh_token: 'r1',
        user,
      });
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/rest/v1/rpc/complete_onboarding') {
      payload = JSON.parse(req.postData() || '{}').payload;
      // Mirrors the seed_first_weight_entry trigger.
      store.weight_entries.push({
        id: 'w-onboarding',
        user_id: UID,
        weight_kg: payload.goal.starting_weight_kg,
        measured_at: now,
        local_date: payload.plan.start_date,
        note: null,
        source: 'onboarding',
        created_at: now,
        updated_at: now,
      });
      return route.fulfill({ status: 204 });
    }
    const p = payload;
    const table = url.pathname.replace('/rest/v1/', '');
    if (store[table] && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '[]');
      for (const row of Array.isArray(body) ? body : [body]) {
        writes.push({ table, row });
        // Calendar generation upserts on (user_id, occurrence_key) and ignores duplicates.
        const byOccurrence =
          table === 'scheduled_workouts' &&
          url.searchParams.get('on_conflict') === 'user_id,occurrence_key';
        const k = byOccurrence ? 'occurrence_key' : keyOf[table];
        if (!row.id) row.id = `gen-${++idSeq}`;
        const i = store[table].findIndex((r) => r[k] === row[k]);
        if (byOccurrence && i >= 0) continue;
        const full = { created_at: now, updated_at: now, unlocked_at: now, ...row };
        if (i >= 0) {
          if (table !== 'user_milestones') store[table][i] = { ...store[table][i], ...full };
        } else store[table].push(full);
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (store[table] && req.method() === 'DELETE') return route.fulfill({ status: 204 });
    if (store[table]) {
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      return json(single ? (store[table][0] ?? null) : store[table]);
    }
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const rows =
      {
        profiles: p
          ? [
              {
                id: UID,
                ...p.profile,
                week_start: 1,
                onboarding_step: 'done',
                onboarding_completed_at: now,
                created_at: now,
                updated_at: now,
              },
            ]
          : [
              {
                id: UID,
                display_name: null,
                date_of_birth: null,
                calc_sex: null,
                height_cm: null,
                unit_system: 'metric',
                timezone: 'UTC',
                activity_level: null,
                average_daily_steps: null,
                week_start: 1,
                onboarding_step: null,
                onboarding_completed_at: null,
                created_at: now,
                updated_at: now,
              },
            ],
        user_goals: p
          ? [
              {
                id: 'g1',
                user_id: UID,
                ...p.goal,
                status: 'active',
                started_at: p.plan.start_date,
                ended_at: null,
                created_at: now,
                updated_at: now,
              },
            ]
          : [],
        nutrition_targets: p
          ? [{ id: 't1', user_id: UID, ...p.targets, created_at: now, updated_at: now }]
          : [],
        training_plans: p
          ? [
              {
                id: 'p1',
                user_id: UID,
                ...p.plan,
                goal_type: p.goal.goal_type,
                status: 'active',
                end_date: null,
                created_at: now,
                updated_at: now,
              },
            ]
          : [],
        recurring_events: p
          ? p.recurring_events.map((e, i) => ({
              id: 'e' + i,
              user_id: UID,
              training_plan_id: 'p1',
              template_slug: null,
              starts_on: p.plan.start_date,
              ends_on: null,
              active: true,
              created_at: now,
              updated_at: now,
              ...e,
              local_time: e.local_time + ':00',
            }))
          : [],
        health_conditions: p
          ? p.health_conditions.map((h) => ({
              user_id: UID,
              created_at: now,
              updated_at: now,
              resolved_at: null,
              professional_restrictions: null,
              ...h,
            }))
          : [],
      }[table] ?? [];
    return json(single ? (rows[0] ?? null) : rows);
  });

  const shot = (n) => page.screenshot({ path: `${out}/${n}.png`, fullPage: false });
  const cont = async () => {
    await page.getByRole('button', { name: /^(Continue|Save and start)$/ }).click();
    await page.waitForTimeout(600);
  };

  await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
  await page.getByText('I already have an account').click();
  await page.waitForTimeout(800);
  await page.getByLabel('Email').fill('dev@example.com');
  await page.getByLabel('Password', { exact: true }).fill('abcd1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);

  // 1 personal
  await page.getByLabel('Name').fill('Dominko');
  // Date of birth from the calendar sheet: years → month → day.
  await page.getByRole('button', { name: /^Date of birth:/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Earlier years' }).click();
  await page.getByRole('button', { name: '2003', exact: true }).click();
  await page.getByRole('button', { name: 'May 2003', exact: true }).click();
  await page.getByRole('button', { name: /^1 May 2003/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('radio', { name: 'Male', exact: true }).click();
  await page.getByLabel('Height').fill('187');
  await page.getByLabel('Current weight').fill('108');
  await page.getByRole('radio', { name: /^Moderately active/ }).click();
  await shot('10-personal');
  await cont();
  // 2 goals
  await page.getByRole('radio', { name: /^Lose weight/ }).click();
  await page.getByLabel('Target weight', { exact: true }).fill('90');
  await page.getByLabel('Secondary target (optional)').fill('87');
  await page.getByRole('checkbox', { name: 'Football', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Strength' }).click();
  await shot('11-goals');
  await cont();
  // 3 your week (schedule + equipment)
  await page.getByRole('radio', { name: '2', exact: true }).click();
  const pref = page.getByRole('group', { name: 'Preferred training days' });
  await pref.getByRole('checkbox', { name: 'Mon' }).click();
  await pref.getByRole('checkbox', { name: 'Thu' }).click();
  await page.getByRole('button', { name: 'Add a game or practice' }).click();
  await page.getByLabel('Name').fill('League match');
  await page.getByRole('button', { name: 'Add to my week' }).click();
  await page.getByRole('button', { name: 'Add a game or practice' }).click();
  await page.getByLabel('Name').fill('Practice match');
  await page
    .getByRole('radiogroup', { name: 'Game or practice' })
    .getByRole('radio', { name: 'Practice', exact: true })
    .click();
  await page
    .getByRole('radiogroup', { name: 'Day of the week' })
    .getByRole('radio', { name: 'Tue' })
    .click();
  await page.getByLabel('Start time (HH:MM)').fill('20:00');
  await page.getByRole('button', { name: 'Add to my week' }).click();
  await page.getByRole('checkbox', { name: 'Dumbbells' }).click();
  await page.getByRole('checkbox', { name: 'Kettlebell' }).click();
  await page.getByRole('checkbox', { name: 'Exercise mat' }).click();
  await page.getByLabel('Heaviest dumbbells (optional)').fill('5');
  await shot('12-schedule');
  await cont();
  // 4 food tracking: off by default; the later nutrition checks need it on
  await page.getByRole('switch', { name: /Track food in PACE/ }).click();
  await cont();
  // 5 health
  await page.getByRole('switch', { name: 'Store my health information' }).click();
  await page.getByRole('button', { name: 'Add an injury' }).click();
  await page
    .getByRole('group', { name: 'Pain level' })
    .getByRole('checkbox', { name: '2', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save injury' }).click();
  await shot('13-health');
  await cont();
  // 6 consent
  await cont(); // should show validation errors
  await shot('14-consent-errors');
  await page.getByRole('switch', { name: 'I accept the terms of use' }).click();
  await page.getByRole('switch', { name: 'I accept the privacy policy' }).click();
  await cont();
  // 7 plan
  await page.waitForTimeout(500);
  await shot('15-plan');
  await page.screenshot({ path: `${out}/15-plan-full.png`, fullPage: true });
  const planText = await page.locator('body').innerText();
  await cont();
  await page.waitForTimeout(2500);
  await shot('16-home');
  await page
    .getByRole('tab', { name: /Training/ })
    .click()
    .catch(() => page.getByText('Training', { exact: true }).last().click());
  await page.waitForTimeout(1000);
  await shot('17-training');
  // ---------------------------------------------------------------- Phase 2
  const zagrebDate = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 86400000);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zagreb',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (t) => Number(parts.find((x) => x.type === t).value);
    return { d: get('day'), m: get('month'), y: get('year') };
  };
  const logWeight = async (kg, offsetDays) => {
    await page.getByRole('tab', { name: /Home/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Log weight' }).first().click();
    await page.waitForTimeout(700);
    await page.getByLabel('Weight', { exact: true }).fill(String(kg));
    const dt = zagrebDate(offsetDays);
    // Pick the day in the calendar sheet (opens on the current month).
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    await page.getByRole('button', { name: /^Date:/ }).click();
    await page.waitForTimeout(500);
    await page
      .getByRole('button', { name: new RegExp(`^${dt.d} ${months[dt.m - 1]} ${dt.y}`) })
      .first()
      .click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForTimeout(2500); // debounce + sync
  };
  await logWeight(106.0, -2);
  await logWeight(105.8, -1);
  await logWeight(105.6, 0); // today's daily value = mean(108 onboarding, 105.6) = 106.8 → 7-day avg 106.2
  await page.waitForTimeout(2500);
  await shot('20-home-after-weights');
  const homeText = await page.locator('body').innerText();
  await page.getByRole('tab', { name: /Progress/ }).click();
  await page.waitForTimeout(1000);
  await shot('21-progress');
  await page.getByText('Weight history').click();
  await page.waitForTimeout(1000);
  await shot('22-weight-detail');
  await page.goBack();
  await page.waitForTimeout(600);
  await page.getByRole('tab', { name: /Home/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Check-in' }).first().click();
  await page.waitForTimeout(700);
  await page.getByLabel('Sleep last night').fill('6.5');
  await page
    .getByRole('group', { name: 'Pain level' })
    .getByRole('checkbox', { name: '5', exact: true })
    .click();
  await page
    .getByRole('group', { name: 'Where is the pain' })
    .getByRole('checkbox', { name: 'Ankle / foot' })
    .click();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await page.waitForTimeout(2500);
  await shot('23-checkin-pain');
  const checkinText = await page.locator('body').innerText();
  // ---------------------------------------------------------------- Phase 3
  await page.getByRole('button', { name: 'Done', exact: true }).click(); // close the check-in safety screen
  await page.waitForTimeout(600);
  await page.getByRole('tab', { name: /Training/ }).click();
  await page.waitForTimeout(2500); // calendar generation
  await shot('30-training-week');
  const generated = store.scheduled_workouts.filter((r) => r.occurrence_key).length;
  await page.getByRole('button', { name: /^Add training/ }).click();
  await page.waitForTimeout(700);
  await page.getByText('Plan a workout', { exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole('radio', { name: /^Full body 20/ }).click();
  await page.getByRole('button', { name: 'Add to calendar' }).click();
  await page.waitForTimeout(1500);
  await shot('31-workout-detail');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.waitForTimeout(1500);
  await shot('32-session');
  // Mark every set of every exercise done, moving forward until the last exercise.
  for (let guard = 0; guard < 12; guard++) {
    const n = await page.getByRole('button', { name: /mark as done/ }).count();
    for (let k = 0; k < n; k++) {
      await page
        .getByRole('button', { name: /mark as done/ })
        .first()
        .click();
      await page.waitForTimeout(150);
    }
    if (await page.getByRole('button', { name: 'Finish workout' }).count()) break;
    await page.getByRole('button', { name: /^Next exercise/ }).click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.waitForTimeout(1000);
  await page
    .getByRole('radiogroup', { name: 'Effort (RPE)' })
    .getByRole('radio', { name: '6', exact: true })
    .click();
  await shot('33-summary');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await page.waitForTimeout(3500);
  const trainingAfterSave = await page.locator('body').innerText();
  await page.getByRole('button', { name: /^History/ }).click();
  await page.waitForTimeout(1000);
  await shot('34-history');
  const historyText = await page.locator('body').innerText();
  fs.writeFileSync(`${out}/payload.json`, JSON.stringify(payload, null, 2));
  const checks = {
    'plan shows 2720 kcal': planText.includes('2720'),
    'plan shows 162 g protein': planText.includes('162'),
    'plan shows 347 g carbs': planText.includes('347'),
    'payload kcal = 2720': payload?.targets?.kcal === 2720,
    'seed week matches spec 25.1':
      payload?.plan?.weekly_pattern?.map((d) => d.kind).join(',') ===
      'strength_upper,commitment,recovery,strength_lower_safe,rest,commitment,recovery',
    'weights synced to server (3 upserts)':
      writes.filter((w) => w.table === 'weight_entries').length === 3,
    'first milestone unlocked on the 7-day average': store.user_milestones.some(
      (m) => m.milestone_key === 'weight_lost_1',
    ),
    'milestone written exactly once':
      writes.filter((w) => w.table === 'user_milestones' && w.row.milestone_key === 'weight_lost_1')
        .length === 1,
    'home shows the 7-day average (106.2)': homeText.includes('106.2'),
    'check-in synced': store.daily_checkins.length === 1 && store.daily_checkins[0].pain === 5,
    'pain >= 4 shows rest guidance': checkinText.includes('Rest that area'),
    'calendar generated from the plan': generated >= 40,
    'workout session saved once':
      store.workout_sessions.length === 1 &&
      store.workout_sessions[0].completion_status === 'completed',
    // Full body 20 without equipment: warm-up 1 + box squat 2 + push-up 2 + glute bridge 2 + plank 2 (row removed: needs equipment)
    'all 9 sets saved with the session':
      store.exercise_sets.filter((x) => x.completed).length === 9 &&
      store.exercise_sets.every((x) => x.workout_session_id === store.workout_sessions[0]?.id),
    'one-off workout marked completed': store.scheduled_workouts.some(
      (r) => !r.occurrence_key && r.status === 'completed',
    ),
    '"First workout" milestone unlocked': store.user_milestones.some(
      (m) => m.milestone_key === 'workouts_1',
    ),
    'history lists the workout': historyText.includes('Full body 20'),
    'no phantom workout after saving':
      !historyText.includes('Workout in progress') &&
      !trainingAfterSave.includes('Workout in progress'),
    'no page errors': errors.length === 0,
  };
  for (const [name, ok] of Object.entries(checks)) console.log(ok ? '✓' : '✗', name);
  await browser.close();
  if (Object.values(checks).some((ok) => !ok)) {
    console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
    process.exit(1);
  }
})().catch(async (e) => {
  console.error('FAILED:', e.message.split('\n').slice(0, 3).join(' / '));
  console.error('PAGE ERRORS:', JSON.stringify((global.errors || []).slice(0, 3)));
  if (global.page) {
    await global.page.screenshot({ path: process.argv[2] + '/fail.png' });
    console.error(
      'PAGE:',
      (await global.page.locator('body').innerText()).slice(0, 900).replace(/\n+/g, ' | '),
    );
  }
  process.exit(1);
});
