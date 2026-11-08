-- Phase 2: weight_entries, body_measurements, daily_checkins, user_milestones.

-- ------------------------------------------------------------- weight_entries
create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight_kg numeric(5, 2) not null check (weight_kg between 30 and 350),
  measured_at timestamptz not null,
  -- Calendar date in the user's timezone when measured; never recomputed (spec 3.2).
  local_date date not null,
  note text check (char_length(note) <= 500),
  source text not null default 'manual' check (source in ('manual', 'onboarding', 'import')),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_entries_not_future check (measured_at <= now() + interval '1 day')
);

create index weight_entries_user_time_idx on public.weight_entries (user_id, measured_at desc);
create index weight_entries_user_date_idx on public.weight_entries (user_id, local_date);

create trigger weight_entries_set_updated_at
  before update on public.weight_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- body_measurements
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measurement_type text not null check (measurement_type in (
    'waist', 'hips', 'chest', 'arm_left', 'arm_right', 'thigh_left', 'thigh_right',
    'calf_left', 'calf_right', 'neck'
  )),
  value_cm numeric(5, 1) not null check (value_cm between 10 and 250),
  measured_at timestamptz not null,
  local_date date not null,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index body_measurements_user_type_idx
  on public.body_measurements (user_id, measurement_type, measured_at desc);

create trigger body_measurements_set_updated_at
  before update on public.body_measurements
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ daily_checkins
-- One check-in per user per local day: the natural key makes offline upserts idempotent.
create table public.daily_checkins (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 24),
  fatigue smallint check (fatigue between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  pain smallint check (pain between 0 and 10),
  pain_area text,
  note text check (char_length(note) <= 500),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create trigger daily_checkins_set_updated_at
  before update on public.daily_checkins
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------- user_milestones
-- Unlocks are idempotent (unique key) and never revoked (no update/delete privilege).
create table public.user_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone_key text not null check (char_length(milestone_key) between 1 and 80),
  title text not null,
  description text,
  threshold numeric,
  value numeric,
  unlocked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_milestones_unique unique (user_id, milestone_key)
);

-- ------------------------------------------------------------------- RLS
alter table public.weight_entries enable row level security;
alter table public.body_measurements enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.user_milestones enable row level security;

revoke all on table public.weight_entries, public.body_measurements, public.daily_checkins,
  public.user_milestones from anon, authenticated;
grant select, insert, update, delete on table public.weight_entries, public.body_measurements,
  public.daily_checkins to authenticated;
grant select, insert on table public.user_milestones to authenticated;

create policy "weight_entries: select own" on public.weight_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "weight_entries: insert own" on public.weight_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weight_entries: update own" on public.weight_entries
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weight_entries: delete own" on public.weight_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "body_measurements: select own" on public.body_measurements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "body_measurements: insert own" on public.body_measurements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "body_measurements: update own" on public.body_measurements
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "body_measurements: delete own" on public.body_measurements
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "daily_checkins: select own" on public.daily_checkins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_checkins: insert own" on public.daily_checkins
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_checkins: update own" on public.daily_checkins
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_checkins: delete own" on public.daily_checkins
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "user_milestones: select own" on public.user_milestones
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_milestones: insert own" on public.user_milestones
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ------------------------------------------- first weight entry from the goal
-- The onboarding weight becomes the first weight entry (docs/decisions.md, Phase 1 #7).
create or replace function public.seed_first_weight_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.weight_entries where user_id = new.user_id) then
    insert into public.weight_entries (user_id, weight_kg, measured_at, local_date, source)
    values (new.user_id, new.starting_weight_kg, now(), new.started_at, 'onboarding');
  end if;
  return new;
end;
$$;

create trigger user_goals_seed_first_weight
  after insert on public.user_goals
  for each row execute function public.seed_first_weight_entry();

-- Backfill users who completed onboarding before this migration.
insert into public.weight_entries (user_id, weight_kg, measured_at, local_date, source)
select g.user_id, g.starting_weight_kg, g.created_at, g.started_at, 'onboarding'
from public.user_goals g
where g.status = 'active'
  and not exists (select 1 from public.weight_entries w where w.user_id = g.user_id);
