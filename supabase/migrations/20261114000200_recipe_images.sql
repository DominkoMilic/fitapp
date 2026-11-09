-- Audit fix (privacy): recipe photos are copied once to PACE's Storage and served from there, so
-- phones never contact TheMealDB (the privacy policy says only search words reach it).

-- Public read (photos aren't personal), written only by the recipes-proxy function (service role).
-- No storage.objects policies for users: they can't list, upload, change or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 1000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Which TheMealDB recipes already have a copied photo (server-side bookkeeping only).
create table public.recipe_images (
  external_id text primary key check (external_id ~ '^\d{1,10}$'),
  path text not null check (path = 'themealdb/' || external_id || '.jpg'),
  created_at timestamptz not null default now()
);
alter table public.recipe_images enable row level security;
revoke all on table public.recipe_images from anon, authenticated;

-- Cached recipes still pointing at TheMealDB lose the link; the next lookup stores PACE's copy.
-- Stored as a reference ('storage:recipe-images/<path>') that the app resolves to its own URL.
update public.recipes set image_url = null
where source = 'themealdb' and image_url is not null and image_url not like 'storage:recipe-images/%';
