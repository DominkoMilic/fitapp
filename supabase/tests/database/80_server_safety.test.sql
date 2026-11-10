-- Audit fix: safety rules hold even when a signed-in user writes to the API directly.
begin;
select plan(13);

select tests.create_user('eeeeeeee-0000-0000-0000-0000000000e1', 'safe-a@example.com');
-- An onboarded male user (set up as the server would).
update public.profiles set display_name = 'Safe A', date_of_birth = '1990-01-01', calc_sex = 'male', height_cm = 180,
  onboarding_completed_at = now(), onboarding_step = 'done', activity_level = 'moderate'
  where id = 'eeeeeeee-0000-0000-0000-0000000000e1';
select tests.authenticate_as('eeeeeeee-0000-0000-0000-0000000000e1');

-- Profile (spec 7)
select throws_ok($$ update public.profiles set calc_sex = null where id = 'eeeeeeee-0000-0000-0000-0000000000e1' $$,
  '22023', null, 'calc_sex cannot be cleared');

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

select tests.clear_authentication();

-- complete_onboarding still sets the completion time (flag is transaction-local)
select ok((select onboarding_completed_at is not null from public.profiles where id = 'eeeeeeee-0000-0000-0000-0000000000e1'),
  'the server-set onboarding time is untouched');

select * from finish();
rollback;
