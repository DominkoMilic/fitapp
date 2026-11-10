-- Turning a sharing type off can also hide the earlier posts of that type, and turning it back on
-- can show them again (decisions 2026-11-20). Posts removed one by one ("Remove from feed") stay
-- removed: hidden_reason tells the two apart.

alter table public.feed_items
  add column hidden_reason text check (hidden_reason in ('removed', 'sharing_off'));
update public.feed_items set hidden_reason = 'removed' where hidden_at is not null;
alter table public.feed_items
  add constraint feed_items_hidden_reason check ((hidden_at is null) = (hidden_reason is null));

create or replace function public.hide_feed_item(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  update public.feed_items set hidden_at = now(), hidden_reason = 'removed'
  where id = p_id and owner = me and (hidden_at is null or hidden_reason = 'sharing_off');
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Hides every visible post of one kind; returns how many.
create function public.hide_my_posts(p_kind text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
  n integer;
begin
  if p_kind not in ('workout', 'activity', 'milestone', 'challenge_done') then raise exception 'not_allowed'; end if;
  update public.feed_items set hidden_at = now(), hidden_reason = 'sharing_off'
  where owner = me and kind = p_kind and hidden_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- How many posts of one kind were hidden by switching sharing off (to offer showing them again).
create function public.hidden_post_count(p_kind text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.feed_items
  where owner = auth.uid() and kind = p_kind and hidden_reason = 'sharing_off';
$$;

-- Shows the posts hidden by switching sharing off again; returns how many.
create function public.show_my_posts(p_kind text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  n integer;
begin
  update public.feed_items set hidden_at = null, hidden_reason = null
  where owner = me and kind = p_kind and hidden_reason = 'sharing_off';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.hide_my_posts(text), public.hidden_post_count(text), public.show_my_posts(text)
  from public, anon;
grant execute on function public.hide_my_posts(text), public.hidden_post_count(text), public.show_my_posts(text)
  to authenticated;
