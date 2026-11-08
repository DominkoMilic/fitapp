/**
 * Web E2E smoke test: sign-in → 9 onboarding steps → plan preview → save → Home → Training.
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
};
const writes = [];
const keyOf = {
  weight_entries: 'id',
  body_measurements: 'id',
  daily_checkins: 'local_date',
  user_milestones: 'milestone_key',
};
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
        const k = keyOf[table];
        const i = store[table].findIndex((r) => r[k] === row[k]);
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
  await page.getByLabel('Password').fill('abcd1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);

  // 1 personal
  await page.getByLabel('Name').fill('Dominko');
  await page.getByLabel('Day').fill('1');
  await page.getByLabel('Month').fill('5');
  await page.getByLabel('Year').fill('2003');
  await page.getByRole('radio', { name: 'Male', exact: true }).click();
  await page.getByLabel('Height').fill('187');
  await page.getByLabel('Current weight').fill('108');
  await shot('10-personal');
  await cont();
  // 2 goals
  await page.getByRole('radio', { name: /^Lose weight/ }).click();
  await page.getByLabel('Target weight', { exact: true }).fill('90');
  await page.getByLabel('Secondary target (optional)').fill('87');
  await page.getByRole('checkbox', { name: 'Football / futsal' }).click();
  await page.getByRole('checkbox', { name: 'Strength' }).click();
  await shot('11-goals');
  await cont();
  // 3 activity
  await page.getByRole('radio', { name: /^Moderately active/ }).click();
  await cont();
  // 4 equipment
  await page.getByRole('checkbox', { name: 'Dumbbells' }).click();
  await page.getByRole('checkbox', { name: 'Kettlebell' }).click();
  await page.getByRole('checkbox', { name: 'Exercise mat' }).click();
  await page.getByLabel('Heaviest dumbbells (optional)').fill('5');
  await cont();
  // 5 schedule
  await page.getByRole('radio', { name: '2', exact: true }).click();
  const pref = page.getByRole('group', { name: 'Preferred training days' });
  await pref.getByRole('checkbox', { name: 'Mon' }).click();
  await pref.getByRole('checkbox', { name: 'Thu' }).click();
  await page.getByRole('button', { name: 'Add match or practice' }).click();
  await page.getByLabel('Name').fill('League match');
  await page.getByRole('button', { name: 'Add to my week' }).click();
  await page.getByRole('button', { name: 'Add match or practice' }).click();
  await page.getByLabel('Name').fill('Practice match');
  await page.getByRole('checkbox', { name: 'Futsal practice' }).click();
  await page
    .getByRole('group', { name: 'Day of the week' })
    .getByRole('checkbox', { name: 'Tue' })
    .click();
  await page.getByLabel('Start time (HH:MM)').fill('20:00');
  await page.getByRole('button', { name: 'Add to my week' }).click();
  await shot('12-schedule');
  await cont();
  // 6 nutrition (defaults)
  await cont();
  // 7 health
  await page.getByRole('switch', { name: 'Store my health information' }).click();
  await page.getByRole('button', { name: 'Add an injury' }).click();
  await page
    .getByRole('group', { name: 'Pain level' })
    .getByRole('checkbox', { name: '2', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save injury' }).click();
  await shot('13-health');
  await cont();
  // 8 consent
  await cont(); // should show validation errors
  await shot('14-consent-errors');
  await page.getByRole('switch', { name: 'I accept the terms of use' }).click();
  await page.getByRole('switch', { name: 'I accept the privacy policy' }).click();
  await cont();
  // 9 plan
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
    await page.getByLabel('Day', { exact: true }).fill(String(dt.d));
    await page.getByLabel('Month', { exact: true }).fill(String(dt.m));
    await page.getByLabel('Year', { exact: true }).fill(String(dt.y));
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
  await page.getByText('Weight details and history').click();
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
