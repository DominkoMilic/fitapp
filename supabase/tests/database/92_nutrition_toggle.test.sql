-- Nutrition can be switched off; onboarding saves the choice; older payloads keep it on.
begin;
select plan(5);
select tests.create_user('ffffffff-0000-0000-0000-0000000000c1', 'nofood@example.com');
select tests.create_user('ffffffff-0000-0000-0000-0000000000c2', 'oldapp@example.com');

create temporary table payloads (body jsonb);
grant select on payloads to authenticated;
insert into payloads values ($json$
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

select tests.authenticate_as('ffffffff-0000-0000-0000-0000000000c1');
select lives_ok($$ select public.complete_onboarding(jsonb_set((select body from payloads), '{preferences,nutrition_enabled}', 'false')) $$,
  'onboarding with nutrition switched off');
select is((select nutrition_enabled from public.user_preferences where user_id = 'ffffffff-0000-0000-0000-0000000000c1'), false,
  'the choice is saved');
select lives_ok($$ update public.user_preferences set nutrition_enabled = true where user_id = 'ffffffff-0000-0000-0000-0000000000c1' $$,
  'the user can switch it back on');

select tests.authenticate_as('ffffffff-0000-0000-0000-0000000000c2');
select lives_ok($$ select public.complete_onboarding((select body from payloads)) $$,
  'an older app without the setting still onboards');
select tests.clear_authentication();
select is((select nutrition_enabled from public.user_preferences where user_id = 'ffffffff-0000-0000-0000-0000000000c2'), true,
  'nutrition stays on by default');

select * from finish();
rollback;
