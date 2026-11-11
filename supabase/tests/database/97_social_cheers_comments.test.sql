-- Cheers, comments, hiding and who sees what (spec 33.3, 33.7).
begin;
select plan(19);

select tests.social_user('f0000000-0000-0000-0000-0000000000b1', 'owner1');
select tests.social_user('f0000000-0000-0000-0000-0000000000b2', 'friend1');
select tests.social_user('f0000000-0000-0000-0000-0000000000b3', 'stranger1');
select tests.social_user('f0000000-0000-0000-0000-0000000000b4', 'friend2');
select tests.befriend('f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000b2');
select tests.befriend('f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000b4');
update public.social_settings set workouts_audience = 'friends' where user_id = 'f0000000-0000-0000-0000-0000000000b1';
select tests.workout('f0000000-0000-0000-0000-0000000000b1', 'f1000000-0000-0000-0000-0000000000b1');
create temporary table item as select id from public.feed_items where source_id = 'f1000000-0000-0000-0000-0000000000b1';
grant select on item to authenticated;

-- A friend cheers and comments.
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b2');
select lives_ok($$ select public.set_cheer((select id from item), 'fire') $$, 'a friend can cheer');
select lives_ok($$ select public.set_cheer((select id from item), 'clap') $$, 'cheering again changes the kind');
select is((select cheers from public.get_feed(null, 20, null)), '{"clap": 1}'::jsonb, 'one cheer per person');
select is((select my_cheer from public.get_feed(null, 20, null)), 'clap', 'your own cheer is shown');
select isnt(public.add_comment((select id from item), '  Great session!  '), null, 'a friend can comment');
select throws_ok($$ select public.add_comment((select id from item), 'you are a whore') $$,
  'P0001', 'not_allowed', 'comments with blocked words (slurs, hate) are refused');
select throws_ok($$ select public.add_comment((select id from item), repeat('a', 281)) $$,
  '23514', null, 'comments are at most 280 characters');
select is((select body from public.list_comments((select id from item))), 'Great session!', 'comments are trimmed and listed');
select throws_ok($$ insert into public.cheers (feed_item_id, user_id) values ((select id from item), 'f0000000-0000-0000-0000-0000000000b2') $$,
  '42501', null, 'cheers cannot be written directly');

-- The owner cannot cheer their own item but can remove comments on it.
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.set_cheer((select id from item), 'star') $$, 'P0001', 'not_allowed',
  'you cannot cheer your own item');
select is((select can_delete from public.list_comments((select id from item))), true, 'the owner may remove comments');

-- A stranger sees nothing and cannot act.
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.feed_items) + (select count(*)::int from public.comments), 0,
  'a stranger sees no items or comments');
select throws_ok($$ select public.set_cheer((select id from item), 'clap') $$, 'P0001', 'not_found',
  'a stranger cannot cheer');

-- Another friend cannot delete someone else's comment.
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b4');
select throws_ok($$ select public.delete_comment((select c.id from public.comments c limit 1)) $$, 'P0001', 'not_found',
  'only the author or the owner removes a comment');

-- Author removes the comment: it stays as "removed" without text.
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b2');
select lives_ok($$ select public.delete_comment((select c.id from public.comments c limit 1)) $$, 'the author removes it');
select is((select count(*)::int from public.comments), 0,
  'a removed comment is deleted completely (no placeholder)');

-- Blocking and hiding
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b1');
select public.block_user('f0000000-0000-0000-0000-0000000000b2');
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.get_feed(null, 20, null)), 0, 'a blocked person no longer sees the item');
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b1');
select public.hide_feed_item((select id from item));
select tests.authenticate_as('f0000000-0000-0000-0000-0000000000b4');
select is((select count(*)::int from public.get_feed(null, 20, null)), 0, 'a removed item disappears for friends');
select tests.clear_authentication();

-- Push stays off: no pg_net call is queued, nothing breaks.
select is((select value #>> '{}' from public.app_config where key = 'push_enabled'), 'false', 'push is off until 8B-2');

select * from finish();
rollback;
