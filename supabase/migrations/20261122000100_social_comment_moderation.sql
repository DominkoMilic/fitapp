-- Comment moderation (spec 33.7, decision 2026-11-22).
-- - Two word severities: 'block' (slurs, hate, sexual violence, self-harm: always refused) and
--   'flag' (swearing: comments are accepted but flagged, and the post owner is alerted so they can
--   remove it). Names, handles and bios refuse both.
-- - Croatian/Bosnian/Serbian words; č ć š ž đ are folded to c c s z d before matching.
-- - A post owner can turn comments off: existing comments are hidden (not deleted), new ones are
--   refused, cheers still work; turning them back on shows the earlier comments again.

-- ---------------------------------------------------------------------------------------------
-- Words
-- ---------------------------------------------------------------------------------------------
alter table public.social_blocked_words
  add column severity text not null default 'block' check (severity in ('block', 'flag'));

-- BEGIN FLAGGED WORDS
update public.social_blocked_words set severity = 'flag'
where word in ('fuck', 'shit', 'bitch', 'pussy', 'wank', 'twat');
insert into public.social_blocked_words (word, severity) values
  ('jebe', 'flag'), ('jebo', 'flag'), ('jebi', 'flag'), ('jeba', 'flag'), ('kurac', 'flag'),
  ('kurc', 'flag'), ('picka', 'flag'), ('picke', 'flag'), ('picki', 'flag'), ('picku', 'flag'),
  ('pizd', 'flag'), ('sranj', 'flag'), ('govn', 'flag'), ('kurv', 'flag'), ('drka', 'flag'),
  ('debil', 'flag'), ('kreten', 'flag'), ('idiot', 'flag'), ('smrad', 'flag'), ('glupan', 'flag')
on conflict (word) do update set severity = excluded.severity;
-- END FLAGGED WORDS

-- BEGIN REGIONAL BLOCKED WORDS
insert into public.social_blocked_words (word, severity) values
  ('peder', 'block'), ('cigan', 'block'), ('ustas', 'block'), ('cetnik', 'block'),
  ('balij', 'block'), ('siptar', 'block')
on conflict (word) do update set severity = excluded.severity;
-- END REGIONAL BLOCKED WORDS

-- Lower case; look-alike characters and Croatian letters mapped to plain ones
-- (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s, č/ć→c, š→s, ž→z, đ→d).
create or replace function public.social_normalise(t text) returns text
language sql immutable set search_path = '' as $$
  select translate(lower(t), '013457@$čćšžđ', 'oieastasccszd');
$$;

-- Words of the text that match a listed word (equal, or starting with a listed word of 4+ letters).
create function public.social_word_hits(t text, p_severity text) returns boolean
language sql stable security definer set search_path = '' as $$
  select t is not null and exists (
    select 1
    from regexp_split_to_table(public.social_normalise(t), '[^a-z]+') as tok
    join public.social_blocked_words w
      on (p_severity is null or w.severity = p_severity)
     and (tok = w.word or (char_length(w.word) >= 4 and tok like w.word || '%'))
    where tok <> ''
  );
$$;

-- Names, handles and bios: no listed word at all (unchanged behaviour, now with both lists).
create or replace function public.social_text_ok(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not public.social_word_hits(t, null);
$$;

-- ---------------------------------------------------------------------------------------------
-- Comments: flagged, comments off
-- ---------------------------------------------------------------------------------------------
alter table public.comments add column flagged boolean not null default false;
alter table public.feed_items add column comments_off_at timestamptz;
alter table public.social_settings add column notify_flagged boolean not null default true;

-- Comments refuse only 'block' words; swearing is accepted and flagged for the post owner.
create or replace function public.comments_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is null then
    if public.social_word_hits(new.body, 'block') then
      raise exception 'not_allowed';
    end if;
    if tg_op = 'INSERT' then
      new.flagged := public.social_word_hits(new.body, 'flag');
    end if;
  end if;
  return new;
end;
$$;

-- A flagged comment sends the owner one "check a comment" push instead of "commented".
create or replace function public.push_on_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.social_notify(case when new.flagged then 'comment_flagged' else 'comment' end,
                               (select owner from public.feed_items where id = new.feed_item_id),
                               new.author, new.feed_item_id);
  return null;
end;
$$;

create function public.set_comments_off(p_id uuid, p_off boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  update public.feed_items
  set comments_off_at = case when p_off then coalesce(comments_off_at, now()) end
  where id = p_id and owner = me;
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function public.add_comment(p_item uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  f public.feed_items := public.feed_row_visible(me, p_item);
  cid uuid;
begin
  if f.hidden_at is not null then raise exception 'not_found'; end if;
  if f.comments_off_at is not null then raise exception 'comments_off'; end if;
  perform public.social_limit(me, 'social_comment', 60, 3600);
  insert into public.comments (feed_item_id, author, body) values (p_item, me, btrim(p_body))
  returning id into cid;
  return cid;
end;
$$;

-- list_comments gains flagged (shown to the post owner only) and is_mine; nothing while off.
drop function public.list_comments(uuid);
create function public.list_comments(p_item uuid)
returns table (id uuid, author uuid, handle text, display_name text, avatar_color text, body text,
               created_at timestamptz, removed boolean, can_delete boolean, flagged boolean,
               is_mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(true);
  f public.feed_items := public.feed_row_visible(me, p_item);
begin
  if f.comments_off_at is not null then return; end if;
  return query
    select c.id, c.author, p.handle, p.display_name, p.avatar_color,
           case when c.deleted_at is null then c.body end, c.created_at, c.deleted_at is not null,
           c.deleted_at is null and (c.author = me or f.owner = me),
           c.deleted_at is null and c.flagged and f.owner = me,
           c.author = me
    from public.comments c
    join public.social_profiles p on p.user_id = c.author
    where c.feed_item_id = p_item
      and p.banned_at is null
      and not public.is_blocked(me, c.author)
    order by c.created_at, c.id
    limit 200;
end;
$$;

-- get_feed / get_feed_item gain comments_off; the count is 0 while comments are off.
drop function public.get_feed_item(uuid);
drop function public.get_feed(timestamptz, integer, uuid);
create function public.get_feed(p_before timestamptz default null, p_max integer default 20,
                                p_owner uuid default null)
returns table (id uuid, owner uuid, handle text, display_name text, avatar_color text, kind text,
               snapshot jsonb, local_date date, created_at timestamptz, cheers jsonb, my_cheer text,
               comment_count integer, is_mine boolean, comments_off boolean)
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
           case when f.comments_off_at is not null then 0 else
             (select count(*)::int from public.comments cm
               where cm.feed_item_id = f.id and cm.deleted_at is null
                 and not public.is_blocked(me, cm.author)) end,
           f.owner = me,
           f.comments_off_at is not null
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
               comment_count integer, is_mine boolean, comments_off boolean)
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

-- Same access as the other actions: signed-in users call the actions, helpers stay internal.
revoke all on function public.social_word_hits(text, text) from public, anon, authenticated;
revoke all on function public.set_comments_off(uuid, boolean) from public, anon;
revoke all on function public.list_comments(uuid) from public, anon;
revoke all on function public.get_feed(timestamptz, integer, uuid) from public, anon;
revoke all on function public.get_feed_item(uuid) from public, anon;
grant execute on function public.set_comments_off(uuid, boolean) to authenticated;
grant execute on function public.list_comments(uuid) to authenticated;
grant execute on function public.get_feed(timestamptz, integer, uuid) to authenticated;
grant execute on function public.get_feed_item(uuid) to authenticated;
