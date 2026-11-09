-- Audit fix: the safety rules (spec 3.1, 7, 8.5, 8.9) were only enforced by the app and by
-- complete_onboarding(). A signed-in user writing to the API directly could bypass them.
-- These triggers enforce them for every write made with a user's session (role "authenticated").
-- Server-side writes (service role, migrations, admin) are trusted and not restricted here.

create or replace function public.is_user_request()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'authenticated'
$$;

-- A user writing their own row (rows of other users are rejected by RLS, which reports them).
create or replace function public.is_own_user_request(owner uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_user_request() and owner = auth.uid()
$$;

-- Minimum calorie target by metabolic equation (spec 8.5). Keep in sync with
-- src/constants/safety.ts SEX_FLOOR_KCAL (a unit test checks this file). Unknown sex → the higher floor.
create or replace function public.safety_sex_floor(sex text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case sex when 'female' then 1200 else 1500 end
$$;

-- ------------------------------------------------------------------ profiles
-- onboarding_completed_at is set only by complete_onboarding(); age ≥ 18; calc_sex can't be cleared.
create or replace function public.profiles_safety_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_own_user_request(new.id) then
    return new;
  end if;
  if new.onboarding_completed_at is distinct from old.onboarding_completed_at
     and coalesce(current_setting('pace.completing_onboarding', true), '') <> 'on' then
    raise exception 'onboarding is completed through complete_onboarding()' using errcode = '42501';
  end if;
  if new.date_of_birth is distinct from old.date_of_birth
     and (new.date_of_birth is null or new.date_of_birth > (current_date - interval '18 years')::date) then
    raise exception 'PACE is available to users aged 18 and over' using errcode = '22023';
  end if;
  if old.calc_sex is not null and new.calc_sex is null then
    raise exception 'calc_sex cannot be cleared' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_safety_guard before update on public.profiles
  for each row execute function public.profiles_safety_guard();

-- complete_onboarding() is the one place allowed to set onboarding_completed_at.
create or replace function public.complete_onboarding_flag()
returns void
language sql
set search_path = ''
as $$
  select set_config('pace.completing_onboarding', 'on', true)::text, null::void
$$;

-- Re-create complete_onboarding with the flag set before its profile update (body otherwise unchanged).
do $$
declare
  src text;
begin
  select pg_get_functiondef('public.complete_onboarding(jsonb)'::regprocedure) into src;
  if position('pace.completing_onboarding' in src) = 0 then
    src := replace(
      src,
      '  -- Profile ---------------------------------------------------------------',
      E'  -- Profile ---------------------------------------------------------------\n  perform set_config(''pace.completing_onboarding'', ''on'', true);'
    );
    if position('pace.completing_onboarding' in src) = 0 then
      raise exception 'complete_onboarding: profile marker not found';
    end if;
    execute src;
  end if;
end $$;

drop function public.complete_onboarding_flag();

-- ------------------------------------------------------------------ user_goals
-- A weight-loss target must keep BMI ≥ 18.5 (spec 3.1); weekly rate ≤ 1 % is a CHECK already.
create or replace function public.user_goals_safety_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  h numeric;
begin
  if not public.is_own_user_request(new.user_id) or new.goal_type <> 'lose_weight' then
    return new;
  end if;
  select height_cm into h from public.profiles where id = new.user_id;
  if h is null then
    return new;
  end if;
  if (new.target_weight_kg is not null and new.target_weight_kg / power(h / 100.0, 2) < 18.5)
     or (new.secondary_target_weight_kg is not null
         and new.secondary_target_weight_kg / power(h / 100.0, 2) < 18.5) then
    raise exception 'Target weight is below a healthy BMI of 18.5' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger user_goals_safety_guard before insert or update on public.user_goals
  for each row execute function public.user_goals_safety_guard();

-- ------------------------------------------------------------------ health_conditions
-- Special-category data only with explicit, current consent (spec 19, GDPR Art. 9).
create or replace function public.health_conditions_consent_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_own_user_request(new.user_id) then
    return new;
  end if;
  if not coalesce((
    select granted from public.consents
    where user_id = new.user_id and consent_type = 'health_data'
    order by recorded_at desc, id desc
    limit 1
  ), false) then
    raise exception 'Health data requires explicit consent' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger health_conditions_consent_guard before insert or update on public.health_conditions
  for each row execute function public.health_conditions_consent_guard();

-- ------------------------------------------------------------------ nutrition_targets
-- The floor can't be lowered or removed by the client: it's at least the sex floor (spec 8.5).
create or replace function public.nutrition_targets_floor_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  sex_floor integer;
begin
  if not public.is_own_user_request(new.user_id) then
    return new;
  end if;
  select public.safety_sex_floor(calc_sex) into sex_floor from public.profiles where id = new.user_id;
  sex_floor := coalesce(sex_floor, public.safety_sex_floor(null));
  new.floor_kcal := greatest(coalesce(new.floor_kcal, 0), sex_floor);
  if new.kcal < new.floor_kcal then
    raise exception 'Calorie target below the safety minimum of % kcal', new.floor_kcal
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger nutrition_targets_floor_guard before insert or update on public.nutrition_targets
  for each row execute function public.nutrition_targets_floor_guard();

-- ------------------------------------------------------------------ target_adjustments
-- Proposals must follow the recalibration rules (spec 8.9) and match a real target; the decision
-- time is set by the server and can't be moved (it drives the 14-day limit).
create or replace function public.target_adjustments_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_own_user_request(new.user_id) then
    return new;
  end if;
  if not exists (
    select 1 from public.nutrition_targets
    where user_id = new.user_id and kcal = new.current_kcal
  ) then
    raise exception 'current_kcal does not match your target' using errcode = '22023';
  end if;
  if new.reason_code = 'increase_fast_loss' and new.proposed_kcal is distinct from new.current_kcal + 150 then
    raise exception 'an increase is +150 kcal' using errcode = '22023';
  end if;
  if new.reason_code = 'decrease_slow' and new.proposed_kcal is not null
     and (new.proposed_kcal >= new.current_kcal or new.proposed_kcal < new.current_kcal - 100) then
    raise exception 'a decrease is at most 100 kcal' using errcode = '22023';
  end if;
  if new.reason_code not in ('increase_fast_loss', 'decrease_slow') and new.proposed_kcal is not null then
    raise exception 'only increase/decrease reviews propose a target' using errcode = '22023';
  end if;
  new.decided_at := null;
  new.resulting_target_id := null;
  new.proposed_at := now();
  return new;
end;
$$;

create trigger target_adjustments_insert_guard before insert on public.target_adjustments
  for each row execute function public.target_adjustments_insert_guard();

create or replace function public.target_adjustments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.window_start <> old.window_start or new.window_end <> old.window_end
     or new.current_kcal <> old.current_kcal or new.proposed_kcal is distinct from old.proposed_kcal
     or new.inputs <> old.inputs or new.reason_code <> old.reason_code
     or new.proposed_at <> old.proposed_at then
    raise exception 'target adjustment inputs are read-only' using errcode = '42501';
  end if;
  if old.decided_at is not null and new.decided_at is distinct from old.decided_at then
    raise exception 'a decision time cannot be changed' using errcode = '42501';
  end if;
  if new.status <> old.status then
    if old.status <> 'proposed' then
      raise exception 'only proposed adjustments can be decided' using errcode = '42501';
    end if;
    if new.status = 'accepted' and coalesce(current_setting('pace.accepting_adjustment', true), '') <> 'on' then
      raise exception 'accept through accept_target_adjustment()' using errcode = '42501';
    end if;
    new.decided_at := now();
  elsif new.decided_at is distinct from old.decided_at then
    raise exception 'decided_at is set by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------ consents
-- The record time is the server's, so consent history can't be backdated.
revoke insert on table public.consents from authenticated;
grant insert (id, user_id, consent_type, document_version, granted) on table public.consents to authenticated;
