begin;
select plan(5);
select tests.create_user('dddddddd-0000-0000-0000-0000000000f1', 'rl@example.com');
select tests.authenticate_as('dddddddd-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.hit_rate_limit('dddddddd-0000-0000-0000-0000000000f1', 'x', 1000, 60) $$, '42501', null,
  'clients cannot call the rate limiter (they could reset or spoof it)');
select throws_ok($$ select * from public.edge_rate_limits $$, '42501', null, 'clients cannot read rate-limit rows');
select tests.clear_authentication();
set local role service_role;
select ok(public.hit_rate_limit('dddddddd-0000-0000-0000-0000000000f1', 't', 2, 60), 'first call allowed');
select ok(public.hit_rate_limit('dddddddd-0000-0000-0000-0000000000f1', 't', 2, 60), 'second call allowed');
select ok(not public.hit_rate_limit('dddddddd-0000-0000-0000-0000000000f1', 't', 2, 60), 'third call in the window is refused');
reset role;
select * from finish();
rollback;
