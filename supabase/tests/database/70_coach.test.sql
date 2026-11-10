-- Weekly report cache (spec 16): owner-only, removed with the account.
begin;
select plan(5);
select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000c6', 'coach-a@example.com');
select tests.create_user('bbbbbbbb-0000-0000-0000-0000000000c6', 'coach-b@example.com');

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000c6');
select lives_ok($$ insert into public.weekly_reports (user_id, week_start, payload)
  values ('aaaaaaaa-0000-0000-0000-0000000000c6', '2026-11-02', '{"sessions": {"completed": 3, "planned": 3}}') $$, 'A caches a weekly report');
select is((select count(*) from public.weekly_reports)::int, 1, 'A sees their report');
select tests.clear_authentication();

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000c6');
select is((select count(*) from public.weekly_reports)::int, 0, 'B cannot see A reports');
select throws_ok($$ insert into public.weekly_reports (user_id, week_start, payload)
  values ('aaaaaaaa-0000-0000-0000-0000000000c6', '2026-11-09', '{}') $$, '42501', null, 'B cannot write a report for A');
select tests.clear_authentication();

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-0000000000c6';
select is((select count(*) from public.weekly_reports where user_id = 'aaaaaaaa-0000-0000-0000-0000000000c6')::int, 0,
  'account deletion removes reports');

select * from finish();
rollback;
