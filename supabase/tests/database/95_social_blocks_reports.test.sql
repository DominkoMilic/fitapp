-- Blocking, reporting, deleting the social profile, consent (spec 33, Phase 8A).
begin;
select plan(19);

select tests.social_user('eeeeeeee-0000-0000-0000-0000000000c1', 'alice');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000c2', 'bob');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000c3', 'carol');
insert into public.friendships (user_low, user_high, requested_by, status) values
  ('eeeeeeee-0000-0000-0000-0000000000c1', 'eeeeeeee-0000-0000-0000-0000000000c2',
   'eeeeeeee-0000-0000-0000-0000000000c1', 'accepted'),
  ('eeeeeeee-0000-0000-0000-0000000000c1', 'eeeeeeee-0000-0000-0000-0000000000c3',
   'eeeeeeee-0000-0000-0000-0000000000c1', 'accepted');

-- Blocking
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000c1');
select lives_ok($$ select public.block_user('eeeeeeee-0000-0000-0000-0000000000c2') $$, 'alice blocks bob');
select is((select count(*)::int from public.friendships
           where 'eeeeeeee-0000-0000-0000-0000000000c2' in (user_low, user_high)), 0,
  'blocking ends the friendship');
select is((select relationship from public.get_social_profile('bob')), 'blocked',
  'alice still sees bob as blocked (to unblock)');
select throws_ok($$ select public.send_friend_request('bob') $$, 'P0001', 'blocked',
  'alice must unblock before asking bob');
select is((select handle from public.list_blocked()), 'bob', 'alice lists the people she blocked');

select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.get_social_profile('alice')), 0, 'bob cannot open alice');
select is((select count(*)::int from public.search_social_profiles('alice')), 0, 'bob cannot find alice');
select throws_ok($$ select public.send_friend_request('alice') $$, 'P0001', 'not_found',
  'bob cannot ask alice, and is not told why');
select is((select count(*)::int from public.blocks), 0, 'bob cannot see that he is blocked');
select is((select count(*)::int from public.social_profiles where handle = 'alice'), 0,
  'bob cannot read alice''s profile');

select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000c1');
select public.unblock_user('eeeeeeee-0000-0000-0000-0000000000c2');
select is((select relationship from public.get_social_profile('bob')), 'none', 'unblocking');

-- Reporting
select isnt(public.report_content('profile', 'eeeeeeee-0000-0000-0000-0000000000c2', 'spam', ' fake '), null,
  'alice reports bob');
select is((select note from public.reports), 'fake', 'the reporter sees their own report');
select throws_ok($$ select public.report_content('profile', 'eeeeeeee-0000-0000-0000-0000000000c2', 'boring', null) $$,
  '23514', null, 'only the listed reasons');
select throws_ok($$ insert into public.reports (reporter, target_type, target_id, reason)
                    values ('eeeeeeee-0000-0000-0000-0000000000c1', 'profile',
                            'eeeeeeee-0000-0000-0000-0000000000c2', 'spam') $$,
  '42501', null, 'reports cannot be written directly');
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.reports), 0, 'the reported person cannot see the report');

-- Consent and deleting the social profile
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000c1');
select lives_ok($$ insert into public.consents (id, user_id, consent_type, document_version, granted)
                   values (gen_random_uuid(), 'eeeeeeee-0000-0000-0000-0000000000c1', 'social', '2026-11-17', true) $$,
  'the social consent is recorded');
select public.block_user('eeeeeeee-0000-0000-0000-0000000000c2');
select public.delete_social_profile();
select tests.clear_authentication();
select is((select count(*)::int from public.social_profiles where user_id = 'eeeeeeee-0000-0000-0000-0000000000c1')
          + (select count(*)::int from public.social_settings where user_id = 'eeeeeeee-0000-0000-0000-0000000000c1')
          + (select count(*)::int from public.friendships where 'eeeeeeee-0000-0000-0000-0000000000c1' in (user_low, user_high))
          + (select count(*)::int from public.user_preferences where user_id = 'eeeeeeee-0000-0000-0000-0000000000c1' and social_enabled),
  0, 'deleting the social profile removes profile, settings and friendships and switches social off');
select is((select count(*)::int from public.blocks where blocker = 'eeeeeeee-0000-0000-0000-0000000000c1'), 1,
  'blocks the user made are kept');

select * from finish();
rollback;
