-- complete_onboarding(payload): saves the whole onboarding result in ONE transaction.
-- SECURITY INVOKER: every statement runs under the caller's RLS policies.
-- The payload is validated by the app (zod) and again here for the safety-critical rules.

create or replace function public.complete_onboarding(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p jsonb := payload -> 'profile';
  g jsonb := payload -> 'goal';
  pr jsonb := coalesce(payload -> 'preferences', '{}'::jsonb);
  t jsonb := payload -> 'targets';
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

  if p is null or g is null or t is null or pl is null then
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
    user_id, diet_type, allergies, intolerances, disliked_foods, preferred_cuisines,
    meals_per_day, cooking_time_max_minutes, household_servings, training_days_per_week,
    preferred_training_days, max_session_minutes, preferred_training_time, training_environment,
    locale
  ) values (
    uid,
    pr ->> 'diet_type',
    coalesce(array(select jsonb_array_elements_text(pr -> 'allergies')), '{}'),
    coalesce(array(select jsonb_array_elements_text(pr -> 'intolerances')), '{}'),
    coalesce(array(select jsonb_array_elements_text(pr -> 'disliked_foods')), '{}'),
    coalesce(array(select jsonb_array_elements_text(pr -> 'preferred_cuisines')), '{}'),
    coalesce((pr ->> 'meals_per_day')::smallint, 3),
    (pr ->> 'cooking_time_max_minutes')::smallint,
    coalesce((pr ->> 'household_servings')::smallint, 1),
    (pr ->> 'training_days_per_week')::smallint,
    coalesce(array(select (jsonb_array_elements_text(pr -> 'preferred_training_days'))::smallint), '{}'),
    coalesce((pr ->> 'max_session_minutes')::smallint, 45),
    (pr ->> 'preferred_training_time')::time,
    pr ->> 'training_environment',
    coalesce(pr ->> 'locale', 'en')
  )
  on conflict (user_id) do update set
    diet_type = excluded.diet_type,
    allergies = excluded.allergies,
    intolerances = excluded.intolerances,
    disliked_foods = excluded.disliked_foods,
    preferred_cuisines = excluded.preferred_cuisines,
    meals_per_day = excluded.meals_per_day,
    cooking_time_max_minutes = excluded.cooking_time_max_minutes,
    household_servings = excluded.household_servings,
    training_days_per_week = excluded.training_days_per_week,
    preferred_training_days = excluded.preferred_training_days,
    max_session_minutes = excluded.max_session_minutes,
    preferred_training_time = excluded.preferred_training_time,
    training_environment = excluded.training_environment,
    locale = excluded.locale;

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

  -- Nutrition targets (version 1) -----------------------------------------
  insert into public.nutrition_targets (
    user_id, effective_from, kcal, protein_g, carbs_g, fat_g, fibre_g, water_ml, bmr, tdee,
    floor_kcal, limited_by_floor, is_user_edited, calculation_version, calculation_inputs
  ) values (
    uid,
    (t ->> 'effective_from')::date,
    (t ->> 'kcal')::integer,
    (t ->> 'protein_g')::integer,
    (t ->> 'carbs_g')::integer,
    (t ->> 'fat_g')::integer,
    (t ->> 'fibre_g')::integer,
    (t ->> 'water_ml')::integer,
    (t ->> 'bmr')::numeric,
    (t ->> 'tdee')::numeric,
    (t ->> 'floor_kcal')::integer,
    coalesce((t ->> 'limited_by_floor')::boolean, false),
    coalesce((t ->> 'is_user_edited')::boolean, false),
    t ->> 'calculation_version',
    coalesce(t -> 'calculation_inputs', '{}'::jsonb)
  )
  on conflict (user_id, effective_from) do update set
    kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g,
    fat_g = excluded.fat_g, fibre_g = excluded.fibre_g, water_ml = excluded.water_ml,
    bmr = excluded.bmr, tdee = excluded.tdee, floor_kcal = excluded.floor_kcal,
    limited_by_floor = excluded.limited_by_floor, is_user_edited = excluded.is_user_edited,
    calculation_version = excluded.calculation_version,
    calculation_inputs = excluded.calculation_inputs;

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
$$;

revoke all on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;

comment on function public.complete_onboarding(jsonb) is
  'Atomically stores the onboarding result for the calling user (RLS applies).';
