-- user_goals, user_preferences, user_equipment, consents.

-- ---------------------------------------------------------------- user_goals
create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type text not null
    check (goal_type in ('lose_weight', 'maintain', 'build_muscle', 'general_fitness')),
  focus_tags text[] not null default '{}'
    check (focus_tags <@ array['strength', 'futsal', 'running', 'cardio', 'mobility']::text[]),
  starting_weight_kg numeric(5, 2) not null check (starting_weight_kg between 30 and 350),
  target_weight_kg numeric(5, 2) check (target_weight_kg between 30 and 350),
  secondary_target_weight_kg numeric(5, 2) check (secondary_target_weight_kg between 30 and 350),
  weekly_rate_pct numeric(4, 2) check (weekly_rate_pct between 0 and 1.0),
  target_date date,
  status text not null default 'active'
    check (status in ('active', 'achieved', 'paused', 'abandoned')),
  started_at date not null default current_date,
  ended_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_goals_lose_target_below_start check (
    goal_type <> 'lose_weight' or (target_weight_kg is not null and target_weight_kg < starting_weight_kg)
  ),
  constraint user_goals_build_target_above_start check (
    goal_type <> 'build_muscle' or (target_weight_kg is not null and target_weight_kg > starting_weight_kg)
  )
);

create unique index user_goals_one_active on public.user_goals (user_id) where status = 'active';
create index user_goals_user_idx on public.user_goals (user_id, started_at desc);

create trigger user_goals_set_updated_at
  before update on public.user_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- user_preferences
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  diet_type text check (diet_type in ('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'other')),
  allergies text[] not null default '{}',
  intolerances text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  preferred_cuisines text[] not null default '{}',
  meals_per_day smallint not null default 3 check (meals_per_day between 2 and 6),
  cooking_time_max_minutes smallint check (cooking_time_max_minutes in (15, 30, 60)),
  household_servings smallint not null default 1 check (household_servings between 1 and 8),
  training_days_per_week smallint check (training_days_per_week between 0 and 7),
  preferred_training_days smallint[] not null default '{}'
    check (preferred_training_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  max_session_minutes smallint not null default 45 check (max_session_minutes between 15 and 120),
  preferred_training_time time,
  training_environment text check (training_environment in ('home', 'gym', 'outdoors', 'mixed')),
  notification_preferences jsonb not null default '{}'::jsonb,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ user_equipment
create table public.user_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  equipment_type text not null check (equipment_type in (
    'dumbbells', 'kettlebell', 'resistance_bands', 'barbell', 'bench', 'exercise_mat',
    'pull_up_bar', 'treadmill', 'exercise_bike', 'jump_rope', 'football', 'cones', 'none', 'custom'
  )),
  custom_name text check (char_length(custom_name) between 1 and 60),
  max_weight_kg numeric(5, 1) check (max_weight_kg between 0.5 and 200),
  created_at timestamptz not null default now(),
  constraint user_equipment_custom_named check (equipment_type <> 'custom' or custom_name is not null)
);

create unique index user_equipment_unique
  on public.user_equipment (user_id, equipment_type, coalesce(custom_name, ''));

-- ------------------------------------------------------------------ consents
-- Append-only log: revoking consent inserts a new row with granted = false.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null check (consent_type in (
    'terms', 'privacy', 'health_data', 'location', 'background_location', 'notifications'
  )),
  document_version text not null,
  granted boolean not null,
  recorded_at timestamptz not null default now()
);

create index consents_user_type_idx on public.consents (user_id, consent_type, recorded_at desc);

-- ------------------------------------------------------------------- RLS
alter table public.user_goals enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_equipment enable row level security;
alter table public.consents enable row level security;

revoke all on table public.user_goals, public.user_preferences, public.user_equipment,
  public.consents from anon, authenticated;
grant select, insert, update, delete on table public.user_goals, public.user_preferences,
  public.user_equipment to authenticated;
grant select, insert on table public.consents to authenticated;

create policy "user_goals: select own" on public.user_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_goals: insert own" on public.user_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_goals: update own" on public.user_goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_goals: delete own" on public.user_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "user_preferences: select own" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_preferences: insert own" on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_preferences: update own" on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_preferences: delete own" on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "user_equipment: select own" on public.user_equipment
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_equipment: insert own" on public.user_equipment
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_equipment: update own" on public.user_equipment
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_equipment: delete own" on public.user_equipment
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "consents: select own" on public.consents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "consents: insert own" on public.consents
  for insert to authenticated with check ((select auth.uid()) = user_id);
