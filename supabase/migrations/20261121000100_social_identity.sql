-- Social identity is fixed (spec 33.8, decision 2026-11-21): one username chosen once at setup.
-- - The username is 3–20 letters, digits, _ or . (no spaces); it is unique regardless of case,
--   because the handle is always its lowercase form (Dominko → @dominko).
-- - The avatar colour is assigned from the user id, not chosen.
-- - None of the three can be changed afterwards; only the bio and "findable" stay editable.

-- 1. Existing profiles (test accounts only at this point) are brought in line first: a name that
--    doesn't fit, or differs from the handle by more than case, becomes the handle.
update public.social_profiles
set display_name = handle
where not (display_name ~ '^[A-Za-z0-9_.]{3,20}$') or lower(display_name) <> handle;

alter table public.social_profiles
  add constraint social_profiles_display_name_username
  check (display_name ~ '^[A-Za-z0-9_.]{3,20}$'),
  add constraint social_profiles_handle_matches_name check (handle = lower(display_name));

-- 2. The colour for a user: the first 32 bits of the id pick one of the 8 palette colours
--    (mirrored by avatarColorFor in src/domain/social/avatar.ts).
create function public.social_avatar_color(uid uuid) returns text
language sql immutable set search_path = '' as $$
  select (array['mint','sky','violet','rose','amber','lime','teal','slate'])[
    (('x' || '00000000' || substr(replace(uid::text, '-', ''), 1, 8))::bit(64)::bigint % 8)::int + 1];
$$;

-- 3. Insert derives handle and colour; update refuses identity changes.
create or replace function public.social_profiles_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.display_name := btrim(new.display_name);
    new.handle := lower(new.display_name);
    new.avatar_color := public.social_avatar_color(new.user_id);
  elsif new.display_name is distinct from old.display_name
     or new.handle is distinct from old.handle
     or new.avatar_color is distinct from old.avatar_color then
    raise exception 'identity_locked';
  end if;
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

-- 4. Clients send the username when creating (a handle they send is replaced by the trigger; the
--    column stays insertable because it is required), and only bio/findable later.
revoke insert, update on table public.social_profiles from authenticated;
grant insert (user_id, handle, display_name, bio, discoverable) on table public.social_profiles
  to authenticated;
grant update (bio, discoverable) on table public.social_profiles to authenticated;
