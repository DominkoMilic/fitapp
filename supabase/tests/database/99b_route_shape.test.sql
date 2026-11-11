-- Route shape on shared activities: opt-in, the line only, removed with the route (spec 33).
begin;
select plan(6);

select tests.social_user('fa000000-0000-0000-0000-0000000000d1', 'runner');
update public.social_settings set activities_audience = 'friends'
where user_id = 'fa000000-0000-0000-0000-0000000000d1';

insert into public.activities (id, user_id, activity_type, started_at, ended_at, local_date, elapsed_seconds,
  moving_seconds, distance_meters, average_pace_seconds_per_km, source, route_shape)
values ('fa100000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-0000000000d1', 'run',
  '2026-11-18 06:00+00', '2026-11-18 06:30+00', '2026-11-18', 1800, 1680, 5210, 322, 'gps',
  '[[[0, 500], [500, 0], [1000, 500]]]');
select ok((select not (snapshot ? 'shape') from public.feed_items
           where source_id = 'fa100000-0000-0000-0000-000000000001'),
  'the shape is not shared until the user turns it on');

update public.social_settings set share_route_shape = true
where user_id = 'fa000000-0000-0000-0000-0000000000d1';
update public.activities set notes = 'loop' where id = 'fa100000-0000-0000-0000-000000000001';
select is((select snapshot -> 'shape' from public.feed_items
           where source_id = 'fa100000-0000-0000-0000-000000000001'),
  '[[[0, 500], [500, 0], [1000, 500]]]'::jsonb, 'with sharing on, the post carries the shape');
select ok((select not (snapshot::text ~ 'lat|lng|route_storage_path|started_at') from public.feed_items
           where source_id = 'fa100000-0000-0000-0000-000000000001'),
  'no coordinates, file path or clock time are shared');

select throws_ok($$ update public.activities set route_shape = '{"not": "an array"}'
                    where id = 'fa100000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a shape must be a list of pieces');

update public.activities set route_storage_path = null, route_deleted_at = now()
where id = 'fa100000-0000-0000-0000-000000000001';
select is((select route_shape from public.activities where id = 'fa100000-0000-0000-0000-000000000001'),
  null, 'deleting the route deletes its shape');
select ok((select not (snapshot ? 'shape') from public.feed_items
           where source_id = 'fa100000-0000-0000-0000-000000000001'),
  'and the post no longer shows it');


select * from finish();
rollback;
