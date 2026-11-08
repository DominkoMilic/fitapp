-- profiles: one row per auth user, created automatically on sign-up.
-- Required fields stay nullable until onboarding completes (enforced by check constraint).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 50),
  date_of_birth date,
  calc_sex text check (calc_sex in ('male', 'female')),
  height_cm numeric(5, 1) check (height_cm between 120 and 230),
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'extra')),
  average_daily_steps integer check (average_daily_steps between 0 and 60000),
  week_start smallint not null default 1 check (week_start in (1, 7)),
  onboarding_step text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_complete_when_onboarded check (
    onboarding_completed_at is null
    or (
      display_name is not null
      and date_of_birth is not null
      and calc_sex is not null
      and height_cm is not null
      and activity_level is not null
    )
  ),
  -- The 18+ rule depends on the current date, so it is enforced in complete_onboarding()
  -- and in the app, not in a CHECK constraint (CHECKs must be immutable).
  constraint profiles_dob_range check (date_of_birth is null or date_of_birth >= date '1900-01-01')
);

comment on table public.profiles is 'User profile. Metric units only; conversion happens in the app.';
comment on column public.profiles.calc_sex is 'Sex used to select the Mifflin-St Jeor equation.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create an empty profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;

create policy "profiles: select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
-- No insert policy (rows come from the trigger) and no delete policy (rows cascade from auth.users).
