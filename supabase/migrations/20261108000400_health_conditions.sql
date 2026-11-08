-- health_conditions: injuries and conditions (GDPR special-category data).
-- Collected only after explicit health_data consent; deletable independently.

create table public.health_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('injury', 'condition')),
  body_area text check (body_area in (
    'ankle_foot', 'calf_achilles', 'knee', 'hip_groin', 'hamstring', 'lower_back',
    'shoulder', 'elbow_wrist_hand', 'neck', 'other'
  )),
  side text not null default 'na' check (side in ('left', 'right', 'both', 'na')),
  description text check (char_length(description) <= 500),
  status text not null default 'active' check (status in (
    'active', 'recovering', 'cleared_training', 'cleared_sport', 'resolved'
  )),
  pain_level smallint check (pain_level between 0 and 10),
  restriction_tags text[] not null default '{}',
  professional_restrictions text check (char_length(professional_restrictions) <= 1000),
  professional_clearance boolean not null default false,
  onset_date date,
  resolved_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_conditions_injury_area check (kind <> 'injury' or body_area is not null)
);

create index health_conditions_user_idx on public.health_conditions (user_id, status);

create trigger health_conditions_set_updated_at
  before update on public.health_conditions
  for each row execute function public.set_updated_at();

alter table public.health_conditions enable row level security;

revoke all on table public.health_conditions from anon, authenticated;
grant select, insert, update, delete on table public.health_conditions to authenticated;

create policy "health_conditions: select own" on public.health_conditions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "health_conditions: insert own" on public.health_conditions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "health_conditions: update own" on public.health_conditions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "health_conditions: delete own" on public.health_conditions
  for delete to authenticated using ((select auth.uid()) = user_id);
