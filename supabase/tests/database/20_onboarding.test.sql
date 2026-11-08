-- Profile creation trigger, complete_onboarding() and safety constraints.
begin;
select plan(20);

select tests.create_user('cccccccc-0000-0000-0000-000000000003', 'c@example.com');
select is((select count(*) from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003')::int, 1,
  'a profile row is created automatically on sign-up');
select is((select onboarding_completed_at from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003'), null,
  'new profile is not onboarded');

create temporary table payloads (name text primary key, body jsonb);
grant select on payloads to authenticated;
insert into payloads values ('valid', $json$
{
  "profile": {"display_name": "Dev User", "date_of_birth": "2003-05-01", "calc_sex": "male", "height_cm": 187,
              "unit_system": "metric", "timezone": "Europe/Zagreb", "activity_level": "moderate"},
  "goal": {"goal_type": "lose_weight", "focus_tags": ["futsal", "strength"], "starting_weight_kg": 108,
           "target_weight_kg": 90, "secondary_target_weight_kg": 87, "weekly_rate_pct": 0.5},
  "preferences": {"diet_type": "omnivore", "meals_per_day": 3, "household_servings": 1,
                  "training_days_per_week": 3, "preferred_training_days": [1, 4], "max_session_minutes": 45,
                  "training_environment": "home"},
  "equipment": [{"equipment_type": "dumbbells", "max_weight_kg": 5},
                {"equipment_type": "kettlebell", "max_weight_kg": 5},
                {"equipment_type": "exercise_mat"}],
  "health_conditions": [{"id": "dddddddd-0000-0000-0000-000000000001", "kind": "injury", "body_area": "ankle_foot",
                         "side": "right", "status": "recovering", "pain_level": 2,
                         "restriction_tags": ["impact", "jumping"]}],
  "consents": [{"consent_type": "terms", "document_version": "2026-11-08", "granted": true},
               {"consent_type": "privacy", "document_version": "2026-11-08", "granted": true},
               {"consent_type": "health_data", "document_version": "2026-11-08", "granted": true}],
  "targets": {"effective_from": "2026-11-09", "kcal": 2720, "protein_g": 162, "carbs_g": 347, "fat_g": 76,
              "fibre_g": 38, "water_ml": 3800, "bmr": 2138.75, "tdee": 3315.06, "floor_kcal": 2140,
              "limited_by_floor": false, "calculation_version": "2.0.0", "calculation_inputs": {}},
  "plan": {"name": "Fat loss + futsal", "start_date": "2026-11-09", "generator_version": "1.0.0",
           "weekly_pattern": []},
  "recurring_events": [{"title": "League match", "category": "futsal_match", "weekday": 6, "local_time": "18:00",
                        "duration_minutes": 60, "intensity": "hard"},
                       {"title": "Practice match", "category": "futsal_practice", "weekday": 2, "local_time": "20:00",
                        "duration_minutes": 60, "intensity": "hard"}]
}$json$);

select tests.authenticate_as('cccccccc-0000-0000-0000-000000000003');

-- Safety rules -------------------------------------------------------------
select throws_like(
  $$ select public.complete_onboarding(jsonb_set((select body from payloads where name='valid'), '{profile,date_of_birth}', to_jsonb((current_date - interval '17 years')::date::text))) $$,
  '%18 and over%', 'users under 18 are rejected');
select throws_like(
  $$ select public.complete_onboarding(jsonb_set((select body from payloads where name='valid'), '{goal,target_weight_kg}', '60')) $$,
  '%BMI of 18.5%', 'target weight below BMI 18.5 is rejected');
select throws_like(
  $$ select public.complete_onboarding(jsonb_set((select body from payloads where name='valid'), '{goal,weekly_rate_pct}', '1.2')) $$,
  '%above 1%', 'weekly rate above 1% is rejected');
select throws_like(
  $$ select public.complete_onboarding(jsonb_set((select body from payloads where name='valid'), '{consents}', '[{"consent_type":"privacy","document_version":"x","granted":true}]')) $$,
  '%Terms and privacy%', 'terms must be accepted');
select throws_like(
  $$ select public.complete_onboarding(jsonb_set((select body from payloads where name='valid'), '{consents}', '[{"consent_type":"terms","document_version":"x","granted":true},{"consent_type":"privacy","document_version":"x","granted":true}]')) $$,
  '%explicit consent%', 'health data without consent is rejected');
select throws_ok(
  $$ select public.complete_onboarding(jsonb_set((select body from payloads where name='valid'), '{targets,kcal}', '2000')) $$,
  '23514', null, 'targets below the safety floor violate a constraint');
select is((select onboarding_completed_at from public.profiles), null, 'failed attempts leave no partial data');
select is((select count(*) from public.user_goals)::int, 0, 'failed attempts create no goal');

-- Happy path ---------------------------------------------------------------
select lives_ok($$ select public.complete_onboarding((select body from payloads where name='valid')) $$,
  'valid onboarding succeeds');
select isnt((select onboarding_completed_at from public.profiles), null, 'profile marked as onboarded');
select is((select count(*) from public.user_goals where status = 'active')::int, 1, 'one active goal');
select is((select count(*) from public.user_equipment)::int, 3, 'equipment stored');
select is((select count(*) from public.health_conditions)::int, 1, 'injury stored');
select is((select kcal from public.nutrition_targets), 2720, 'targets stored');
select is((select count(*) from public.recurring_events)::int, 2, 'recurring commitments stored and linked');
select is((select count(*) from public.consents)::int, 3, 'consents recorded');
select throws_like($$ select public.complete_onboarding((select body from payloads where name='valid')) $$,
  '%already completed%', 'onboarding cannot run twice');

select tests.clear_authentication();
select is((select count(*) from public.recurring_events r join public.training_plans p on p.id = r.training_plan_id
           where p.user_id = 'cccccccc-0000-0000-0000-000000000003')::int, 2, 'events reference the new plan');

select * from finish();
rollback;
