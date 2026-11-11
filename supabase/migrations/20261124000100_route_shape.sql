-- Route shape on shared walks, runs and rides (spec 33, decision 2026-11-24).
-- Only the line is shared: points scaled into a 0–1000 box by the app (no coordinates), and only
-- when the user turns on "Share route shape" (off by default).

alter table public.activities add column route_shape jsonb
  check (route_shape is null
         or (jsonb_typeof(route_shape) = 'array' and jsonb_array_length(route_shape) <= 4
             and pg_column_size(route_shape) <= 8192));

alter table public.social_settings
  add column share_route_shape boolean not null default false;

-- Deleting a route removes its shape too (and so from the post).
create function public.activities_route_shape_cleanup() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.route_deleted_at is not null then new.route_shape := null; end if;
  return new;
end;
$$;
create trigger activities_route_shape_cleanup before insert or update on public.activities
  for each row execute function public.activities_route_shape_cleanup();

create function public.activity_snapshot(a jsonb, with_shape boolean) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'type', a ->> 'activity_type',
    'distance_km', case when (a ->> 'distance_meters')::int > 0
                        then round((a ->> 'distance_meters')::numeric / 1000.0, 2) end,
    'moving_min', round(coalesce((a ->> 'moving_seconds')::numeric, 0) / 60.0)::int,
    'pace_s_per_km', (a ->> 'average_pace_seconds_per_km')::int,
    'manual', a ->> 'source' = 'manual',
    'shape', case when with_shape and a ->> 'route_deleted_at' is null
                  then a -> 'route_shape' end));
$$;

create or replace function public.feed_from_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  st public.social_settings;
begin
  if tg_op = 'DELETE' then
    delete from public.feed_items where kind = 'activity' and source_id = old.id;
    return old;
  end if;
  select * into st from public.social_settings where user_id = new.user_id;
  update public.feed_items
     set snapshot = public.activity_snapshot(to_jsonb(new), coalesce(st.share_route_shape, false)),
         local_date = new.local_date
   where kind = 'activity' and source_id = new.id;
  if found then return new; end if;
  if st.user_id is null or st.activities_audience = 'private' or not public.social_active(new.user_id) then
    return new;
  end if;
  insert into public.feed_items (owner, kind, source_id, snapshot, audience, local_date)
  values (new.user_id, 'activity', new.id,
          public.activity_snapshot(to_jsonb(new), st.share_route_shape), st.activities_audience,
          new.local_date)
  on conflict (kind, source_id) do nothing;
  return new;
end;
$$;

drop function public.activity_snapshot(jsonb);
revoke all on function public.activity_snapshot(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.activities_route_shape_cleanup() from public, anon, authenticated;
