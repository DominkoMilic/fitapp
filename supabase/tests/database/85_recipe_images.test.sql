-- Audit fix (privacy): recipe photos live in PACE's Storage; users can't write them or the index.
begin;
select plan(5);
select tests.create_user('ffffffff-0000-0000-0000-0000000000f1', 'img@example.com');

select is((select public from storage.buckets where id = 'recipe-images'), true, 'photo bucket is public-read');
select is((select file_size_limit from storage.buckets where id = 'recipe-images'), 1000000::bigint, 'photos are capped at 1 MB');

select tests.authenticate_as('ffffffff-0000-0000-0000-0000000000f1');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('recipe-images', 'themealdb/1.jpg', 'ffffffff-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'users cannot upload photos');
select throws_ok($$ select * from public.recipe_images $$, '42501', null, 'users cannot read the photo index');
select throws_ok($$ insert into public.recipe_images (external_id, path) values ('1', 'themealdb/1.jpg') $$,
  '42501', null, 'users cannot write the photo index');
select tests.clear_authentication();

select * from finish();
rollback;
