-- Phase 3: exercise library, templates, scheduled workouts, workout sessions and sets.

-- ------------------------------------------------------------------ exercises
-- System rows (owner_id null) are seeded from src/domain/training/catalogue.ts with
-- deterministic ids. Users can add their own (owner_id = user). Custom exercises are archived,
-- never deleted, so workout history keeps its names (spec 28.5 #12).
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 1000),
  category text not null check (category in ('strength', 'core', 'mobility', 'conditioning', 'cardio', 'football', 'recovery')),
  muscle_groups text[] not null default '{}',
  equipment text[] not null default '{}',
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  tracking_type text not null check (tracking_type in ('reps', 'reps_weight', 'time')),
  is_unilateral boolean not null default false,
  instructions text[] not null default '{}',
  caution_notes text,
  contraindication_tags text[] not null default '{}',
  media_url text,
  default_sets smallint check (default_sets between 1 and 10),
  default_reps_min smallint check (default_reps_min between 1 and 100),
  default_reps_max smallint check (default_reps_max between 1 and 100),
  default_duration_s integer check (default_duration_s between 5 and 7200),
  met numeric(4, 1) check (met between 1 and 20),
  archived_at timestamptz,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_system_has_slug check (owner_id is not null or slug is not null)
);

create unique index exercises_system_slug on public.exercises (slug) where owner_id is null;
create index exercises_owner_idx on public.exercises (owner_id) where owner_id is not null;

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- workout templates
create table public.workout_templates (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  category text not null,
  intensity text not null check (intensity in ('easy', 'moderate', 'hard')),
  estimated_minutes smallint not null,
  short_version_slug text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_template_exercises (
  id uuid primary key,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  phase text not null check (phase in ('warmup', 'main', 'cooldown')),
  order_index smallint not null,
  sets smallint not null,
  reps_min smallint,
  reps_max smallint,
  duration_s integer,
  rest_s smallint not null default 60,
  alternative_exercise_id uuid references public.exercises (id),
  unique (template_id, order_index)
);

-- --------------------------------------------------------- scheduled_workouts
-- occurrence_key makes generation idempotent: 'plan:<plan id>:<date>' or 'event:<event id>:<date>'.
-- One-off workouts have no key. Generation inserts with ON CONFLICT DO NOTHING, so occurrences
-- the user completed, skipped or moved are never overwritten (spec 10.2, 28.5 #4).
create table public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurrence_key text,
  training_plan_id uuid references public.training_plans (id) on delete set null,
  recurring_event_id uuid references public.recurring_events (id) on delete set null,
  template_slug text,
  kind text not null check (kind in ('workout', 'recovery', 'rest', 'commitment')),
  title text not null check (char_length(title) between 1 and 80),
  category text not null,
  intensity text not null check (intensity in ('easy', 'moderate', 'hard', 'rest')),
  scheduled_date date not null,
  scheduled_time time,
  estimated_duration_minutes smallint check (estimated_duration_minutes between 0 and 300),
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped', 'cancelled')),
  is_user_modified boolean not null default false,
  notes text[] not null default '{}',
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_workouts_occurrence unique (user_id, occurrence_key)
);

create index scheduled_workouts_user_date_idx on public.scheduled_workouts (user_id, scheduled_date);

create trigger scheduled_workouts_set_updated_at
  before update on public.scheduled_workouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- workout_sessions
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_workout_id uuid references public.scheduled_workouts (id) on delete set null,
  template_slug text,
  title text not null check (char_length(title) between 1 and 80),
  category text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  local_date date not null,
  duration_seconds integer not null check (duration_seconds between 0 and 86400),
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  perceived_exertion numeric(3, 1) check (perceived_exertion between 0 and 10),
  feeling smallint check (feeling between 1 and 5),
  total_volume_kg numeric(9, 1) check (total_volume_kg >= 0),
  calories_estimated integer check (calories_estimated >= 0),
  completion_status text not null check (completion_status in ('completed', 'partial', 'abandoned')),
  source text not null default 'app' check (source in ('app', 'manual')),
  notes text check (char_length(notes) <= 1000),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_time_order check (ended_at >= started_at)
);

create index workout_sessions_user_time_idx on public.workout_sessions (user_id, started_at desc);

create trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- exercise_sets
create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid references public.exercises (id),
  exercise_name text not null,
  exercise_slug text,
  set_number smallint not null check (set_number between 1 and 50),
  repetitions smallint check (repetitions between 0 and 500),
  weight_kg numeric(6, 2) check (weight_kg between 0 and 500),
  duration_seconds integer check (duration_seconds between 0 and 7200),
  completed boolean not null default false,
  skipped boolean not null default false,
  pain_flag boolean not null default false,
  client_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create index exercise_sets_session_idx on public.exercise_sets (workout_session_id);
create index exercise_sets_user_exercise_idx on public.exercise_sets (user_id, exercise_slug);

-- ------------------------------------------------------------------- RLS
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_sets enable row level security;

revoke all on table public.exercises, public.workout_templates, public.workout_template_exercises,
  public.scheduled_workouts, public.workout_sessions, public.exercise_sets from anon, authenticated;
grant select, insert, update on table public.exercises to authenticated;
grant select on table public.workout_templates, public.workout_template_exercises to authenticated;
grant select, insert, update, delete on table public.scheduled_workouts, public.workout_sessions,
  public.exercise_sets to authenticated;

create policy "exercises: read system and own" on public.exercises
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "exercises: insert own" on public.exercises
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "exercises: update own" on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "workout_templates: read" on public.workout_templates
  for select to authenticated using (true);
create policy "workout_template_exercises: read" on public.workout_template_exercises
  for select to authenticated using (true);

create policy "scheduled_workouts: select own" on public.scheduled_workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "scheduled_workouts: insert own" on public.scheduled_workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "scheduled_workouts: update own" on public.scheduled_workouts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "scheduled_workouts: delete own" on public.scheduled_workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "workout_sessions: select own" on public.workout_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workout_sessions: insert own" on public.workout_sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (scheduled_workout_id is null or exists (
      select 1 from public.scheduled_workouts s where s.id = scheduled_workout_id and s.user_id = (select auth.uid())))
  );
create policy "workout_sessions: update own" on public.workout_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_sessions: delete own" on public.workout_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "exercise_sets: select own" on public.exercise_sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercise_sets: insert own" on public.exercise_sets
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workout_sessions w where w.id = workout_session_id and w.user_id = (select auth.uid()))
  );
create policy "exercise_sets: update own" on public.exercise_sets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workout_sessions w where w.id = workout_session_id and w.user_id = (select auth.uid()))
  );
create policy "exercise_sets: delete own" on public.exercise_sets
  for delete to authenticated using ((select auth.uid()) = user_id);
