-- PACE foundation helpers.
-- Shared trigger functions used by every table.

create extension if not exists pgcrypto with schema extensions;

-- Keeps updated_at current on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Trigger: sets updated_at = now() on update.';

-- Anonymous users must never read or write application tables.
alter default privileges in schema public revoke all on tables from anon;
