-- Phase 2 tables: isolation, constraints, idempotent milestones, first weight entry.
begin;
select plan(26);

select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000a1', 'pa@example.com');
select tests.create_user('bbbbbbbb-0000-0000-0000-0000000000b2', 'pb@example.com');

-- First weight entry is created from the first goal.
insert into public.user_goals (user_id, goal_type, starting_weight_kg, target_weight_kg, weekly_rate_pct, started_at)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'lose_weight', 108, 90, 0.5, '2026-11-08');
select is((select count(*) from public.weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1')::int, 1,
  'first goal seeds one weight entry');
select is((select weight_kg from public.weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 108.00::numeric,
  'seeded weight equals the starting weight');
select is((select local_date from public.weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), '2026-11-08'::date,
  'seeded entry uses the goal start date');
update public.user_goals set status = 'abandoned' where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
insert into public.user_goals (user_id, goal_type, starting_weight_kg)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'maintain', 100);
select is((select count(*) from public.weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1')::int, 1,
  'later goals do not add weight entries');

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000a1');
select lives_ok($$ insert into public.weight_entries (id, user_id, weight_kg, measured_at, local_date)
  values ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 107.4, now(), current_date) $$,
  'A logs a weight');
select lives_ok($$ insert into public.weight_entries (id, user_id, weight_kg, measured_at, local_date)
  values ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 107.0, now(), current_date)
  on conflict (id) do update set weight_kg = excluded.weight_kg $$,
  'retrying the same client id upserts instead of duplicating');
select is((select count(*) from public.weight_entries)::int, 2, 'still two entries after retry');
select throws_ok($$ insert into public.weight_entries (user_id, weight_kg, measured_at, local_date)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 20, now(), current_date) $$, '23514', null, 'weight below 30 kg rejected');
select throws_ok($$ insert into public.weight_entries (user_id, weight_kg, measured_at, local_date)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 100, now() + interval '3 days', current_date) $$, '23514', null,
  'future weigh-ins rejected');
select lives_ok($$ insert into public.body_measurements (user_id, measurement_type, value_cm, measured_at, local_date)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'waist', 104.5, now(), current_date) $$, 'A logs a measurement');
select throws_ok($$ insert into public.body_measurements (user_id, measurement_type, value_cm, measured_at, local_date)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'ankle', 30, now(), current_date) $$, '23514', null,
  'unknown measurement types rejected');
select lives_ok($$ insert into public.daily_checkins (user_id, local_date, sleep_hours, fatigue, pain)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', current_date, 7.5, 2, 1)
  on conflict (user_id, local_date) do update set sleep_hours = excluded.sleep_hours $$, 'A saves a check-in');
select lives_ok($$ insert into public.daily_checkins (user_id, local_date, sleep_hours, fatigue, pain)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', current_date, 6, 3, 2)
  on conflict (user_id, local_date) do update set sleep_hours = excluded.sleep_hours $$,
  'a second check-in the same day updates it');
select is((select count(*) from public.daily_checkins)::int, 1, 'one check-in per day');
select lives_ok($$ insert into public.user_milestones (user_id, milestone_key, title)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'weight_lost_1', 'First 1 kg lost') on conflict (user_id, milestone_key) do nothing $$,
  'unlock a milestone');
select lives_ok($$ insert into public.user_milestones (user_id, milestone_key, title)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'weight_lost_1', 'First 1 kg lost') on conflict (user_id, milestone_key) do nothing $$,
  'unlocking again is a no-op');
select is((select count(*) from public.user_milestones)::int, 1, 'milestones are never duplicated');
select throws_ok($$ delete from public.user_milestones $$, '42501', null, 'milestones cannot be revoked (delete)');
select throws_ok($$ update public.user_milestones set title = 'x' $$, '42501', null, 'milestones cannot be edited');
select tests.clear_authentication();

-- User B sees nothing of A and cannot write for A.
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000b2');
select is((select count(*) from public.weight_entries)::int, 0, 'B cannot see A weights');
select is((select count(*) from public.body_measurements)::int, 0, 'B cannot see A measurements');
select is((select count(*) from public.daily_checkins)::int, 0, 'B cannot see A check-ins');
select is((select count(*) from public.user_milestones)::int, 0, 'B cannot see A milestones');
delete from public.weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select throws_ok($$ insert into public.weight_entries (user_id, weight_kg, measured_at, local_date)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 80, now(), current_date) $$, '42501', null, 'B cannot log weight for A');
select tests.clear_authentication();
select is((select count(*) from public.weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1')::int, 2,
  'A weights survive B delete attempt');

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select is((select count(*) from public.weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1')::int
  + (select count(*) from public.user_milestones where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1')::int
  + (select count(*) from public.daily_checkins where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1')::int, 0,
  'account deletion removes all progress data');

select * from finish();
rollback;
