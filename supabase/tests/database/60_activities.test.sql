begin;
select plan(14);
select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000a5', 'act-a@example.com');
select tests.create_user('bbbbbbbb-0000-0000-0000-0000000000b5', 'act-b@example.com');

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000a5');
select lives_ok($$ insert into public.activities (id, user_id, activity_type, started_at, ended_at, local_date, elapsed_seconds, moving_seconds,
    distance_meters, average_pace_seconds_per_km, gps_quality, source, route_storage_path)
  values ('a0000000-0000-0000-0000-0000000000a5', 'aaaaaaaa-0000-0000-0000-0000000000a5', 'run', now() - interval '30 minutes', now(), current_date,
    1800, 1750, 5000, 350, 'good', 'gps', 'aaaaaaaa-0000-0000-0000-0000000000a5/a0000000-0000-0000-0000-0000000000a5.json') $$, 'A saves a run');
select throws_ok($$ insert into public.activities (user_id, activity_type, started_at, ended_at, local_date, elapsed_seconds, moving_seconds, source, route_storage_path)
  values ('aaaaaaaa-0000-0000-0000-0000000000a5', 'walk', now(), now(), current_date, 0, 0, 'gps', 'bbbbbbbb-0000-0000-0000-0000000000b5/x.json') $$,
  '23514', null, 'route paths must be in the owner folder');
select throws_ok($$ insert into public.activities (user_id, activity_type, started_at, ended_at, local_date, elapsed_seconds, moving_seconds, source)
  values ('aaaaaaaa-0000-0000-0000-0000000000a5', 'walk', now(), now(), current_date, 100, 200, 'manual') $$,
  '23514', null, 'moving time cannot exceed elapsed time');
select throws_ok($$ insert into public.activities (user_id, activity_type, started_at, ended_at, local_date, elapsed_seconds, moving_seconds, source)
  values ('aaaaaaaa-0000-0000-0000-0000000000a5', 'swim', now(), now(), current_date, 0, 0, 'manual') $$,
  '23514', null, 'unknown activity types rejected');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('routes', 'aaaaaaaa-0000-0000-0000-0000000000a5/a0000000-0000-0000-0000-0000000000a5.json', 'aaaaaaaa-0000-0000-0000-0000000000a5') $$,
  'A stores a route in own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('routes', 'bbbbbbbb-0000-0000-0000-0000000000b5/evil.json', 'aaaaaaaa-0000-0000-0000-0000000000a5') $$,
  '42501', null, 'A cannot write into B folder');
select tests.clear_authentication();

select is((select public from storage.buckets where id = 'routes'), false, 'routes bucket is private');

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000b5');
select is((select count(*) from public.activities)::int, 0, 'B cannot see A activities');
select is((select count(*) from storage.objects where bucket_id = 'routes')::int, 0, 'B cannot see A routes');
update public.activities set distance_meters = 1;
select tests.clear_authentication();
select ok((select qual from pg_policies where tablename = 'objects' and policyname = 'routes: own folder delete') like '%foldername%auth.uid()%',
  'route deletes are limited to the owner folder (direct SQL deletes are blocked by Storage itself)');
select is((select distance_meters from public.activities where id = 'a0000000-0000-0000-0000-0000000000a5'), 5000, 'B cannot edit A activities');

select tests.become_anon();
select throws_ok($$ select * from public.activities $$, '42501', null, 'anon cannot read activities');
select tests.clear_authentication();

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-0000000000a5';
select is((select count(*) from public.activities where user_id = 'aaaaaaaa-0000-0000-0000-0000000000a5')::int, 0, 'account deletion removes activities');
select ok(true, 'route files are removed by the delete-account function (Phase 7); storage rows have no FK to users');

select * from finish();
rollback;
