-- Phase 4: foods, food log, water, day status, saved meals, recipes, meal plan, shopping lists.
begin;
select plan(30);

select tests.create_user('aaaaaaaa-0000-0000-0000-0000000000d1', 'na@example.com');
select tests.create_user('bbbbbbbb-0000-0000-0000-0000000000d2', 'nb@example.com');

-- Reference catalogue
select cmp_ok((select count(*) from public.foods where source = 'usda')::int, '>', 5000, 'USDA reference foods seeded');
select results_eq(
  $$ select kcal, protein_g, carbs_g, fat_g from public.foods where source = 'usda' and external_id = '171477' $$,
  $$ values (165.0::numeric(6,1), 31.02::numeric(6,2), 0.00::numeric(6,2), 3.57::numeric(6,2)) $$,
  'chicken breast, roasted: spec vector N1 per-100 g values');
select ok((select count(*) from public.foods where source = 'usda' and owner_id is not null) = 0, 'reference foods have no owner');
select ok(exists(select 1 from public.foods where search @@ to_tsquery('simple', 'egg & whole')), 'full-text search finds eggs');

-- A: custom food, log items, water, day status, saved meal, recipe, plan, shopping list
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-0000000000d1');
select lives_ok($$ insert into public.foods (id, owner_id, name, kcal, protein_g, carbs_g, fat_g, source, nutritional_confidence)
  values ('f0000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Skyr natural', 63, 11, 4, 0.2, 'user', 'user') $$,
  'A creates a custom food');
select throws_ok($$ insert into public.foods (owner_id, name, kcal, source, nutritional_confidence)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'Fake', 100, 'usda', 'reference') $$, '42501', null,
  'users cannot create reference foods');
update public.foods set kcal = 1 where source = 'usda' and external_id = '171477';
select throws_ok($$ delete from public.foods where id = 'f0000000-0000-0000-0000-0000000000f1' $$, '42501', null,
  'foods are archived, never deleted');
select lives_ok($$ insert into public.meal_log_items (id, user_id, local_date, meal_type, food_id, name_snapshot, quantity, unit, grams, kcal, protein_g, carbs_g, fat_g)
  values ('10000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '2026-11-11', 'breakfast',
          'f0000000-0000-0000-0000-0000000000f1', 'Skyr natural', 200, 'g', 200, 126, 22, 8, 0.4) $$, 'A logs a food');
select lives_ok($$ insert into public.meal_log_items (user_id, local_date, meal_type, name_snapshot, kcal)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', '2026-11-11', 'snack', 'Quick add', 250) $$, 'quick add with kcal only');
select throws_ok($$ insert into public.meal_log_items (user_id, local_date, meal_type, name_snapshot, grams)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', '2026-11-11', 'lunch', 'Too much', 6000) $$, '23514', null,
  'more than 5000 g in one item is rejected');
update public.foods set kcal = 300 where id = 'f0000000-0000-0000-0000-0000000000f1';
select is((select kcal from public.meal_log_items where id = '10000000-0000-0000-0000-0000000000a1'), 126.0::numeric(7,1),
  'editing a food never changes logged history (snapshot)');
select lives_ok($$ insert into public.water_logs (user_id, amount_ml, recorded_at, local_date)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', 250, now(), '2026-11-11') $$, 'A logs water');
select lives_ok($$ insert into public.day_log_status (user_id, local_date, nutrition_complete)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', '2026-11-11', true)
  on conflict (user_id, local_date) do update set nutrition_complete = excluded.nutrition_complete $$, 'A marks the day complete');
select lives_ok($$ insert into public.saved_meals (user_id, name, items)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'Skyr bowl', '[{"name":"Skyr natural","grams":200,"kcal":126}]') $$, 'A saves a meal');
select lives_ok($$ insert into public.recipes (id, owner_id, source, name, ingredients, servings_stated, nutritional_confidence, kcal_per_serving)
  values ('20000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'user', 'Chicken rice', '[]', 4, 'calculated', 500) $$,
  'A creates a recipe with calculated nutrition');
select throws_ok($$ insert into public.recipes (owner_id, source, external_id, name)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'themealdb', '52772', 'Teriyaki') $$, '42501', null,
  'users cannot write TheMealDB cache rows');
select lives_ok($$ insert into public.meal_plan_entries (user_id, local_date, meal_type, recipe_id, title_snapshot, servings)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', '2026-11-12', 'dinner', '20000000-0000-0000-0000-0000000000a1', 'Chicken rice', 2) $$,
  'A plans a meal');
select lives_ok($$ insert into public.shopping_lists (id, user_id, name) values ('30000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'This week') $$,
  'A creates a shopping list');
select lives_ok($$ insert into public.shopping_list_items (user_id, shopping_list_id, ingredient_name, quantity_min, quantity_max, unit)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000a1', 'rice', 500, 500, 'g') $$, 'A adds an item');
select tests.clear_authentication();
select is((select kcal from public.foods where source = 'usda' and external_id = '171477'), 165.0::numeric(6,1),
  'users cannot modify reference foods');

-- The database itself refuses invented nutrition on TheMealDB rows (even for the service role).
select throws_ok($$ insert into public.recipes (source, external_id, name, nutritional_confidence, kcal_per_serving)
  values ('themealdb', '1', 'x', 'calculated', 400) $$, '23514', null, 'TheMealDB recipes cannot carry nutrition');

-- B: isolation
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-0000000000d2');
select is((select count(*) from public.foods where owner_id is not null)::int, 0, 'B cannot see A custom food');
select is((select count(*) from public.meal_log_items)::int, 0, 'B cannot see A food log');
select is((select count(*) from public.water_logs)::int + (select count(*) from public.day_log_status)::int, 0, 'B cannot see A water or day status');
select is((select count(*) from public.saved_meals)::int + (select count(*) from public.meal_plan_entries)::int, 0, 'B cannot see A saved meals or plan');
select is((select count(*) from public.recipes where owner_id is not null)::int, 0, 'B cannot see A recipes');
select is((select count(*) from public.shopping_lists)::int + (select count(*) from public.shopping_list_items)::int, 0, 'B cannot see A shopping');
select throws_ok($$ insert into public.shopping_list_items (user_id, shopping_list_id, ingredient_name)
  values ('bbbbbbbb-0000-0000-0000-0000000000d2', '30000000-0000-0000-0000-0000000000a1', 'x') $$, '42501', null,
  'B cannot add items to A list');
select tests.clear_authentication();

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-0000000000d1';
select is((select count(*) from public.meal_log_items where user_id = 'aaaaaaaa-0000-0000-0000-0000000000d1')::int
  + (select count(*) from public.foods where owner_id = 'aaaaaaaa-0000-0000-0000-0000000000d1')::int
  + (select count(*) from public.recipes where owner_id = 'aaaaaaaa-0000-0000-0000-0000000000d1')::int
  + (select count(*) from public.shopping_lists where user_id = 'aaaaaaaa-0000-0000-0000-0000000000d1')::int, 0,
  'account deletion removes all nutrition data');
select cmp_ok((select count(*) from public.foods where source = 'usda')::int, '>', 5000, 'reference foods remain');

select * from finish();
rollback;
