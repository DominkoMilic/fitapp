-- Own recipes: free-text ingredients, typed-in nutrition per serving, editing, isolation.
begin;
select plan(7);
select tests.create_user('ffffffff-0000-0000-0000-0000000000a1', 'cook@example.com');
select tests.create_user('ffffffff-0000-0000-0000-0000000000a2', 'other@example.com');

select tests.authenticate_as('ffffffff-0000-0000-0000-0000000000a1');
select lives_ok($$
  insert into public.recipes (id, owner_id, source, name, servings_stated, ingredients, nutritional_confidence,
    kcal_per_serving, protein_per_serving)
  values ('eeeeeeee-0000-0000-0000-0000000000a1', 'ffffffff-0000-0000-0000-0000000000a1', 'user', 'Grandma''s stew', 4,
    '[{"name": "beef", "raw_measure": "500 g", "parse_status": "parsed", "quantity_min": 500, "unit": "g", "food_id": null, "grams": null},
      {"name": "salt", "raw_measure": "to taste", "parse_status": "to_taste", "food_id": null, "grams": null}]',
    'user_estimate', 520, 38)
$$, 'a user can save their own recipe with free-text ingredients and an estimate');
select lives_ok($$
  update public.recipes set name = 'Grandma''s beef stew', kcal_per_serving = 540
  where id = 'eeeeeeee-0000-0000-0000-0000000000a1'
$$, 'a user can edit their own recipe');
select is((select kcal_per_serving from public.recipes where id = 'eeeeeeee-0000-0000-0000-0000000000a1'), 540.0,
  'the edit is stored');
select throws_ok($$
  insert into public.recipes (owner_id, source, name, nutritional_confidence) values
    ('ffffffff-0000-0000-0000-0000000000a1', 'user', 'x', 'guess')
$$, '23514', null, 'unknown confidence values are rejected');

select tests.authenticate_as('ffffffff-0000-0000-0000-0000000000a2');
select is((select count(*) from public.recipes where id = 'eeeeeeee-0000-0000-0000-0000000000a1')::int, 0,
  'another user cannot see it');
update public.recipes set name = 'hacked' where id = 'eeeeeeee-0000-0000-0000-0000000000a1';
select tests.clear_authentication();
select is((select name from public.recipes where id = 'eeeeeeee-0000-0000-0000-0000000000a1'), 'Grandma''s beef stew',
  'another user cannot edit it');

select throws_ok($$
  insert into public.recipes (source, external_id, name, nutritional_confidence, kcal_per_serving)
  values ('themealdb', '999999', 'Cached', 'user_estimate', 400)
$$, '23514', null, 'TheMealDB recipes still cannot carry nutrition');

select * from finish();
rollback;
