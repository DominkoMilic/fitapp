-- Friend requests: send, accept, decline, remove, limits (spec 33, Phase 8A).
begin;
select plan(20);

select tests.social_user('eeeeeeee-0000-0000-0000-0000000000b1', 'alice');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000b2', 'bob');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000b3', 'carol');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000b4', 'dora');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000b5', 'popular');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000b6', 'offline', true, false);
select tests.create_user('eeeeeeee-0000-0000-0000-0000000000b7', 'noprofile@example.com');
update public.social_settings set friend_requests_from = 'nobody'
  where user_id = 'eeeeeeee-0000-0000-0000-0000000000b4';

-- `popular` already has 500 friends.
insert into auth.users (id, email)
  select ('eeeeeeee-1111-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'f' || g || '@example.com'
  from generate_series(1, 500) g;
insert into public.friendships (user_low, user_high, requested_by, status)
  select least(u, p), greatest(u, p), u, 'accepted'
  from (select ('eeeeeeee-1111-0000-0000-' || lpad(g::text, 12, '0'))::uuid as u,
               'eeeeeeee-0000-0000-0000-0000000000b5'::uuid as p
        from generate_series(1, 500) g) x;

select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000b1');
select is(public.send_friend_request('bob'), 'outgoing', 'alice asks bob');
select is((select count(*)::int from public.friendships), 1, 'alice sees her request');
select is((select count(*)::int from public.social_profiles where handle = 'bob'), 1,
  'a pending request makes the two profiles visible to each other');
select is(public.send_friend_request('bob'), 'outgoing', 'asking again changes nothing');
select throws_ok($$ select public.send_friend_request('dora') $$, 'P0001', 'requests_closed',
  'people who allow no requests cannot be asked');
select throws_ok($$ select public.send_friend_request('nobody_here') $$, 'P0001', 'not_found',
  'unknown handle');
select throws_ok($$ select public.send_friend_request('alice') $$, 'P0001', 'not_found',
  'you cannot add yourself');
select throws_ok($$ select public.send_friend_request('offline') $$, 'P0001', 'not_found',
  'people with social off cannot be asked');
select throws_ok($$ select public.send_friend_request('popular') $$, 'P0001', 'friend_limit',
  'at most 500 friends');
select throws_ok($$ insert into public.friendships (user_low, user_high, requested_by)
                    values ('eeeeeeee-0000-0000-0000-0000000000b1', 'eeeeeeee-0000-0000-0000-0000000000b3',
                            'eeeeeeee-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'friendships cannot be written directly');
select throws_ok($$ select public.accept_friend_request('eeeeeeee-0000-0000-0000-0000000000b2') $$,
  'P0001', 'not_found', 'you cannot accept your own request');

select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.friendships), 0, 'others do not see the request');

select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000b2');
select is((select relationship from public.list_friendships() where handle = 'alice'), 'incoming',
  'bob sees an incoming request');
select is(public.send_friend_request('alice'), 'friends', 'asking back accepts the request');
select is((select relationship from public.list_friendships() where handle = 'alice'), 'friends',
  'they are friends');
select lives_ok($$ select public.remove_friend('eeeeeeee-0000-0000-0000-0000000000b1') $$, 'bob removes alice');
select is((select count(*)::int from public.friendships), 0, 'the friendship is gone');

-- Declining is removing a pending request.
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000b3');
select public.send_friend_request('bob');
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000b2');
select public.remove_friend('eeeeeeee-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.list_friendships()), 0, 'a declined request disappears');

-- Who may act
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000b7');
select throws_ok($$ select public.send_friend_request('bob') $$, 'P0001', 'no_profile',
  'social must be set up first');

-- 30 requests a day
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000b1');
select throws_ok($$ select count(*) from generate_series(1, 40) g,
                    lateral public.send_friend_request('bob' || left(g::text, 0)) $$,
  'P0001', 'rate_limited', 'friend requests are limited to 30 a day');

select * from finish();
rollback;
