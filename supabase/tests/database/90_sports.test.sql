-- All-sport support: any sport's events, a sports list, sport drills; garbage rejected.
begin;
select plan(12);
select tests.create_user('99999999-0000-0000-0000-000000000001', 'sport@example.com');
select tests.authenticate_as('99999999-0000-0000-0000-000000000001');

select lives_ok($$ insert into public.user_preferences (user_id, sports) values ('99999999-0000-0000-0000-000000000001', array['basketball', 'table_tennis']) $$,
  'a user can play several sports');
select throws_ok($$ update public.user_preferences set sports = array['Basket Ball!'] where user_id = '99999999-0000-0000-0000-000000000001' $$,
  '23514', null, 'malformed sport keys are rejected');
select throws_ok($$ update public.user_preferences set sports = array['a1','b','c','d','e','f','g','h','i'] where user_id = '99999999-0000-0000-0000-000000000001' $$,
  '23514', null, 'at most 8 sports');
select lives_ok($$ update public.user_preferences set sports = '{}' where user_id = '99999999-0000-0000-0000-000000000001' $$,
  'no sport at all is fine');

select lives_ok($$ insert into public.recurring_events (user_id, title, category, weekday, local_time, duration_minutes, intensity, timezone, starts_on)
  values ('99999999-0000-0000-0000-000000000001', 'League game', 'basketball_match', 6, '18:00', 90, 'hard', 'Europe/Zagreb', current_date) $$,
  'basketball games are accepted');
select lives_ok($$ insert into public.recurring_events (user_id, title, category, weekday, local_time, duration_minutes, intensity, timezone, starts_on)
  values ('99999999-0000-0000-0000-000000000001', 'Club', 'table_tennis_practice', 2, '19:00', 60, 'moderate', 'Europe/Zagreb', current_date) $$,
  'sports with underscores are accepted');
select lives_ok($$ insert into public.recurring_events (user_id, title, category, weekday, local_time, duration_minutes, intensity, timezone, starts_on)
  values ('99999999-0000-0000-0000-000000000001', 'Long run', 'run', 7, '09:00', 60, 'moderate', 'Europe/Zagreb', current_date) $$,
  'activities are still accepted');
select throws_ok($$ insert into public.recurring_events (user_id, title, category, weekday, local_time, duration_minutes, intensity, timezone, starts_on)
  values ('99999999-0000-0000-0000-000000000001', 'x', 'basketball_final', 6, '18:00', 90, 'hard', 'Europe/Zagreb', current_date) $$,
  '23514', null, 'unknown event types are rejected');

select lives_ok($$ insert into public.user_goals (user_id, goal_type, starting_weight_kg, focus_tags) values ('99999999-0000-0000-0000-000000000001', 'maintain', 80, array['sport', 'strength']) $$,
  'the generic sport focus tag is accepted');
select is((select focus_tags from public.user_goals where user_id = '99999999-0000-0000-0000-000000000001'
    and focus_tags @> array['sport'] limit 1), array['sport', 'strength'], 'focus tags stored');
update public.user_goals set focus_tags = array['futsal', 'strength'] where user_id = '99999999-0000-0000-0000-000000000001';
select is((select focus_tags from public.user_goals where user_id = '99999999-0000-0000-0000-000000000001' limit 1),
  array['sport', 'strength'], 'older app versions sending futsal still work (stored as sport)');
select tests.clear_authentication();

select ok(position('pr -> ''sports''' in pg_get_functiondef('public.complete_onboarding(jsonb)'::regprocedure)) > 0,
  'onboarding saves the sports list');

select * from finish();
rollback;
