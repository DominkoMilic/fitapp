-- Test helpers (pgTAP). Loaded first; creates functions in the `tests` schema.
-- Each test file runs inside its own transaction and rolls back.
begin;
select plan(1);

create schema if not exists tests;

create or replace function tests.create_user(uid uuid, email text) returns void
language sql as $$
  insert into auth.users (id, email) values (uid, email);
$$;

-- Become an authenticated user for the rest of the transaction.
create or replace function tests.authenticate_as(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.become_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.clear_authentication() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

-- A user with social set up (as the superuser, before authenticating).
create or replace function tests.social_user(uid uuid, h text, is_discoverable boolean default true,
                                             social_on boolean default true) returns void
language plpgsql as $$
begin
  perform tests.create_user(uid, h || '@example.com');
  insert into public.user_preferences (user_id, social_enabled) values (uid, social_on)
    on conflict (user_id) do update set social_enabled = excluded.social_enabled;
  insert into public.social_profiles (user_id, handle, display_name, discoverable)
    values (uid, h, initcap(h), is_discoverable);
  insert into public.social_settings (user_id) values (uid);
end;
$$;

-- Friends (accepted), as the superuser.
create or replace function tests.befriend(a uuid, b uuid) returns void
language sql as $$
  insert into public.friendships (user_low, user_high, requested_by, status, accepted_at)
  values (least(a, b), greatest(a, b), a, 'accepted', now());
$$;

-- A finished workout for a user, as the superuser (fires the feed trigger).
create or replace function tests.workout(uid uuid, wid uuid, status text default 'completed',
                                         volume numeric default 1200) returns void
language sql as $$
  insert into public.workout_sessions (id, user_id, title, category, started_at, ended_at, local_date,
    duration_seconds, completion_status, total_volume_kg, notes, perceived_exertion)
  values (wid, uid, 'Strength A', 'strength', '2026-11-18 17:00+00', '2026-11-18 17:45+00', '2026-11-18',
          2700, status, volume, 'secret note', 7);
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select has_function('tests', 'authenticate_as', array['uuid']);
select * from finish();
commit;
