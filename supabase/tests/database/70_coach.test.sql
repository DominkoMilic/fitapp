-- Phase 6: recalibration audit, atomic accept, weekly report cache.
begin;
select plan(19);
select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000c6', 'coach-a@example.com');
select tests.create_user('bbbbbbbb-0000-0000-0000-0000000000c6', 'coach-b@example.com');

-- A has a current target (written as service role, as onboarding would).
insert into public.nutrition_targets (id, user_id, effective_from, kcal, protein_g, carbs_g, fat_g, floor_kcal, calculation_version)
values ('70000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c6', current_date - 30, 2720, 162, 347, 76, 1800, 'v1');

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000c6');
select lives_ok($$ insert into public.target_adjustments (id, user_id, window_start, window_end, current_kcal, proposed_kcal,
    observed_tdee, actual_rate_kg_week, adherence, reason_code, slow, status, inputs)
  values ('71000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c6', current_date - 21, current_date, 2720, 2620,
    2920, 0.2, 0.9, 'decrease_slow', true, 'proposed', '{"mean_intake": 2700}') $$, 'A records a proposal');
select throws_ok($$ insert into public.target_adjustments (user_id, window_start, window_end, current_kcal, reason_code, status)
  values ('aaaaaaaa-0000-0000-0000-0000000000c6', current_date - 21, current_date - 1, 2720, 'on_track', 'accepted') $$,
  '42501', null, 'cannot insert an already accepted adjustment');
select throws_ok($$ insert into public.target_adjustments (user_id, window_start, window_end, current_kcal, reason_code, status)
  values ('aaaaaaaa-0000-0000-0000-0000000000c6', current_date - 21, current_date - 2, 2720, 'decrease_slow', 'proposed') $$,
  '23514', null, 'a proposal needs proposed kcal');
select throws_ok($$ update public.target_adjustments set status = 'accepted' where id = '71000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'accepting directly is refused (must use the RPC)');
select throws_ok($$ update public.target_adjustments set proposed_kcal = 1000 where id = '71000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'proposal inputs are read-only');
select throws_ok($$ delete from public.target_adjustments $$, '42501', null, 'the audit trail cannot be deleted');
select throws_ok($$ select public.accept_target_adjustment('71000000-0000-0000-0000-0000000000a1',
    '{"effective_from": "2099-01-01", "kcal": 2500, "protein_g": 162, "carbs_g": 300, "fat_g": 76, "floor_kcal": 1800}') $$,
  '22023', null, 'accept refuses a target that does not match the proposal');
select throws_ok($$ select public.accept_target_adjustment('71000000-0000-0000-0000-0000000000a1',
    '{"effective_from": "2099-01-01", "kcal": 2620, "protein_g": 162, "carbs_g": 322, "fat_g": 76, "floor_kcal": 2700}') $$,
  '23514', null, 'accept never goes below the safety floor');
select lives_ok($$ select public.accept_target_adjustment('71000000-0000-0000-0000-0000000000a1',
    '{"effective_from": "2099-01-01", "kcal": 2620, "protein_g": 162, "carbs_g": 322, "fat_g": 76, "floor_kcal": 1800}') $$,
  'A accepts the proposal');
select results_eq($$ select status, resulting_target_id is not null from public.target_adjustments where id = '71000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('accepted'::text, true) $$, 'proposal is accepted and linked to the new target');
select is((select kcal from public.nutrition_targets where effective_from = '2099-01-01'), 2620, 'new target version created');
select is((select kcal from public.nutrition_targets where id = '70000000-0000-0000-0000-0000000000a1'), 2720, 'previous target version kept');
select lives_ok($$ insert into public.target_adjustments (id, user_id, window_start, window_end, current_kcal, proposed_kcal, reason_code, status)
  values ('71000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000c6', current_date - 20, current_date + 1, 2620, 2770, 'increase_fast_loss', 'proposed') $$,
  'a second proposal can be recorded');
select throws_ok($$ select public.accept_target_adjustment('71000000-0000-0000-0000-0000000000a2',
    '{"effective_from": "2099-01-02", "kcal": 2770, "protein_g": 162, "carbs_g": 359, "fat_g": 76, "floor_kcal": 1800}') $$,
  '22023', null, 'at most one accepted change per 14 days');
select lives_ok($$ update public.target_adjustments set status = 'rejected', decided_at = now() where id = '71000000-0000-0000-0000-0000000000a2' $$,
  'A can reject a proposal');
select lives_ok($$ insert into public.weekly_reports (user_id, week_start, payload)
  values ('aaaaaaaa-0000-0000-0000-0000000000c6', '2026-11-02', '{"sessions": {"completed": 3, "planned": 3}}') $$, 'A caches a weekly report');
select tests.clear_authentication();

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000c6');
select is((select count(*) from public.target_adjustments)::int + (select count(*) from public.weekly_reports)::int, 0,
  'B cannot see A adjustments or reports');
select throws_ok($$ select public.accept_target_adjustment('71000000-0000-0000-0000-0000000000a1', '{"kcal": 2620}') $$,
  'P0002', null, 'B cannot accept A proposal');
select tests.clear_authentication();

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-0000000000c6';
select is((select count(*) from public.target_adjustments where user_id = 'aaaaaaaa-0000-0000-0000-0000000000c6')::int
  + (select count(*) from public.weekly_reports where user_id = 'aaaaaaaa-0000-0000-0000-0000000000c6')::int, 0,
  'account deletion removes adjustments and reports');

select * from finish();
rollback;
