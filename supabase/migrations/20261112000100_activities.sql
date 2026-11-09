-- Phase 5: GPS and manual activities (walk, run, cycle) and private route storage.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type text not null check (activity_type in ('walk', 'run', 'cycle', 'other')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- Calendar date in the user's timezone at the start (an activity across midnight belongs to its start day).
  local_date date not null,
  elapsed_seconds integer not null check (elapsed_seconds between 0 and 86400),
  moving_seconds integer not null check (moving_seconds >= 0),
  distance_meters integer check (distance_meters between 0 and 1000000),
  average_speed_mps numeric(6, 3) check (average_speed_mps >= 0),
  max_speed_mps numeric(6, 3) check (max_speed_mps >= 0),
  average_pace_seconds_per_km integer check (average_pace_seconds_per_km > 0),
  calories_estimated integer check (calories_estimated >= 0),
  gps_quality text not null default 'none' check (gps_quality in ('good', 'fair', 'poor', 'none')),
  points_total integer not null default 0 check (points_total >= 0),
  points_accepted integer not null default 0 check (points_accepted >= 0),
  route_storage_path text,
  route_deleted_at timestamptz,
  source text not null check (source in ('gps', 'manual')),
  notes text check (char_length(notes) <= 1000),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_time_order check (ended_at >= started_at),
  constraint activities_moving_le_elapsed check (moving_seconds <= elapsed_seconds),
  -- A route file always lives in the owner's folder.
  constraint activities_route_path check (route_storage_path is null or route_storage_path = user_id::text || '/' || id::text || '.json')
);

create index activities_user_time_idx on public.activities (user_id, started_at desc);

create trigger activities_set_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

alter table public.activities enable row level security;
revoke all on table public.activities from anon, authenticated;
grant select, insert, update, delete on table public.activities to authenticated;

create policy "activities: select own" on public.activities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "activities: insert own" on public.activities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "activities: update own" on public.activities
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "activities: delete own" on public.activities
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------- route storage
-- Private bucket; objects are routes/<user id>/<activity id>.json (spec 11.7, 21.3).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('routes', 'routes', false, 2097152, array['application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "routes: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'routes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "routes: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'routes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "routes: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'routes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'routes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "routes: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'routes' and (storage.foldername(name))[1] = (select auth.uid())::text);
