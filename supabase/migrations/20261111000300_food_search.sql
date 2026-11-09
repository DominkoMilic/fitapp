-- Ranked food search: own foods first, then full-text relevance, then shorter (more generic) names.
-- SECURITY INVOKER, so RLS decides what the caller can see.
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
    -- Main name is the first word typed: "egg" → "Egg, whole, raw" (also matches simple plurals).
    (lower(split_part(f.name, ',', 1)) in (q.first_word, q.first_word || 's', q.first_word || 'es')) desc,
    -- Whole-word matches before prefix-only matches ("egg" before "eggnog").
    (f.search @@ to_tsquery('simple', q.exact_q)) desc,
    -- Generic foods before all-caps brand names.
    (f.name !~ '[A-Z]{3,}') desc,
    ts_rank(f.search, to_tsquery('simple', q.prefix_q)) desc,
    length(f.name) asc
  limit least(greatest(coalesce(max_results, 30), 1), 100);
$$;

revoke all on function public.search_foods(text, integer) from public, anon;
grant execute on function public.search_foods(text, integer) to authenticated;
