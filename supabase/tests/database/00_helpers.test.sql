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

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select has_function('tests', 'authenticate_as', array['uuid']);
select * from finish();
commit;
