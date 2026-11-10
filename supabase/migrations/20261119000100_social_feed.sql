-- Phase 8B-1 — friends feed, cheers and comments (spec 33). Feed items are created by triggers
-- from workouts, activities and milestones, only when the owner shares that type, and carry a
-- whitelisted snapshot: other people never read the source tables. Push wiring is included but
-- stays off (app_config.push_enabled = false) until Phase 8B-2.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('workout', 'activity', 'milestone', 'challenge_done', 'club_joined')),
  source_id uuid not null,
  snapshot jsonb not null default '{}',
  audience text not null check (audience in ('friends', 'friends_and_clubs')),
  local_date date not null,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, source_id)
);
create index feed_items_owner_idx on public.feed_items (owner, created_at desc);
create index feed_items_created_idx on public.feed_items (created_at desc, id desc);

create table public.cheers (
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'clap' check (kind in ('clap', 'fire', 'strong', 'star')),
  created_at timestamptz not null default now(),
  primary key (feed_item_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  author uuid not null references auth.users (id) on delete cascade,
  -- Removed comments keep their row (thread order) but lose their text.
  body text check ((deleted_at is null and char_length(btrim(body)) between 1 and 280)
                   or (deleted_at is not null and body is null)),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_item_idx on public.comments (feed_item_id, created_at);

create table public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- Batching state for social-push (8B-2): one row per recipient and topic (e.g. cheer:<item>).
create table public.push_log (
  recipient uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  last_sent_at timestamptz,
  pending_count integer not null default 0,
  pending_actors text[] not null default '{}',
  primary key (recipient, topic)
);

-- Server-only push settings (function URL and shared secret); no client access at all.
create table public.push_config (key text primary key, value text not null);

alter table public.social_settings
  add column notify_cheers boolean not null default true,
  add column notify_comments boolean not null default true,
  add column notify_requests boolean not null default true;

insert into public.app_config (key, value) values ('push_enabled', 'false');

create trigger feed_items_updated_at before update on public.feed_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- The owner can currently share: social switched on, a profile, not banned, kill switch on.
create function public.social_active(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.social_on() and exists (
    select 1 from public.social_profiles p
    join public.user_preferences up on up.user_id = p.user_id
    where p.user_id = u and p.banned_at is null and up.social_enabled);
$$;

create function public.can_view_feed(viewer uuid, item_owner uuid, item_audience text, item_hidden timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select viewer is not null and (
    viewer = item_owner
    or (item_hidden is null
        and item_audience in ('friends', 'friends_and_clubs')
        and public.are_friends(viewer, item_owner)
        and not public.is_blocked(viewer, item_owner)
        and not public.is_banned(item_owner)
        and not public.is_banned(viewer)));
$$;

-- Milestones about weight are never shared (spec 3.4).
create function public.is_weight_milestone(m_key text, m_metadata jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select m_key ~ '^(weight_lost_|weight_reached_)'
      or m_key in ('goal_target', 'goal_secondary', 'weigh_in_30')
      or coalesce(m_metadata ->> 'category', '') = 'weight';
$$;

-- Snapshots: the only data other people see. Keep in sync with FEED_SNAPSHOT_KEYS in
-- src/domain/social/feed.ts (a unit test compares the lists below).
-- WHITELIST workout: title,category,duration_min,sets,volume_kg
-- WHITELIST activity: type,distance_km,moving_min,pace_s_per_km,manual
-- WHITELIST milestone: title
-- Rows are passed as jsonb (to_jsonb(new)): a function taking a table row would be exposed by the
-- API as a computed column of that table.
create function public.workout_snapshot(s jsonb, share_volume boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'title', s ->> 'title',
    'category', s ->> 'category',
    'duration_min', round(coalesce((s ->> 'duration_seconds')::numeric, 0) / 60.0)::int,
    'sets', (select count(*)::int from public.exercise_sets e
             where e.workout_session_id = (s ->> 'id')::uuid and e.completed),
    'volume_kg', case when share_volume and (s ->> 'total_volume_kg')::numeric > 0
                      then (s ->> 'total_volume_kg')::numeric end));
$$;

create function public.activity_snapshot(a jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'type', a ->> 'activity_type',
    'distance_km', case when (a ->> 'distance_meters')::int > 0
                        then round((a ->> 'distance_meters')::numeric / 1000.0, 2) end,
    'moving_min', round(coalesce((a ->> 'moving_seconds')::numeric, 0) / 60.0)::int,
    'pace_s_per_km', (a ->> 'average_pace_seconds_per_km')::int,
    'manual', a ->> 'source' = 'manual'));
$$;

-- Queues a push for Phase 8B-2. A no-op while push is off or pg_net isn't installed.
create function public.social_notify(p_type text, p_recipient uuid, p_actor uuid, p_item uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  fn_url text;
  fn_secret text;
begin
  if p_recipient is null or p_recipient = p_actor then return; end if;
  if not coalesce((select (value #>> '{}')::boolean from public.app_config where key = 'push_enabled'), false) then
    return;
  end if;
  if to_regnamespace('net') is null then return; end if;
  select value into fn_url from public.push_config where key = 'function_url';
  select value into fn_secret from public.push_config where key = 'secret';
  if fn_url is null or fn_secret is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using fn_url,
          jsonb_build_object('type', p_type, 'recipient', p_recipient, 'actor', p_actor, 'itemId', p_item),
          jsonb_build_object('Content-Type', 'application/json', 'x-pace-push-secret', fn_secret);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Feed triggers
-- ---------------------------------------------------------------------------------------------
create function public.feed_from_workout() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  st public.social_settings;
begin
  if tg_op = 'DELETE' then
    delete from public.feed_items where kind = 'workout' and source_id = old.id;
    return old;
  end if;
  if new.completion_status = 'abandoned' then
    delete from public.feed_items where kind = 'workout' and source_id = new.id;
    return new;
  end if;
  select * into st from public.social_settings where user_id = new.user_id;
  -- An existing item follows edits; a new one needs sharing switched on now.
  update public.feed_items
     set snapshot = public.workout_snapshot(to_jsonb(new), coalesce(st.share_volume, false)), local_date = new.local_date
   where kind = 'workout' and source_id = new.id;
  if found then return new; end if;
  if st.user_id is null or st.workouts_audience = 'private' or not public.social_active(new.user_id) then
    return new;
  end if;
  insert into public.feed_items (owner, kind, source_id, snapshot, audience, local_date)
  values (new.user_id, 'workout', new.id, public.workout_snapshot(to_jsonb(new), st.share_volume),
          st.workouts_audience, new.local_date)
  on conflict (kind, source_id) do nothing;
  return new;
end;
$$;
create trigger workout_sessions_feed after insert or update or delete on public.workout_sessions
  for each row execute function public.feed_from_workout();

-- Editing a workout re-inserts its sets after the session row; keep the set count current.
create function public.feed_sets_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := coalesce(new.workout_session_id, old.workout_session_id);
begin
  update public.feed_items f
     set snapshot = jsonb_set(f.snapshot, '{sets}', to_jsonb(
       (select count(*)::int from public.exercise_sets e where e.workout_session_id = sid and e.completed)))
   where f.kind = 'workout' and f.source_id = sid;
  return null;
end;
$$;
create trigger exercise_sets_feed after insert or update or delete on public.exercise_sets
  for each row execute function public.feed_sets_changed();

create function public.feed_from_activity() returns trigger
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
     set snapshot = public.activity_snapshot(to_jsonb(new)), local_date = new.local_date
   where kind = 'activity' and source_id = new.id;
  if found then return new; end if;
  if st.user_id is null or st.activities_audience = 'private' or not public.social_active(new.user_id) then
    return new;
  end if;
  insert into public.feed_items (owner, kind, source_id, snapshot, audience, local_date)
  values (new.user_id, 'activity', new.id, public.activity_snapshot(to_jsonb(new)), st.activities_audience, new.local_date)
  on conflict (kind, source_id) do nothing;
  return new;
end;
$$;
create trigger activities_feed after insert or update or delete on public.activities
  for each row execute function public.feed_from_activity();

create function public.feed_from_milestone() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  st public.social_settings;
begin
  if tg_op = 'DELETE' then
    delete from public.feed_items where kind = 'milestone' and source_id = old.id;
    return old;
  end if;
  if public.is_weight_milestone(new.milestone_key, new.metadata) then return new; end if;
  select * into st from public.social_settings where user_id = new.user_id;
  if st.user_id is null or st.milestones_audience = 'private' or not public.social_active(new.user_id) then
    return new;
  end if;
  insert into public.feed_items (owner, kind, source_id, snapshot, audience, local_date)
  values (new.user_id, 'milestone', new.id, jsonb_build_object('title', new.title), st.milestones_audience,
          coalesce((new.metadata ->> 'achieved_on')::date, (new.unlocked_at at time zone 'UTC')::date))
  on conflict (kind, source_id) do nothing;
  return new;
end;
$$;
create trigger user_milestones_feed after insert or delete on public.user_milestones
  for each row execute function public.feed_from_milestone();

-- Turning social off removes what you shared (your friends and profile stay).
create function public.feed_social_off() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.social_enabled and not new.social_enabled then
    delete from public.feed_items where owner = new.user_id;
  end if;
  return new;
end;
$$;
create trigger user_preferences_feed_off after update of social_enabled on public.user_preferences
  for each row execute function public.feed_social_off();

create or replace function public.delete_social_profile() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  delete from public.feed_items where owner = me;
  delete from public.comments where author = me;
  delete from public.cheers where user_id = me;
  delete from public.friendships where me in (user_low, user_high);
  delete from public.social_settings where user_id = me;
  delete from public.social_profiles where user_id = me;
  update public.user_preferences set social_enabled = false where user_id = me;
end;
$$;

-- Comment text passes the same word filter as names and bios.
create function public.comments_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is null and not public.social_text_ok(new.body) then
    raise exception 'not_allowed';
  end if;
  return new;
end;
$$;
create trigger comments_check before insert or update on public.comments
  for each row execute function public.comments_check();

-- Push hooks (no-ops until 8B-2).
create function public.push_on_cheer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.social_notify('cheer', (select owner from public.feed_items where id = new.feed_item_id),
                               new.user_id, new.feed_item_id);
  return null;
end;
$$;
create trigger cheers_push after insert on public.cheers for each row execute function public.push_on_cheer();

create function public.push_on_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.social_notify('comment', (select owner from public.feed_items where id = new.feed_item_id),
                               new.author, new.feed_item_id);
  return null;
end;
$$;
create trigger comments_push after insert on public.comments for each row execute function public.push_on_comment();

create function public.push_on_friendship() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  other uuid := case when new.requested_by = new.user_low then new.user_high else new.user_low end;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.social_notify('request', other, new.requested_by, null);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.social_notify('accept', new.requested_by, other, null);
  end if;
  return null;
end;
$$;
create trigger friendships_push after insert or update on public.friendships
  for each row execute function public.push_on_friendship();

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------
alter table public.feed_items enable row level security;
alter table public.cheers enable row level security;
alter table public.comments enable row level security;
alter table public.push_tokens enable row level security;
alter table public.push_log enable row level security;
alter table public.push_config enable row level security;
revoke all on table public.feed_items, public.cheers, public.comments, public.push_tokens,
  public.push_log, public.push_config from anon, authenticated;

grant select on table public.feed_items, public.cheers, public.comments to authenticated;
create policy "feed_items: visible" on public.feed_items for select to authenticated
  using (public.can_view_feed((select auth.uid()), owner, audience, hidden_at));
create policy "cheers: on visible items" on public.cheers for select to authenticated
  using (exists (select 1 from public.feed_items f where f.id = feed_item_id
                 and public.can_view_feed((select auth.uid()), f.owner, f.audience, f.hidden_at)));
create policy "comments: on visible items" on public.comments for select to authenticated
  using (exists (select 1 from public.feed_items f where f.id = feed_item_id
                 and public.can_view_feed((select auth.uid()), f.owner, f.audience, f.hidden_at)));

grant select, insert, update, delete on table public.push_tokens to authenticated;
create policy "push_tokens: own" on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------------------------
create function public.feed_row_visible(me uuid, item uuid) returns public.feed_items
language plpgsql stable security definer set search_path = '' as $$
declare
  f public.feed_items;
begin
  select * into f from public.feed_items where id = item;
  if f.id is null or not public.can_view_feed(me, f.owner, f.audience, f.hidden_at) then
    raise exception 'not_found';
  end if;
  return f;
end;
$$;

create function public.get_feed(p_before timestamptz default null, p_max integer default 20,
                                p_owner uuid default null)
returns table (id uuid, owner uuid, handle text, display_name text, avatar_color text, kind text,
               snapshot jsonb, local_date date, created_at timestamptz, cheers jsonb, my_cheer text,
               comment_count integer, is_mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
begin
  return query
    select f.id, f.owner, p.handle, p.display_name, p.avatar_color, f.kind, f.snapshot, f.local_date,
           f.created_at,
           coalesce((select jsonb_object_agg(c.kind, c.n) from (
              select ch.kind, count(*)::int as n from public.cheers ch
              where ch.feed_item_id = f.id
                and not public.is_blocked(me, ch.user_id)
              group by ch.kind) c), '{}'::jsonb),
           (select ch.kind from public.cheers ch where ch.feed_item_id = f.id and ch.user_id = me),
           (select count(*)::int from public.comments cm
             where cm.feed_item_id = f.id and cm.deleted_at is null and not public.is_blocked(me, cm.author)),
           f.owner = me
    from public.feed_items f
    join public.social_profiles p on p.user_id = f.owner
    where (p_before is null or f.created_at < p_before)
      and (p_owner is null or f.owner = p_owner)
      and (f.owner = me or (f.hidden_at is null and public.can_view_feed(me, f.owner, f.audience, f.hidden_at)))
      and (f.owner <> me or f.hidden_at is null)
    order by f.created_at desc, f.id desc
    limit least(greatest(coalesce(p_max, 20), 1), 30);
end;
$$;

create function public.get_feed_item(p_id uuid)
returns table (id uuid, owner uuid, handle text, display_name text, avatar_color text, kind text,
               snapshot jsonb, local_date date, created_at timestamptz, cheers jsonb, my_cheer text,
               comment_count integer, is_mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  f public.feed_items := public.feed_row_visible(me, p_id);
begin
  if f.hidden_at is not null then raise exception 'not_found'; end if;
  return query
    select g.* from public.get_feed(f.created_at + interval '1 microsecond', 30, f.owner) g
    where g.id = p_id;
end;
$$;

create function public.list_comments(p_item uuid)
returns table (id uuid, author uuid, handle text, display_name text, avatar_color text, body text,
               created_at timestamptz, removed boolean, can_delete boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  f public.feed_items := public.feed_row_visible(me, p_item);
begin
  return query
    select c.id, c.author, p.handle, p.display_name, p.avatar_color,
           case when c.deleted_at is null then c.body end, c.created_at, c.deleted_at is not null,
           c.deleted_at is null and (c.author = me or f.owner = me)
    from public.comments c
    join public.social_profiles p on p.user_id = c.author
    where c.feed_item_id = p_item
      and p.banned_at is null
      and not public.is_blocked(me, c.author)
    order by c.created_at, c.id
    limit 200;
end;
$$;

create function public.set_cheer(p_item uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  f public.feed_items := public.feed_row_visible(me, p_item);
begin
  if f.owner = me then raise exception 'not_allowed'; end if;
  perform public.social_limit(me, 'social_cheer', 120, 3600);
  insert into public.cheers (feed_item_id, user_id, kind) values (p_item, me, p_kind)
  on conflict (feed_item_id, user_id) do update set kind = excluded.kind;
end;
$$;

create function public.remove_cheer(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  delete from public.cheers where feed_item_id = p_item and user_id = me;
end;
$$;

create function public.add_comment(p_item uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  f public.feed_items := public.feed_row_visible(me, p_item);
  cid uuid;
begin
  if f.hidden_at is not null then raise exception 'not_found'; end if;
  perform public.social_limit(me, 'social_comment', 60, 3600);
  insert into public.comments (feed_item_id, author, body) values (p_item, me, btrim(p_body))
  returning id into cid;
  return cid;
end;
$$;

create function public.delete_comment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  update public.comments c set deleted_at = now(), body = null
  where c.id = p_id and c.deleted_at is null
    and (c.author = me or exists (select 1 from public.feed_items f where f.id = c.feed_item_id and f.owner = me));
  if not found then raise exception 'not_found'; end if;
end;
$$;

create function public.hide_feed_item(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  update public.feed_items set hidden_at = now() where id = p_id and owner = me and hidden_at is null;
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Only the actions are callable by the app; helpers run inside them and inside RLS.
do $$
declare
  f text;
begin
  foreach f in array array[
    'social_active(uuid)', 'can_view_feed(uuid, uuid, text, timestamptz)',
    'is_weight_milestone(text, jsonb)', 'workout_snapshot(jsonb, boolean)',
    'activity_snapshot(jsonb)', 'social_notify(text, uuid, uuid, uuid)',
    'feed_from_workout()', 'feed_sets_changed()', 'feed_from_activity()', 'feed_from_milestone()',
    'feed_social_off()', 'comments_check()', 'push_on_cheer()', 'push_on_comment()',
    'push_on_friendship()', 'feed_row_visible(uuid, uuid)',
    'get_feed(timestamptz, integer, uuid)', 'get_feed_item(uuid)', 'list_comments(uuid)',
    'set_cheer(uuid, text)', 'remove_cheer(uuid)', 'add_comment(uuid, text)', 'delete_comment(uuid)',
    'hide_feed_item(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'get_feed(timestamptz, integer, uuid)', 'get_feed_item(uuid)', 'list_comments(uuid)',
    'set_cheer(uuid, text)', 'remove_cheer(uuid)', 'add_comment(uuid, text)', 'delete_comment(uuid)',
    'hide_feed_item(uuid)',
    -- used by the RLS policies, evaluated as the caller
    'can_view_feed(uuid, uuid, text, timestamptz)'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
