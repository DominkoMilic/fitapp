-- Hiding earlier posts when a sharing type is switched off, and showing them again.
begin;
select plan(9);

select tests.social_user('f0000000-0000-0000-0000-0000000000c1', 'hider');
select tests.social_user('f0000000-0000-0000-0000-0000000000c2', 'watcher');
select tests.befriend('f0000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-0000000000c2');
update public.social_settings set workouts_audience = 'friends' where user_id = 'f0000000-0000-0000-0000-0000000000c1';
select tests.workout('f0000000-0000-0000-0000-0000000000c1', 'f1000000-0000-0000-0000-0000000000c1');
select tests.workout('f0000000-0000-0000-0000-0000000000c1', 'f1000000-0000-0000-0000-0000000000c2');
select tests.workout('f0000000-0000-0000-0000-0000000000c1', 'f1000000-0000-0000-0000-0000000000c3');

select tests.authenticate_as('f0000000-0000-0000-0000-0000000000c1');
-- One post removed by hand first.
select public.hide_feed_item((select id from public.feed_items where source_id = 'f1000000-0000-0000-0000-0000000000c3'));
select is(public.hide_my_posts('workout'), 2, 'switching off hides the remaining earlier posts');
select is(public.hidden_post_count('workout'), 2, 'they can be counted for the "show again" offer');
select throws_ok($$ select public.hide_my_posts('weight') $$, 'P0001', 'not_allowed', 'only feed kinds');

select tests.authenticate_as('f0000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.get_feed(null, 20, null)), 0, 'friends no longer see them');

select tests.authenticate_as('f0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.get_feed(null, 20, null)), 0, 'nor does the owner in the feed');
select is(public.show_my_posts('workout'), 2, 'switching on can show them again');
select is((select count(*)::int from public.feed_items where hidden_at is not null), 1,
  'a post removed by hand stays removed');

select tests.authenticate_as('f0000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.get_feed(null, 20, null)), 2, 'friends see the shown posts again');
select tests.clear_authentication();
select throws_ok($$ update public.feed_items set hidden_reason = 'removed' where hidden_at is null $$,
  '23514', null, 'a reason only goes with a hidden post');

select * from finish();
rollback;
