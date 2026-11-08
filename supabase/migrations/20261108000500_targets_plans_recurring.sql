-- nutrition_targets (versioned), training_plans, recurring_events.

-- --------------------------------------------------------- nutrition_targets
-- The target for date D is the row with the greatest effective_from <= D.
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  kcal integer not null check (kcal between 800 and 6000),
  protein_g integer not null check (protein_g between 0 and 500),
  carbs_g integer not null check (carbs_g between 0 and 1000),
  fat_g integer not null check (fat_g between 0 and 400),
  fibre_g integer check (fibre_g between 0 and 150),
  water_ml integer check (water_ml between 500 and 8000),
  bmr numeric(7, 2),
  tdee numeric(7, 2),
  floor_kcal integer,
  limited_by_floor boolean not null default false,
  is_user_edited boolean not null default false,
  calculation_version text not null,
  calculation_inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_targets_not_below_floor check (floor_kcal is null or kcal >= floor_kcal),
  constraint nutrition_targets_unique_day unique (user_id, effective_from)
);

create trigger nutrition_targets_set_updated_at
  before update on public.nutrition_targets
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ training_plans
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  goal_type text not null,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'archived')),
  generator_version text not null,
  generated_from jsonb not null default '{}'::jsonb,
  weekly_pattern jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_plans_dates check (end_date is null or end_date >= start_date)
);

create unique index training_plans_one_active on public.training_plans (user_id) where status = 'active';

create trigger training_plans_set_updated_at
  before update on public.training_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- recurring_events
create table public.recurring_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  training_plan_id uuid references public.training_plans (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  category text not null check (category in (
    'futsal_match', 'futsal_practice', 'football_match', 'football_practice',
    'workout', 'run', 'walk', 'cycle', 'other'
  )),
  template_slug text,
  weekday smallint not null check (weekday between 1 and 7),
  local_time time not null,
  timezone text not null,
  duration_minutes smallint not null check (duration_minutes between 5 and 300),
  intensity text not null check (intensity in ('easy', 'moderate', 'hard')),
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_events_dates check (ends_on is null or ends_on >= starts_on)
);

create index recurring_events_user_idx on public.recurring_events (user_id, active);

create trigger recurring_events_set_updated_at
  before update on public.recurring_events
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- RLS
alter table public.nutrition_targets enable row level security;
alter table public.training_plans enable row level security;
alter table public.recurring_events enable row level security;

revoke all on table public.nutrition_targets, public.training_plans, public.recurring_events
  from anon, authenticated;
grant select, insert, update on table public.nutrition_targets to authenticated;
grant select, insert, update, delete on table public.training_plans, public.recurring_events
  to authenticated;

create policy "nutrition_targets: select own" on public.nutrition_targets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "nutrition_targets: insert own" on public.nutrition_targets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "nutrition_targets: update own" on public.nutrition_targets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "training_plans: select own" on public.training_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "training_plans: insert own" on public.training_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "training_plans: update own" on public.training_plans
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "training_plans: delete own" on public.training_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "recurring_events: select own" on public.recurring_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recurring_events: insert own" on public.recurring_events
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      training_plan_id is null
      or exists (
        select 1 from public.training_plans p
        where p.id = training_plan_id and p.user_id = (select auth.uid())
      )
    )
  );
create policy "recurring_events: update own" on public.recurring_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      training_plan_id is null
      or exists (
        select 1 from public.training_plans p
        where p.id = training_plan_id and p.user_id = (select auth.uid())
      )
    )
  );
create policy "recurring_events: delete own" on public.recurring_events
  for delete to authenticated using ((select auth.uid()) = user_id);
