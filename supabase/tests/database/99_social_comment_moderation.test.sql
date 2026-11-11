-- Comment moderation: block vs flag words, owner alerts, comments off (spec 33.7).
begin;
select plan(17);

select tests.social_user('f9000000-0000-0000-0000-0000000000c1', 'poster');
select tests.social_user('f9000000-0000-0000-0000-0000000000c2', 'buddy');
select tests.social_user('f9000000-0000-0000-0000-0000000000c3', 'pal');
select tests.befriend('f9000000-0000-0000-0000-0000000000c1', 'f9000000-0000-0000-0000-0000000000c2');
select tests.befriend('f9000000-0000-0000-0000-0000000000c1', 'f9000000-0000-0000-0000-0000000000c3');
update public.social_settings set workouts_audience = 'friends' where user_id = 'f9000000-0000-0000-0000-0000000000c1';
select tests.workout('f9000000-0000-0000-0000-0000000000c1', 'f9100000-0000-0000-0000-0000000000c1');
create temporary table item as select id from public.feed_items where source_id = 'f9100000-0000-0000-0000-0000000000c1';
grant select on item to authenticated;

-- Words
select ok(public.social_word_hits('Jebote, kakav trening', 'flag'), 'Croatian swearing is flagged');
select ok(public.social_word_hits('ma p1čka materina', 'flag'), 'Croatian letters and look-alikes are folded');
select ok(not public.social_word_hits('Odličan trening!', null), 'ordinary words are fine');
select ok(public.social_word_hits('peder', 'block'), 'regional slurs are blocked');
select ok(not public.social_text_ok('Kreten'), 'names, handles and bios refuse flagged words too');

-- A friend comments: swearing is accepted and flagged, slurs are refused.
select tests.authenticate_as('f9000000-0000-0000-0000-0000000000c2');
select isnt(public.add_comment((select id from item), 'Jebeno dobar trening'), null, 'a swearing comment is accepted');
select throws_ok($$ select public.add_comment((select id from item), 'peder') $$, 'P0001', 'not_allowed',
  'a comment with a slur is refused');
select is((select flagged from public.list_comments((select id from item))), false,
  'only the post owner sees that a comment is flagged');
select is((select is_mine from public.list_comments((select id from item))), true, 'your own comment is marked');
select throws_ok($$ select public.set_comments_off((select id from item), true) $$, 'P0001', 'not_found',
  'only the post owner can turn comments off');

-- The owner sees the flag, turns comments off and on.
select tests.authenticate_as('f9000000-0000-0000-0000-0000000000c1');
select is((select flagged from public.list_comments((select id from item))), true, 'the owner sees the flag');
select lives_ok($$ select public.set_comments_off((select id from item), true) $$, 'the owner turns comments off');
select is((select count(*)::int from public.list_comments((select id from item))), 0, 'comments are hidden while off');
select is((select comments_off::text || comment_count from public.get_feed(null, 20, null)), 'true0',
  'the feed says comments are off and counts none');

select tests.authenticate_as('f9000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select public.add_comment((select id from item), 'Nice!') $$, 'P0001', 'comments_off',
  'nobody can comment while comments are off');
select lives_ok($$ select public.set_cheer((select id from item), 'fire') $$, 'cheers still work');

select tests.authenticate_as('f9000000-0000-0000-0000-0000000000c1');
select public.set_comments_off((select id from item), false);
select is((select count(*)::int from public.list_comments((select id from item))), 1,
  'turning comments back on shows the earlier comments again');

select * from finish();
rollback;
