-- Nutrition removed from PACE (decisions 2026-11-18). The last app with nutrition is on the
-- branch archive/nutrition (tag nutrition-archive-2026-11); docs/NUTRITION_ARCHIVE.md explains
-- how to recreate these objects. This permanently deletes all nutrition data.

-- 1. Onboarding no longer receives calorie targets or food preferences.
create or replace function public.complete_onboarding(payload jsonb)
 returns void
language plpgsql
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  p jsonb := payload -> 'profile';
  g jsonb := payload -> 'goal';
  pr jsonb := coalesce(payload -> 'preferences', '{}'::jsonb);
  pl jsonb := payload -> 'plan';
  dob date;
  height numeric;
  start_w numeric;
  target_w numeric;
  plan_id uuid;
  has_health boolean;
  item jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p is null or g is null or pl is null then
    raise exception 'Incomplete onboarding payload' using errcode = '22023';
  end if;

  if exists (select 1 from public.profiles where id = uid and onboarding_completed_at is not null) then
    raise exception 'Onboarding already completed' using errcode = '23505';
  end if;

  -- Safety rules (spec section 3.1 / 7) --------------------------------------
  dob := (p ->> 'date_of_birth')::date;
  if dob is null or dob > (current_date - interval '18 years')::date then
    raise exception 'PACE is available to users aged 18 and over' using errcode = '22023';
  end if;

  height := (p ->> 'height_cm')::numeric;
  start_w := (g ->> 'starting_weight_kg')::numeric;
  target_w := (g ->> 'target_weight_kg')::numeric;

  if g ->> 'goal_type' = 'lose_weight' and target_w is not null
     and target_w / power(height / 100.0, 2) < 18.5 then
    raise exception 'Target weight is below a healthy BMI of 18.5' using errcode = '22023';
  end if;

  if coalesce((g ->> 'weekly_rate_pct')::numeric, 0) > 1.0 then
    raise exception 'Weekly rate above 1%% of body weight is not allowed' using errcode = '22023';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(coalesce(payload -> 'consents', '[]'::jsonb)) c
    where c ->> 'consent_type' = 'terms' and (c ->> 'granted')::boolean
  ) or not exists (
    select 1 from jsonb_array_elements(coalesce(payload -> 'consents', '[]'::jsonb)) c
    where c ->> 'consent_type' = 'privacy' and (c ->> 'granted')::boolean
  ) then
    raise exception 'Terms and privacy policy must be accepted' using errcode = '22023';
  end if;

  has_health := jsonb_array_length(coalesce(payload -> 'health_conditions', '[]'::jsonb)) > 0;
  if has_health and not exists (
    select 1 from jsonb_array_elements(coalesce(payload -> 'consents', '[]'::jsonb)) c
    where c ->> 'consent_type' = 'health_data' and (c ->> 'granted')::boolean
  ) then
    raise exception 'Health data requires explicit consent' using errcode = '22023';
  end if;

  -- Consents --------------------------------------------------------------
  insert into public.consents (user_id, consent_type, document_version, granted)
  select uid, c ->> 'consent_type', c ->> 'document_version', (c ->> 'granted')::boolean
  from jsonb_array_elements(coalesce(payload -> 'consents', '[]'::jsonb)) c;

  -- Profile ---------------------------------------------------------------
  perform set_config('pace.completing_onboarding', 'on', true);
  update public.profiles set
    display_name = p ->> 'display_name',
    date_of_birth = dob,
    calc_sex = p ->> 'calc_sex',
    height_cm = height,
    unit_system = coalesce(p ->> 'unit_system', 'metric'),
    timezone = coalesce(p ->> 'timezone', 'UTC'),
    activity_level = p ->> 'activity_level',
    average_daily_steps = (p ->> 'average_daily_steps')::integer,
    week_start = coalesce((p ->> 'week_start')::smallint, 1),
    onboarding_step = 'done',
    onboarding_completed_at = now()
  where id = uid;

  -- Goal ------------------------------------------------------------------
  update public.user_goals set status = 'abandoned', ended_at = current_date
  where user_id = uid and status = 'active';

  insert into public.user_goals (
    user_id, goal_type, focus_tags, starting_weight_kg, target_weight_kg,
    secondary_target_weight_kg, weekly_rate_pct, target_date
  ) values (
    uid,
    g ->> 'goal_type',
    coalesce(array(select jsonb_array_elements_text(g -> 'focus_tags')), '{}'),
    start_w,
    target_w,
    (g ->> 'secondary_target_weight_kg')::numeric,
    (g ->> 'weekly_rate_pct')::numeric,
    (g ->> 'target_date')::date
  );

  -- Preferences -----------------------------------------------------------
  insert into public.user_preferences (
    user_id, training_days_per_week, preferred_training_days, max_session_minutes,
    preferred_training_time, training_environment, locale, sports
  ) values (
    uid,
    (pr ->> 'training_days_per_week')::smallint,
    coalesce(array(select (jsonb_array_elements_text(pr -> 'preferred_training_days'))::smallint), '{}'),
    coalesce((pr ->> 'max_session_minutes')::smallint, 45),
    (pr ->> 'preferred_training_time')::time,
    pr ->> 'training_environment',
    coalesce(pr ->> 'locale', 'en'),
    coalesce(array(select jsonb_array_elements_text(pr -> 'sports')), '{}')
  )
  on conflict (user_id) do update set
    training_days_per_week = excluded.training_days_per_week,
    preferred_training_days = excluded.preferred_training_days,
    max_session_minutes = excluded.max_session_minutes,
    preferred_training_time = excluded.preferred_training_time,
    training_environment = excluded.training_environment,
    locale = excluded.locale,
    sports = excluded.sports;

  -- Equipment (replace) ---------------------------------------------------
  delete from public.user_equipment where user_id = uid;
  insert into public.user_equipment (user_id, equipment_type, custom_name, max_weight_kg)
  select uid, e ->> 'equipment_type', e ->> 'custom_name', (e ->> 'max_weight_kg')::numeric
  from jsonb_array_elements(coalesce(payload -> 'equipment', '[]'::jsonb)) e;

  -- Health conditions (client ids, idempotent) ----------------------------
  for item in select * from jsonb_array_elements(coalesce(payload -> 'health_conditions', '[]'::jsonb))
  loop
    insert into public.health_conditions (
      id, user_id, kind, body_area, side, description, status, pain_level, restriction_tags,
      professional_restrictions, professional_clearance, onset_date
    ) values (
      coalesce((item ->> 'id')::uuid, gen_random_uuid()),
      uid,
      item ->> 'kind',
      item ->> 'body_area',
      coalesce(item ->> 'side', 'na'),
      item ->> 'description',
      coalesce(item ->> 'status', 'active'),
      (item ->> 'pain_level')::smallint,
      coalesce(array(select jsonb_array_elements_text(item -> 'restriction_tags')), '{}'),
      item ->> 'professional_restrictions',
      coalesce((item ->> 'professional_clearance')::boolean, false),
      (item ->> 'onset_date')::date
    )
    on conflict (id) do nothing;
  end loop;

  -- Training plan + recurring commitments ---------------------------------
  update public.training_plans set status = 'archived', end_date = current_date
  where user_id = uid and status = 'active';

  insert into public.training_plans (
    user_id, name, goal_type, start_date, generator_version, generated_from, weekly_pattern
  ) values (
    uid,
    coalesce(pl ->> 'name', 'My plan'),
    g ->> 'goal_type',
    (pl ->> 'start_date')::date,
    pl ->> 'generator_version',
    coalesce(pl -> 'generated_from', '{}'::jsonb),
    coalesce(pl -> 'weekly_pattern', '[]'::jsonb)
  )
  returning id into plan_id;

  insert into public.recurring_events (
    user_id, training_plan_id, title, category, template_slug, weekday, local_time, timezone,
    duration_minutes, intensity, starts_on
  )
  select
    uid, plan_id, r ->> 'title', r ->> 'category', r ->> 'template_slug',
    (r ->> 'weekday')::smallint, (r ->> 'local_time')::time,
    coalesce(r ->> 'timezone', p ->> 'timezone', 'UTC'),
    (r ->> 'duration_minutes')::smallint, r ->> 'intensity', (pl ->> 'start_date')::date
  from jsonb_array_elements(coalesce(payload -> 'recurring_events', '[]'::jsonb)) r;
end;
$function$;

-- 2. Nutrition functions (their triggers go with the tables below).
drop function if exists public.accept_target_adjustment(uuid, jsonb);
drop function if exists public.search_foods(text, integer);

-- 3. Nutrition tables (children first; cascade removes policies, triggers and indexes).
drop table if exists
  public.shopping_list_items,
  public.shopping_lists,
  public.meal_plan_entries,
  public.saved_recipes,
  public.recipe_images,
  public.saved_meals,
  public.meal_log_items,
  public.water_logs,
  public.day_log_status,
  public.recipes,
  public.foods,
  public.target_adjustments,
  public.nutrition_targets
  cascade;

drop function if exists public.nutrition_targets_floor_guard();
drop function if exists public.target_adjustments_guard();
drop function if exists public.target_adjustments_insert_guard();
drop function if exists public.safety_sex_floor(text);

-- 4. Food preferences and the nutrition switch.
alter table public.user_preferences
  drop column if exists nutrition_enabled,
  drop column if exists diet_type,
  drop column if exists allergies,
  drop column if exists intolerances,
  drop column if exists disliked_foods,
  drop column if exists preferred_cuisines,
  drop column if exists meals_per_day,
  drop column if exists cooking_time_max_minutes,
  drop column if exists household_servings;

-- 5. The recipe-images bucket is emptied and deleted through the Storage API / dashboard
--    (Supabase does not allow deleting storage objects in SQL). It has no policies.
