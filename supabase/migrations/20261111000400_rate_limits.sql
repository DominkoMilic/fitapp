-- Per-user rate limiting for Edge Functions (spec 19: recipes-proxy 60 requests/min per user).
-- Only the service role (Edge Functions) can touch it; no client access at all.
create table public.edge_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits from anon, authenticated;

-- Returns true when the call is allowed. Old windows are pruned opportunistically.
create or replace function public.hit_rate_limit(uid uuid, bucket_name text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  n integer;
begin
  insert into public.edge_rate_limits (user_id, bucket, window_start, hits)
  values (uid, bucket_name, w, 1)
  on conflict (user_id, bucket, window_start) do update set hits = public.edge_rate_limits.hits + 1
  returning hits into n;
  if random() < 0.01 then
    delete from public.edge_rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= max_hits;
end;
$$;

revoke all on function public.hit_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(uuid, text, integer, integer) to service_role;
