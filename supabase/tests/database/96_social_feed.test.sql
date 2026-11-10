-- Feed items: created only when shared, whitelisted snapshot, follow edits and deletes (spec 33.3).
begin;
select plan(17);

select tests.social_user('f0000000-0000-0000-0000-0000000000a1', 'ann');
select tests.social_user('f0000000-0000-0000-0000-0000000000a2', 'ben');
select tests.befriend('f0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000a2');

-- Nothing is shared by default.
select tests.workout('f0000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.feed_items), 0, 'a workout is not shared while workouts are private');

update public.social_settings set workouts_audience = 'friends', activities_audience = 'friends',
  milestones_audience = 'friends' where user_id = 'f0000000-0000-0000-0000-0000000000a1';

select tests.workout('f0000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.feed_items where source_id = 'f1000000-0000-0000-0000-000000000002'), 1,
  'a shared workout creates one feed item');
select is((select array_agg(k order by k) from public.feed_items f, jsonb_object_keys(f.snapshot) k
           where source_id = 'f1000000-0000-0000-0000-000000000002'),
  array['category', 'duration_min', 'sets', 'title'],
  'the snapshot has only whitelisted keys (no notes, times, effort or volume)');
select is((select snapshot ->> 'duration_min' from public.feed_items where source_id = 'f1000000-0000-0000-0000-000000000002'),
  '45', 'duration in whole minutes');

-- Sets count follows the sets inserted after the session row.
insert into public.exercise_sets (user_id, workout_session_id, exercise_name, set_number, repetitions, completed)
select 'f0000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-000000000002', 'Squat', g, 10, g <= 3
from generate_series(1, 4) g;
select is((select (snapshot ->> 'sets')::int from public.feed_items where source_id = 'f1000000-0000-0000-0000-000000000002'),
  3, 'the set count follows completed sets');

-- Volume only when chosen.
update public.social_settings set share_volume = true where user_id = 'f0000000-0000-0000-0000-0000000000a1';
update public.workout_sessions set title = 'Strength B' where id = 'f1000000-0000-0000-0000-000000000002';
select is((select snapshot ->> 'volume_kg' from public.feed_items where source_id = 'f1000000-0000-0000-0000-000000000002'),
  '1200.0', 'volume appears only with share_volume');
select is((select snapshot ->> 'title' from public.feed_items where source_id = 'f1000000-0000-0000-0000-000000000002'),
  'Strength B', 'edits update the snapshot');

-- Abandoned or deleted sources disappear.
update public.workout_sessions set completion_status = 'abandoned' where id = 'f1000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.feed_items where source_id = 'f1000000-0000-0000-0000-000000000002'), 0,
  'abandoning a workout removes its item');
select tests.workout('f0000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-000000000003');
delete from public.workout_sessions where id = 'f1000000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.feed_items where source_id = 'f1000000-0000-0000-0000-000000000003'), 0,
  'deleting a workout removes its item');

-- Activities: no route, no clock time.
insert into public.activities (id, user_id, activity_type, started_at, ended_at, local_date, elapsed_seconds,
  moving_seconds, distance_meters, average_pace_seconds_per_km, source, notes)
values ('f2000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000a1', 'run',
  '2026-11-18 06:00+00', '2026-11-18 06:30+00', '2026-11-18', 1800, 1680, 5210, 322, 'gps', 'park loop');
select is((select snapshot from public.feed_items where source_id = 'f2000000-0000-0000-0000-000000000001'),
  '{"type": "run", "manual": false, "moving_min": 28, "distance_km": 5.21, "pace_s_per_km": 322}'::jsonb,
  'an activity shares type, distance, moving time and pace only');

-- Milestones: never weight.
insert into public.user_milestones (id, user_id, milestone_key, title, metadata) values
  ('f3000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000a1', 'weight_lost_5', '5 kg down', '{"category": "weight"}'),
  ('f3000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-0000000000a1', 'weigh_in_30', '30 weigh-ins', '{"category": "consistency"}'),
  ('f3000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-0000000000a1', 'run_5k', 'First 5 km run', '{"category": "activity", "achieved_on": "2026-11-18"}');
select is((select array_agg(snapshot ->> 'title') from public.feed_items where kind = 'milestone'),
  array['First 5 km run'], 'weight milestones are never shared');

-- Visibility
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.feed_items), 2, 'a friend sees the shared items');
select is((select count(*)::int from public.workout_sessions), 0, 'the friend still cannot read the source tables');
select is((select count(*)::int from public.get_feed(null, 20, null)), 2, 'get_feed returns them');
select throws_ok($$ insert into public.feed_items (owner, kind, source_id, audience, local_date)
                    values ('f0000000-0000-0000-0000-0000000000a2', 'workout', gen_random_uuid(), 'friends', current_date) $$,
  '42501', null, 'feed items cannot be written directly');
select tests.clear_authentication();

-- Turning social off removes what was shared.
update public.user_preferences set social_enabled = false where user_id = 'f0000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.feed_items where owner = 'f0000000-0000-0000-0000-0000000000a1'), 0,
  'social off deletes your feed items');
select tests.workout('f0000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.feed_items where owner = 'f0000000-0000-0000-0000-0000000000a1'), 0,
  'nothing new is shared while social is off');

select * from finish();
rollback;
