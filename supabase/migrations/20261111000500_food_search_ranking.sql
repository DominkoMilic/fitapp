-- Food search ranking, tuned after testing real searches: processed forms (dried, powder, mixes,
-- dehydrated, canned, frozen) rank below the plain food, so "egg" shows "Egg, whole, raw, fresh"
-- before "Egg, yolk, dried".
create or replace function public.search_foods(query text, max_results integer default 30)
returns setof public.foods
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    select array(
      select regexp_replace(w, '[^[:alnum:]]', '', 'g')
      from unnest(regexp_split_to_array(lower(trim(coalesce(query, ''))), '\s+')) as w
      where length(regexp_replace(w, '[^[:alnum:]]', '', 'g')) > 0
      limit 6
    ) as w
  ),
  q as (
    select
      w[1] as first_word,
      w as all_words,
      nullif(array_to_string(array(select x || ':*' from unnest(w) x), ' & '), '') as prefix_q,
      nullif(array_to_string(w, ' & '), '') as exact_q
    from words
  )
  select f.*
  from public.foods f, q
  where q.prefix_q is not null
    and f.archived_at is null
    and f.search @@ to_tsquery('simple', q.prefix_q)
  order by
    (f.owner_id is not null) desc,
    -- Processed forms after the plain food, unless the user typed that word.
    (f.name ~* '\m(dried|powder|powdered|dehydrated|mix|canned|frozen|freeze-dried)\M'
      and not (q.all_words && array['dried', 'powder', 'powdered', 'dehydrated', 'mix', 'canned', 'frozen'])) asc,
    (lower(split_part(f.name, ',', 1)) in (q.first_word, q.first_word || 's', q.first_word || 'es')) desc,
    (f.search @@ to_tsquery('simple', q.exact_q)) desc,
    (f.name !~ '[A-Z]{3,}') desc,
    -- Plain everyday forms first: whole (egg, milk), then raw/fresh.
    (f.name ~* '\mwhole\M') desc,
    (f.name ~* '\m(raw|fresh)\M') desc,
    ts_rank(f.search, to_tsquery('simple', q.prefix_q)) desc,
    length(f.name) asc
  limit least(greatest(coalesce(max_results, 30), 1), 100);
$$;
