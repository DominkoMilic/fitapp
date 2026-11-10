-- Phase 8A — social profiles, friends, blocks and reports (spec 33).
-- Nothing is shared in 8A: other people can see only your handle, name, colour and bio, and
-- only when you are related (friends or a pending request) or they search for your handle.
-- Friendships, blocks and reports are written only through the security-definer functions
-- below, which check permissions, blocks, bans, limits and the server kill switch.

-- ---------------------------------------------------------------------------------------------
-- Server configuration (kill switch)
-- ---------------------------------------------------------------------------------------------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;
grant select on table public.app_config to authenticated;
create policy "app_config: read" on public.app_config for select to authenticated using (true);
insert into public.app_config (key, value) values ('social_enabled', 'true');

create function public.social_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_config where key = 'social_enabled'), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- Switch, consent
-- ---------------------------------------------------------------------------------------------
alter table public.user_preferences add column social_enabled boolean not null default false;

alter table public.consents drop constraint consents_consent_type_check;
alter table public.consents add constraint consents_consent_type_check check (consent_type in (
  'terms', 'privacy', 'health_data', 'location', 'background_location', 'notifications', 'social'
));

-- ---------------------------------------------------------------------------------------------
-- Word filter (same lists as src/domain/social/filter.ts; a unit test keeps them in sync)
-- ---------------------------------------------------------------------------------------------
create table public.social_blocked_words (word text primary key);
create table public.social_reserved_handles (handle text primary key);
alter table public.social_blocked_words enable row level security;
alter table public.social_reserved_handles enable row level security;
revoke all on table public.social_blocked_words, public.social_reserved_handles from anon, authenticated;

-- BEGIN BLOCKED WORDS
insert into public.social_blocked_words (word) values
  ('fuck'), ('shit'), ('cunt'), ('bitch'), ('nigger'), ('nigga'), ('faggot'), ('fag'),
  ('retard'), ('whore'), ('slut'), ('rape'), ('rapist'), ('nazi'), ('hitler'), ('porn'),
  ('pussy'), ('wank'), ('twat'), ('kys');
-- END BLOCKED WORDS

-- BEGIN RESERVED HANDLES
insert into public.social_reserved_handles (handle) values
  ('admin'), ('administrator'), ('pace'), ('paceapp'), ('pace_app'), ('support'), ('help'),
  ('moderator'), ('mod'), ('official'), ('staff'), ('team'), ('system'), ('root'), ('null'),
  ('undefined'), ('settings'), ('social'), ('add'), ('api'), ('www');
-- END RESERVED HANDLES

-- Lower case, common look-alike characters mapped to letters (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s).
create function public.social_normalise(t text) returns text
language sql immutable set search_path = '' as $$
  select translate(lower(t), '013457@$', 'oieastas');
$$;

-- A word is blocked when a word of the text equals it, or starts with it (blocked words of 4+ letters).
create function public.social_text_ok(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select t is null or not exists (
    select 1
    from regexp_split_to_table(public.social_normalise(t), '[^a-z]+') as tok
    join public.social_blocked_words w
      on tok = w.word or (char_length(w.word) >= 4 and tok like w.word || '%')
    where tok <> ''
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_color text not null default 'mint'
    check (avatar_color in ('mint', 'sky', 'violet', 'rose', 'amber', 'lime', 'teal', 'slate')),
  bio text check (bio is null or char_length(bio) <= 140),
  discoverable boolean not null default true,
  banned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.social_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  workouts_audience text not null default 'private'
    check (workouts_audience in ('private', 'friends', 'friends_and_clubs')),
  activities_audience text not null default 'private'
    check (activities_audience in ('private', 'friends', 'friends_and_clubs')),
  milestones_audience text not null default 'private'
    check (milestones_audience in ('private', 'friends', 'friends_and_clubs')),
  challenge_results_audience text not null default 'private'
    check (challenge_results_audience in ('private', 'friends', 'friends_and_clubs')),
  share_volume boolean not null default false,
  friend_requests_from text not null default 'everyone'
    check (friend_requests_from in ('everyone', 'nobody')),
  in_leaderboards boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per pair (user_low < user_high), so a pair can never have two friendships.
create table public.friendships (
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high))
);
create index friendships_user_high_idx on public.friendships (user_high);

create table public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked_idx on public.blocks (blocked);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'feed_item', 'comment', 'club')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);

create trigger social_profiles_updated_at before update on public.social_profiles
  for each row execute function public.set_updated_at();
create trigger social_settings_updated_at before update on public.social_settings
  for each row execute function public.set_updated_at();

-- Handle, name and bio: reserved handles and blocked words are refused.
create function public.social_profiles_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.handle := lower(new.handle);
  if exists (select 1 from public.social_reserved_handles where handle = new.handle) then
    raise exception 'handle_reserved';
  end if;
  if not (public.social_text_ok(new.handle) and public.social_text_ok(new.display_name)
          and public.social_text_ok(new.bio)) then
    raise exception 'not_allowed';
  end if;
  return new;
end;
$$;
create trigger social_profiles_check before insert or update on public.social_profiles
  for each row execute function public.social_profiles_check();

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
                 where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships
                 where user_low = least(a, b) and user_high = greatest(a, b) and status = 'accepted');
$$;

create function public.is_banned(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.social_profiles where user_id = u and banned_at is not null);
$$;

-- Friends or a pending request between the two, and no block either way.
create function public.social_related(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships
                 where user_low = least(a, b) and user_high = greatest(a, b))
     and not public.is_blocked(a, b);
$$;

-- The relationship as seen by `me`.
create function public.social_relationship(me uuid, other uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.blocks where blocker = me and blocked = other) then 'blocked'
    else coalesce((
      select case when f.status = 'accepted' then 'friends'
                  when f.requested_by = me then 'outgoing'
                  else 'incoming' end
      from public.friendships f
      where f.user_low = least(me, other) and f.user_high = greatest(me, other)), 'none')
  end;
$$;

-- The calling user, after the checks every social action needs. `active` also requires social to
-- be switched on and the user not banned (for actions that reach other people).
create function public.social_caller(active boolean) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if active then
    if not public.social_on() then raise exception 'social_disabled'; end if;
    if not exists (select 1 from public.social_profiles where user_id = me) then
      raise exception 'no_profile';
    end if;
    if public.is_banned(me) then raise exception 'banned'; end if;
    if not coalesce((select social_enabled from public.user_preferences where user_id = me), false) then
      raise exception 'social_off';
    end if;
  end if;
  return me;
end;
$$;

create function public.social_limit(me uuid, bucket text, max_hits integer, window_seconds integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.hit_rate_limit(me, bucket, max_hits, window_seconds) then
    raise exception 'rate_limited';
  end if;
end;
$$;

create function public.social_friend_count(u uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.friendships
  where (user_low = u or user_high = u) and status = 'accepted';
$$;

-- Someone others may find and contact: has a profile, social on, not banned.
create function public.social_reachable(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.social_profiles p
                 join public.user_preferences up on up.user_id = p.user_id
                 where p.user_id = u and p.banned_at is null and up.social_enabled);
$$;

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------
alter table public.social_profiles enable row level security;
alter table public.social_settings enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
revoke all on table public.social_profiles, public.social_settings, public.friendships,
  public.blocks, public.reports from anon, authenticated;

grant select on table public.social_profiles to authenticated;
grant insert (user_id, handle, display_name, avatar_color, bio, discoverable)
  on table public.social_profiles to authenticated;
grant update (handle, display_name, avatar_color, bio, discoverable)
  on table public.social_profiles to authenticated;
create policy "social_profiles: own or related" on public.social_profiles
  for select to authenticated
  using (user_id = (select auth.uid())
         or (banned_at is null and public.social_related((select auth.uid()), user_id)));
create policy "social_profiles: create own" on public.social_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.social_on());
create policy "social_profiles: update own" on public.social_profiles
  for update to authenticated
  using (user_id = (select auth.uid()) and banned_at is null)
  with check (user_id = (select auth.uid()));

grant select, insert, update on table public.social_settings to authenticated;
create policy "social_settings: read own" on public.social_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "social_settings: create own" on public.social_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "social_settings: update own" on public.social_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on table public.friendships, public.blocks, public.reports to authenticated;
create policy "friendships: own" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_low, user_high));
create policy "blocks: own" on public.blocks
  for select to authenticated using (blocker = (select auth.uid()));
create policy "reports: own" on public.reports
  for select to authenticated using (reporter = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Actions (the only way to write friendships, blocks and reports)
-- ---------------------------------------------------------------------------------------------
create function public.social_handle_available(p_handle text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
  h text := lower(btrim(p_handle));
begin
  perform public.social_limit(me, 'social_search', 60, 3600);
  return not exists (select 1 from public.social_profiles where handle = h and user_id <> me)
     and not exists (select 1 from public.social_reserved_handles where handle = h);
end;
$$;

create function public.search_social_profiles(q text)
returns table (handle text, display_name text, avatar_color text, relationship text)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  n text := regexp_replace(lower(coalesce(q, '')), '[^a-z0-9_.]', '', 'g');
begin
  if char_length(n) < 3 then return; end if;
  perform public.social_limit(me, 'social_search', 60, 3600);
  return query
    select p.handle, p.display_name, p.avatar_color, public.social_relationship(me, p.user_id)
    from public.social_profiles p
    where p.user_id <> me
      and left(p.handle, char_length(n)) = n
      and p.discoverable
      and public.social_reachable(p.user_id)
      and not exists (select 1 from public.blocks b where b.blocker = p.user_id and b.blocked = me)
    order by p.handle
    limit 20;
end;
$$;

-- One person's card. Hidden (no row) when they blocked you, are banned, or can't be found and
-- aren't related to you.
create function public.get_social_profile(p_handle text)
returns table (user_id uuid, handle text, display_name text, avatar_color text, bio text,
               relationship text, friend_count integer)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  return query
    select p.user_id, p.handle, p.display_name, p.avatar_color, p.bio,
           public.social_relationship(me, p.user_id), public.social_friend_count(p.user_id)
    from public.social_profiles p
    where p.handle = lower(btrim(p_handle))
      and p.banned_at is null
      and not exists (select 1 from public.blocks b where b.blocker = p.user_id and b.blocked = me)
      and (p.user_id = me
           or public.social_relationship(me, p.user_id) <> 'none'
           or (p.discoverable and public.social_reachable(p.user_id)));
end;
$$;

-- Returns the new relationship: 'outgoing', or 'friends' when they had already asked you.
create function public.send_friend_request(p_handle text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  other uuid;
  rel text;
begin
  perform public.social_limit(me, 'social_friend_request', 30, 86400);
  select p.user_id into other from public.social_profiles p where p.handle = lower(btrim(p_handle));
  if other is null or other = me or not public.social_reachable(other)
     or exists (select 1 from public.blocks where blocker = other and blocked = me) then
    raise exception 'not_found';
  end if;
  rel := public.social_relationship(me, other);
  if rel = 'blocked' then raise exception 'blocked'; end if;
  if rel in ('friends', 'outgoing') then return rel; end if;
  if rel = 'incoming' then return public.accept_friend_request(other); end if;
  if (select friend_requests_from from public.social_settings where user_id = other) = 'nobody' then
    raise exception 'requests_closed';
  end if;
  if public.social_friend_count(me) >= 500 or public.social_friend_count(other) >= 500 then
    raise exception 'friend_limit';
  end if;
  insert into public.friendships (user_low, user_high, requested_by)
  values (least(me, other), greatest(me, other), me);
  return 'outgoing';
end;
$$;

create function public.accept_friend_request(other uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
begin
  if not exists (select 1 from public.friendships
                 where user_low = least(me, other) and user_high = greatest(me, other)
                   and status = 'pending' and requested_by = other)
     or public.is_blocked(me, other) or public.is_banned(other) then
    raise exception 'not_found';
  end if;
  if public.social_friend_count(me) >= 500 or public.social_friend_count(other) >= 500 then
    raise exception 'friend_limit';
  end if;
  update public.friendships set status = 'accepted', accepted_at = now()
  where user_low = least(me, other) and user_high = greatest(me, other);
  return 'friends';
end;
$$;

-- Declines, cancels or ends a friendship (whatever exists between the two).
create function public.remove_friend(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  delete from public.friendships where user_low = least(me, other) and user_high = greatest(me, other);
end;
$$;

create function public.block_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  if other = me then raise exception 'not_allowed'; end if;
  delete from public.friendships where user_low = least(me, other) and user_high = greatest(me, other);
  insert into public.blocks (blocker, blocked) values (me, other) on conflict do nothing;
end;
$$;

create function public.unblock_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  delete from public.blocks where blocker = me and blocked = other;
end;
$$;

create function public.list_friendships()
returns table (user_id uuid, handle text, display_name text, avatar_color text,
               relationship text, since timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  return query
    select p.user_id, p.handle, p.display_name, p.avatar_color,
           case when f.status = 'accepted' then 'friends'
                when f.requested_by = me then 'outgoing' else 'incoming' end,
           coalesce(f.accepted_at, f.created_at)
    from public.friendships f
    join public.social_profiles p
      on p.user_id = case when f.user_low = me then f.user_high else f.user_low end
    where me in (f.user_low, f.user_high)
      and p.banned_at is null
      and not public.is_blocked(me, p.user_id)
    order by p.display_name, p.handle;
end;
$$;

create function public.list_blocked()
returns table (user_id uuid, handle text, display_name text, avatar_color text, blocked_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  return query
    select b.blocked, p.handle, p.display_name, p.avatar_color, b.created_at
    from public.blocks b
    left join public.social_profiles p on p.user_id = b.blocked
    where b.blocker = me
    order by b.created_at desc;
end;
$$;

create function public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
  rid uuid;
begin
  perform public.social_limit(me, 'social_report', 20, 86400);
  insert into public.reports (reporter, target_type, target_id, reason, note)
  values (me, p_target_type, p_target_id, p_reason, nullif(btrim(p_note), ''))
  returning id into rid;
  return rid;
end;
$$;

-- Removes the profile, settings and friendships and switches social off. Blocks you made stay,
-- so the people you blocked can't reach you if you come back.
create function public.delete_social_profile() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  delete from public.friendships where me in (user_low, user_high);
  delete from public.social_settings where user_id = me;
  delete from public.social_profiles where user_id = me;
  update public.user_preferences set social_enabled = false where user_id = me;
end;
$$;

-- Only the actions are callable by the app; the helpers run inside them (and inside RLS).
do $$
declare
  f text;
begin
  foreach f in array array[
    'social_on()', 'social_normalise(text)', 'social_text_ok(text)', 'social_profiles_check()',
    'is_blocked(uuid, uuid)', 'are_friends(uuid, uuid)', 'is_banned(uuid)',
    'social_related(uuid, uuid)', 'social_relationship(uuid, uuid)', 'social_caller(boolean)',
    'social_limit(uuid, text, integer, integer)', 'social_friend_count(uuid)',
    'social_reachable(uuid)', 'social_handle_available(text)', 'search_social_profiles(text)',
    'get_social_profile(text)', 'send_friend_request(text)', 'accept_friend_request(uuid)',
    'remove_friend(uuid)', 'block_user(uuid)', 'unblock_user(uuid)', 'list_friendships()',
    'list_blocked()', 'report_content(text, uuid, text, text)', 'delete_social_profile()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
  end loop;
  foreach f in array array[
    'social_handle_available(text)', 'search_social_profiles(text)', 'get_social_profile(text)',
    'send_friend_request(text)', 'accept_friend_request(uuid)', 'remove_friend(uuid)',
    'block_user(uuid)', 'unblock_user(uuid)', 'list_friendships()', 'list_blocked()',
    'report_content(text, uuid, text, text)', 'delete_social_profile()',
    -- used by the RLS policies, evaluated as the caller
    'social_on()', 'social_related(uuid, uuid)'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'social_normalise(text)', 'social_text_ok(text)', 'social_profiles_check()',
    'is_blocked(uuid, uuid)', 'are_friends(uuid, uuid)', 'is_banned(uuid)', 'social_relationship(uuid, uuid)',
    'social_caller(boolean)', 'social_limit(uuid, text, integer, integer)',
    'social_friend_count(uuid)', 'social_reachable(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from authenticated', f);
  end loop;
end $$;
