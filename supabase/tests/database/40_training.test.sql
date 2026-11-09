-- Phase 3: exercise catalogue, custom exercises, scheduled workouts, sessions and sets.
begin;
select plan(24);

select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000c1', 'ta@example.com');
select tests.create_user('bbbbbbbb-0000-0000-0000-0000000000c2', 'tb@example.com');

-- Seeded catalogue
select is((select count(*) from public.exercises where owner_id is null)::int, 87, '87 system exercises seeded');
select is((select count(*) from public.workout_templates)::int, 20, '20 templates seeded');
select is((select count(*) from public.workout_template_exercises t left join public.exercises e on e.id = t.exercise_id where e.id is null)::int, 0,
  'every template exercise exists');
select is((select count(*) from public.exercises where owner_id is null and array_length(instructions, 1) >= 2 and caution_notes is not null)::int, 87,
  'every system exercise has instructions and caution notes');

-- Custom exercises
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000c1');
select lives_ok($$ insert into public.exercises (id, owner_id, name, category, tracking_type)
  values ('e0000000-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'Farmer walk', 'core', 'time') $$, 'A creates a custom exercise');
select is((select count(*) from public.exercises)::int, 88, 'A sees system + own exercises');
update public.exercises set name = 'hacked' where slug = 'push-up';
select tests.clear_authentication();
select is((select name from public.exercises where slug = 'push-up'), 'Push-up', 'users cannot modify system exercises');
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000c1');
select throws_ok($$ delete from public.exercises where id = 'e0000000-0000-0000-0000-0000000000e1' $$, '42501', null,
  'custom exercises are archived, never deleted');
select lives_ok($$ update public.exercises set archived_at = now() where id = 'e0000000-0000-0000-0000-0000000000e1' $$, 'A archives own exercise');

-- Scheduled workouts: idempotent generation
select lives_ok($$ insert into public.scheduled_workouts (user_id, occurrence_key, kind, title, category, intensity, scheduled_date)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'plan:p1:2026-11-16', 'workout', 'Strength A', 'strength', 'moderate', '2026-11-16')
  on conflict (user_id, occurrence_key) do nothing $$, 'generate an occurrence');
update public.scheduled_workouts set id = 'd0000000-0000-0000-0000-0000000000d1' where occurrence_key = 'plan:p1:2026-11-16';
update public.scheduled_workouts set status = 'skipped', is_user_modified = true where occurrence_key = 'plan:p1:2026-11-16';
select lives_ok($$ insert into public.scheduled_workouts (user_id, occurrence_key, kind, title, category, intensity, scheduled_date)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'plan:p1:2026-11-16', 'workout', 'Strength A', 'strength', 'moderate', '2026-11-16')
  on conflict (user_id, occurrence_key) do nothing $$, 'regenerating the same occurrence is a no-op');
select is((select count(*) from public.scheduled_workouts)::int, 1, 'no duplicate occurrences');
select is((select status from public.scheduled_workouts), 'skipped', 'user changes survive regeneration');

-- Sessions and sets
select lives_ok($$ insert into public.workout_sessions (id, user_id, scheduled_workout_id, title, category, started_at, ended_at, local_date, duration_seconds, completion_status)
  values ('50000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1',
          (select id from public.scheduled_workouts limit 1), 'Strength A', 'strength', now() - interval '45 minutes', now(), current_date, 2700, 'completed') $$,
  'A saves a session');
select lives_ok($$ insert into public.exercise_sets (user_id, workout_session_id, exercise_id, exercise_name, exercise_slug, set_number, repetitions, weight_kg, completed)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-0000000000a1',
          (select id from public.exercises where slug = 'goblet-squat'), 'Goblet squat', 'goblet-squat', 1, 12, 5, true) $$, 'A saves a set');
select throws_ok($$ insert into public.workout_sessions (user_id, title, category, started_at, ended_at, local_date, duration_seconds, completion_status)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'x', 'strength', now(), now() - interval '1 hour', current_date, 10, 'completed') $$,
  '23514', null, 'end before start is rejected');
select tests.clear_authentication();

-- Isolation
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000c2');
select is((select count(*) from public.exercises)::int, 87, 'B does not see A custom exercise');
select is((select count(*) from public.scheduled_workouts)::int, 0, 'B cannot see A schedule');
select is((select count(*) from public.workout_sessions)::int, 0, 'B cannot see A sessions');
select is((select count(*) from public.exercise_sets)::int, 0, 'B cannot see A sets');
select throws_ok($$ insert into public.exercise_sets (user_id, workout_session_id, exercise_name, set_number)
  values ('bbbbbbbb-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-0000000000a1', 'x', 1) $$, '42501', null,
  'B cannot add sets to A session');
select throws_ok($$ insert into public.workout_sessions (user_id, scheduled_workout_id, title, category, started_at, ended_at, local_date, duration_seconds, completion_status)
  values ('bbbbbbbb-0000-0000-0000-0000000000c2', 'd0000000-0000-0000-0000-0000000000d1', 'x', 'strength', now(), now(), current_date, 0, 'completed') $$,
  '42501', null, 'B cannot attach a session to A scheduled workout');
select tests.clear_authentication();

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
select is((select count(*) from public.exercise_sets where user_id = 'aaaaaaaa-0000-0000-0000-0000000000c1')::int
  + (select count(*) from public.workout_sessions where user_id = 'aaaaaaaa-0000-0000-0000-0000000000c1')::int
  + (select count(*) from public.scheduled_workouts where user_id = 'aaaaaaaa-0000-0000-0000-0000000000c1')::int
  + (select count(*) from public.exercises where owner_id = 'aaaaaaaa-0000-0000-0000-0000000000c1')::int, 0,
  'account deletion removes all training data');
select is((select count(*) from public.exercises where owner_id is null)::int, 87, 'system exercises remain');

select * from finish();
rollback;
