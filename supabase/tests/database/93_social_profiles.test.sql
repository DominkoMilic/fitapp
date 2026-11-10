-- Social profiles: handle rules, word filter, who can see a profile, search (spec 33, Phase 8A).
begin;
select plan(24);

select tests.social_user('eeeeeeee-0000-0000-0000-0000000000a1', 'alice');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000a2', 'bob');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000a3', 'carol', false);
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000a4', 'alina_off', true, false);
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000a5', 'aliban');
select tests.social_user('eeeeeeee-0000-0000-0000-0000000000a6', 'alisha');
update public.social_profiles set banned_at = now() where handle = 'aliban';
insert into public.blocks (blocker, blocked)
  values ('eeeeeeee-0000-0000-0000-0000000000a6', 'eeeeeeee-0000-0000-0000-0000000000a2');
select tests.create_user('eeeeeeee-0000-0000-0000-0000000000f1', 'new@example.com');

-- Creating a profile
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000f1');
select throws_ok($$ insert into public.social_profiles (user_id, handle, display_name)
                    values ('eeeeeeee-0000-0000-0000-0000000000f1', 'support', 'Help') $$,
  'P0001', 'handle_reserved', 'reserved handles are refused');
select throws_ok($$ insert into public.social_profiles (user_id, handle, display_name)
                    values ('eeeeeeee-0000-0000-0000-0000000000f1', 'sh1tlord', 'Me') $$,
  'P0001', 'not_allowed', 'blocked words are refused, also with look-alike characters');
select throws_ok($$ insert into public.social_profiles (user_id, handle, display_name)
                    values ('eeeeeeee-0000-0000-0000-0000000000f1', 'newbie', 'Fuck off') $$,
  'P0001', 'not_allowed', 'the display name is filtered too');
select throws_ok($$ insert into public.social_profiles (user_id, handle, display_name)
                    values ('eeeeeeee-0000-0000-0000-0000000000f1', 'no spaces!', 'Me') $$,
  '23514', null, 'handles use only a-z, 0-9, _ and .');
select throws_ok($$ insert into public.social_profiles (user_id, handle, display_name)
                    values ('eeeeeeee-0000-0000-0000-0000000000a2', 'imposter', 'Bob') $$,
  '42501', null, 'nobody can create a profile for someone else');
select throws_ok($$ insert into public.social_profiles (user_id, handle, display_name)
                    values ('eeeeeeee-0000-0000-0000-0000000000f1', 'alice', 'Alice 2') $$,
  '23505', null, 'handles are unique');
select lives_ok($$ insert into public.social_profiles (user_id, handle, display_name)
                   values ('eeeeeeee-0000-0000-0000-0000000000f1', 'Newbie', 'New Person') $$,
  'a user creates their own profile');
select is((select handle from public.social_profiles where user_id = 'eeeeeeee-0000-0000-0000-0000000000f1'),
  'newbie', 'handles are stored lower-case');
select throws_ok($$ update public.social_profiles set banned_at = null
                    where user_id = 'eeeeeeee-0000-0000-0000-0000000000f1' $$,
  '42501', null, 'users cannot change their ban');

-- Seeing profiles and settings
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.social_profiles where handle = 'alice'), 0,
  'a stranger cannot read a profile directly');
select is((select count(*)::int from public.social_settings), 1, 'only your own settings are visible');
select is((select workouts_audience || activities_audience || milestones_audience
                  || challenge_results_audience || in_leaderboards::text || share_volume::text
           from public.social_settings),
  'privateprivateprivateprivatefalsefalse', 'everything is private and off by default');

-- Search
select is((select array_agg(handle order by handle) from public.search_social_profiles('ALI')),
  array['alice'],
  'search finds discoverable people with social on; not banned, switched off or blocking you');
select is((select count(*)::int from public.search_social_profiles('al')), 0,
  'search needs at least 3 characters');
select is((select count(*)::int from public.search_social_profiles('car')), 0,
  'people who are not discoverable are not found');
select is((select relationship from public.search_social_profiles('alice')), 'none',
  'results carry the relationship');
select is((select count(*)::int from public.get_social_profile('carol')), 0,
  'a hidden, unrelated profile cannot be opened');
select is((select count(*)::int from public.get_social_profile('alisha')), 0,
  'a profile that blocked you cannot be opened');
select is((select display_name from public.get_social_profile('alice')), 'Alice',
  'a discoverable profile can be opened');
select ok(not public.social_handle_available('alice') and public.social_handle_available('free_name')
          and not public.social_handle_available('admin'), 'handle availability');

-- Anonymous and kill switch
select tests.become_anon();
select throws_ok($$ select * from public.search_social_profiles('alice') $$, '42501', null,
  'signed-out callers cannot search');
select tests.clear_authentication();
update public.app_config set value = 'false' where key = 'social_enabled';
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000a2');
select throws_ok($$ select * from public.search_social_profiles('alice') $$, 'P0001', 'social_disabled',
  'the server kill switch stops social actions');
select tests.clear_authentication();
update public.app_config set value = 'true' where key = 'social_enabled';

-- Rate limit: 60 searches an hour
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000a1');
select lives_ok($$ select count(*) from generate_series(1, 50) g,
                   lateral public.search_social_profiles('bob' || left(g::text, 0)) $$,
  'normal searching is fine');
select throws_ok($$ select count(*) from generate_series(1, 20) g,
                    lateral public.search_social_profiles('bob' || left(g::text, 0)) $$,
  'P0001', 'rate_limited', 'search is limited to 60 an hour');

select * from finish();
rollback;
