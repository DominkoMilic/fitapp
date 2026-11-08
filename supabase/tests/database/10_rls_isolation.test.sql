-- RLS isolation: user B can never read or modify user A's rows; anon sees nothing.
begin;
select plan(41);

select tests.create_user('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com');
select tests.create_user('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com');

-- Seed rows for A as superuser.
insert into public.user_goals (id, user_id, goal_type, starting_weight_kg, target_weight_kg, weekly_rate_pct)
values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'lose_weight', 108, 90, 0.5);
insert into public.user_preferences (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.user_equipment (user_id, equipment_type, max_weight_kg)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'dumbbells', 5);
insert into public.consents (user_id, consent_type, document_version, granted)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'terms', 'v1', true);
insert into public.health_conditions (user_id, kind, body_area, side, status)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'injury', 'ankle_foot', 'right', 'recovering');
insert into public.nutrition_targets (user_id, effective_from, kcal, protein_g, carbs_g, fat_g, calculation_version)
values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-08', 2720, 162, 347, 76, '2.0.0');
insert into public.training_plans (id, user_id, name, goal_type, start_date, generator_version)
values ('22222222-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Plan', 'lose_weight', '2026-11-09', '1');
insert into public.recurring_events (user_id, training_plan_id, title, category, weekday, local_time, timezone, duration_minutes, intensity, starts_on)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'League match', 'futsal_match', 6, '18:00', 'Europe/Zagreb', 60, 'hard', '2026-11-09');

-- ---------------------------------------------------------------- user A
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000001');

select is((select count(*) from public.profiles)::int, 1, 'A sees exactly own profile');
select is((select count(*) from public.user_goals)::int, 1, 'A sees own goal');
select is((select count(*) from public.user_preferences)::int, 1, 'A sees own preferences');
select is((select count(*) from public.user_equipment)::int, 1, 'A sees own equipment');
select is((select count(*) from public.consents)::int, 1, 'A sees own consents');
select is((select count(*) from public.health_conditions)::int, 1, 'A sees own health conditions');
select is((select count(*) from public.nutrition_targets)::int, 1, 'A sees own targets');
select is((select count(*) from public.training_plans)::int, 1, 'A sees own plan');
select is((select count(*) from public.recurring_events)::int, 1, 'A sees own recurring events');
select lives_ok(
  $$ update public.profiles set display_name = 'Alice' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'A can update own profile');

select tests.clear_authentication();

-- ---------------------------------------------------------------- user B
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

select is((select count(*) from public.profiles)::int, 1, 'B sees only own profile');
select is((select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0, 'B cannot see A profile');
select is((select count(*) from public.user_goals)::int, 0, 'B cannot see A goals');
select is((select count(*) from public.user_preferences)::int, 0, 'B cannot see A preferences');
select is((select count(*) from public.user_equipment)::int, 0, 'B cannot see A equipment');
select is((select count(*) from public.consents)::int, 0, 'B cannot see A consents');
select is((select count(*) from public.health_conditions)::int, 0, 'B cannot see A health conditions');
select is((select count(*) from public.nutrition_targets)::int, 0, 'B cannot see A targets');
select is((select count(*) from public.training_plans)::int, 0, 'B cannot see A plans');
select is((select count(*) from public.recurring_events)::int, 0, 'B cannot see A recurring events');

-- Updates/deletes against A's rows silently affect 0 rows under RLS.
update public.profiles set display_name = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.user_goals set target_weight_kg = 50 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.health_conditions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.training_plans where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select throws_ok(
  $$ insert into public.user_goals (user_id, goal_type, starting_weight_kg) values ('aaaaaaaa-0000-0000-0000-000000000001', 'maintain', 80) $$,
  '42501', null, 'B cannot insert a goal for A');
select throws_ok(
  $$ insert into public.health_conditions (user_id, kind, body_area) values ('aaaaaaaa-0000-0000-0000-000000000001', 'injury', 'knee') $$,
  '42501', null, 'B cannot insert health data for A');
select throws_ok(
  $$ insert into public.consents (user_id, consent_type, document_version, granted) values ('aaaaaaaa-0000-0000-0000-000000000001', 'terms', 'v1', true) $$,
  '42501', null, 'B cannot insert consent for A');
select throws_ok(
  $$ insert into public.nutrition_targets (user_id, effective_from, kcal, protein_g, carbs_g, fat_g, calculation_version) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-12-01', 1200, 100, 100, 40, 'x') $$,
  '42501', null, 'B cannot insert targets for A');
select throws_ok(
  $$ insert into public.recurring_events (user_id, training_plan_id, title, category, weekday, local_time, timezone, duration_minutes, intensity, starts_on) values ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'x', 'other', 1, '10:00', 'UTC', 30, 'easy', '2026-11-09') $$,
  '42501', null, 'B cannot attach a recurring event to A plan');
select throws_ok(
  $$ delete from public.nutrition_targets $$,
  '42501', null, 'targets are versioned, never deleted (no delete privilege)');
select throws_ok(
  $$ delete from public.consents $$,
  '42501', null, 'consents are append-only (no delete privilege)');

select tests.clear_authentication();

-- Verify A's data is untouched (as superuser).
select is((select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Alice', 'A profile not modified by B');
select is((select target_weight_kg from public.user_goals where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 90.00::numeric, 'A goal not modified by B');
select is((select count(*) from public.health_conditions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1, 'A health data not deleted by B');
select is((select count(*) from public.nutrition_targets where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1, 'A targets not deleted by B');
select is((select count(*) from public.training_plans where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1, 'A plan not deleted by B');

-- ---------------------------------------------------------------- anon
select tests.become_anon();
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.user_goals $$, '42501', null, 'anon cannot read goals');
select throws_ok($$ select * from public.health_conditions $$, '42501', null, 'anon cannot read health data');
select throws_ok($$ select * from public.nutrition_targets $$, '42501', null, 'anon cannot read targets');
select throws_ok($$ select public.complete_onboarding('{}'::jsonb) $$, '42501', null, 'anon cannot call complete_onboarding');
select tests.clear_authentication();

-- ---------------------------------------------------------------- cascade
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0, 'deleting the auth user removes the profile');
select is((select count(*) from public.health_conditions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0, 'deleting the auth user removes health data');
select is((select count(*) from public.recurring_events where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0, 'deleting the auth user removes recurring events');
select is((select count(*) from public.consents where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0, 'deleting the auth user removes consents');

select * from finish();
rollback;
