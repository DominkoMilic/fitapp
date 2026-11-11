-- Removing a comment deletes it completely (decision 2026-11-23, replaces "Comment removed"
-- placeholders from 2026-11-19): the row is gone for everyone, with no trace in the thread.

-- Placeholders left by the earlier soft removal are deleted too.
delete from public.comments where deleted_at is not null;

create or replace function public.delete_comment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.social_caller(false);
begin
  -- The author, or the owner of the post the comment is on.
  delete from public.comments c
  where c.id = p_id
    and (c.author = me or exists (select 1 from public.feed_items f where f.id = c.feed_item_id and f.owner = me));
  if not found then raise exception 'not_found'; end if;
end;
$$;
