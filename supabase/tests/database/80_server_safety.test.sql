-- Audit fix: safety rules hold even when a signed-in user writes to the API directly.
begin;
select plan(22);

select tests.create_user('eeeeeeee-0000-0000-0000-0000000000e1', 'safe-a@example.com');
-- An onboarded male user (set up as the server would).
update public.profiles set display_name = 'Safe A', date_of_birth = '1990-01-01', calc_sex = 'male', height_cm = 180,
  onboarding_completed_at = now(), onboarding_step = 'done', activity_level = 'moderate'
  where id = 'eeeeeeee-0000-0000-0000-0000000000e1';
insert into public.nutrition_targets (user_id, effective_from, kcal, protein_g, carbs_g, fat_g, floor_kcal, calculation_version)
values ('eeeeeeee-0000-0000-0000-0000000000e1', current_date - 30, 2500, 160, 300, 70, 1800, 'v1');

select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000e1');

-- Calorie floor (spec 8.5)
select throws_ok($$ insert into public.nutrition_targets (user_id, effective_from, kcal, protein_g, carbs_g, fat_g, floor_kcal, calculation_version)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', current_date, 1000, 100, 100, 30, null, 'x') $$,
  '23514', null, 'a target below the sex floor is rejected even with no floor sent');
select throws_ok($$ update public.nutrition_targets set floor_kcal = 800, kcal = 1000
  where user_id = 'eeeeeeee-0000-0000-0000-0000000000e1' $$,
  '23514', null, 'lowering the floor to drop the target is rejected');
select lives_ok($$ insert into public.nutrition_targets (user_id, effective_from, kcal, protein_g, carbs_g, fat_g, floor_kcal, calculation_version)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', current_date + 1, 1600, 150, 150, 50, null, 'x') $$,
  'a target at or above the floor is accepted');
select is((select floor_kcal from public.nutrition_targets where user_id = 'eeeeeeee-0000-0000-0000-0000000000e1' and effective_from = current_date + 1),
  1500, 'a missing floor is filled with the sex floor');
select throws_ok($$ update public.profiles set calc_sex = null where id = 'eeeeeeee-0000-0000-0000-0000000000e1' $$,
  '22023', null, 'calc_sex cannot be cleared to lower the floor');

-- Age and onboarding (spec 7)
select throws_ok($$ update public.profiles set date_of_birth = current_date - interval '15 years' where id = 'eeeeeeee-0000-0000-0000-0000000000e1' $$,
  '22023', null, 'under-18 date of birth is rejected');
select lives_ok($$ update public.profiles set date_of_birth = '1991-02-03' where id = 'eeeeeeee-0000-0000-0000-0000000000e1' $$,
  'an adult date of birth can be corrected');
select throws_ok($$ update public.profiles set onboarding_completed_at = null where id = 'eeeeeeee-0000-0000-0000-0000000000e1' $$,
  '42501', null, 'onboarding completion cannot be changed directly');
select lives_ok($$ update public.profiles set display_name = 'Still fine' where id = 'eeeeeeee-0000-0000-0000-0000000000e1' $$,
  'ordinary profile edits still work');

-- Goal BMI (spec 3.1): 180 cm → BMI 18.5 ≈ 59.9 kg
select throws_ok($$ insert into public.user_goals (user_id, goal_type, starting_weight_kg, target_weight_kg, weekly_rate_pct)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', 'lose_weight', 80, 55, 0.5) $$,
  '22023', null, 'a weight-loss target below BMI 18.5 is rejected');
select throws_ok($$ insert into public.user_goals (user_id, goal_type, starting_weight_kg, target_weight_kg, secondary_target_weight_kg, weekly_rate_pct)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', 'lose_weight', 80, 70, 55, 0.5) $$,
  '22023', null, 'a secondary target below BMI 18.5 is rejected');
select lives_ok($$ insert into public.user_goals (user_id, goal_type, starting_weight_kg, target_weight_kg, weekly_rate_pct)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', 'lose_weight', 80, 72, 0.5) $$,
  'a healthy target is accepted');

-- Health data needs consent (spec 19)
select throws_ok($$ insert into public.health_conditions (user_id, kind, body_area) values ('eeeeeeee-0000-0000-0000-0000000000e1', 'injury', 'knee') $$,
  '42501', null, 'health data without consent is rejected');
select lives_ok($$ insert into public.consents (user_id, consent_type, document_version, granted)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', 'health_data', 'v', true) $$, 'consent is recorded');
select lives_ok($$ insert into public.health_conditions (user_id, kind, body_area) values ('eeeeeeee-0000-0000-0000-0000000000e1', 'injury', 'knee') $$,
  'health data with consent is accepted');
select throws_ok($$ insert into public.consents (user_id, consent_type, document_version, granted, recorded_at)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', 'terms', 'v', true, '2000-01-01') $$,
  '42501', null, 'consent time cannot be backdated');

-- Recalibration proposals (spec 8.9)
select throws_ok($$ insert into public.target_adjustments (user_id, window_start, window_end, current_kcal, proposed_kcal, reason_code, status)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', current_date - 20, current_date, 2500, 2000, 'decrease_slow', 'proposed') $$,
  '22023', null, 'a forged large decrease is rejected');
select throws_ok($$ insert into public.target_adjustments (user_id, window_start, window_end, current_kcal, proposed_kcal, reason_code, status)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', current_date - 20, current_date, 3333, 3483, 'increase_fast_loss', 'proposed') $$,
  '22023', null, 'a proposal for a target the user never had is rejected');
select lives_ok($$ insert into public.target_adjustments (id, user_id, window_start, window_end, current_kcal, proposed_kcal, reason_code, status)
  values ('81000000-0000-0000-0000-0000000000e1', 'eeeeeeee-0000-0000-0000-0000000000e1', current_date - 20, current_date, 2500, 2400, 'decrease_slow', 'proposed') $$,
  'a proposal following the rules is accepted');
select lives_ok($$ select public.accept_target_adjustment('81000000-0000-0000-0000-0000000000e1',
    jsonb_build_object('effective_from', current_date + 2, 'kcal', 2400, 'protein_g', 160, 'carbs_g', 275, 'fat_g', 70)) $$,
  'the proposal can be accepted');
select throws_ok($$ update public.target_adjustments set decided_at = now() - interval '30 days'
  where id = '81000000-0000-0000-0000-0000000000e1' $$,
  '42501', null, 'the decision time cannot be moved back to dodge the 14-day limit');
select tests.clear_authentication();

-- complete_onboarding still sets the completion time (flag is transaction-local)
select ok((select onboarding_completed_at is not null from public.profiles where id = 'eeeeeeee-0000-0000-0000-0000000000e1'),
  'the server-set onboarding time is untouched');

select * from finish();
rollback;
