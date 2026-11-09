-- Phase 6: recalibration audit (target_adjustments) and weekly report cache (spec 8.9, 16, 20.7).

-- ---------------------------------------------------------------- target_adjustments
-- One row per recalibration check. Proposals wait for the user; other outcomes are recorded as
-- 'no_change' so the next check knows when the last one ran and whether it was slow.
create table public.target_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  proposed_at timestamptz not null default now(),
  window_start date not null,
  window_end date not null,
  current_kcal integer not null check (current_kcal between 800 and 6000),
  proposed_kcal integer check (proposed_kcal between 800 and 6000),
  observed_tdee numeric(7, 1),
  actual_rate_kg_week numeric(5, 3),
  adherence numeric(4, 3) check (adherence between 0 and 1),
  -- increase_fast_loss | decrease_slow | on_track | low_adherence | recovery_hold | not_enough_data
  reason_code text not null check (reason_code in
    ('increase_fast_loss', 'decrease_slow', 'on_track', 'low_adherence', 'recovery_hold', 'not_enough_data')),
  -- The loss was under half the target rate (used for "this check and the previous check").
  slow boolean not null default false,
  status text not null check (status in ('proposed', 'accepted', 'rejected', 'superseded', 'no_change')),
  decided_at timestamptz,
  resulting_target_id uuid references public.nutrition_targets (id) on delete set null,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_adjustments_window check (window_end >= window_start),
  constraint target_adjustments_proposal_has_kcal check (
    (status in ('proposed', 'accepted', 'rejected', 'superseded')) = (proposed_kcal is not null)
  ),
  constraint target_adjustments_one_per_day unique (user_id, window_end)
);

create index target_adjustments_user_idx on public.target_adjustments (user_id, proposed_at desc);

create trigger target_adjustments_set_updated_at before update on public.target_adjustments
  for each row execute function public.set_updated_at();

-- Users may only reject (or supersede) a proposal. Accepting goes through accept_target_adjustment(),
-- which creates the new target in the same transaction. Inputs are an audit record and never change.
create function public.target_adjustments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.window_start <> old.window_start or new.window_end <> old.window_end
     or new.current_kcal <> old.current_kcal or new.proposed_kcal is distinct from old.proposed_kcal
     or new.inputs <> old.inputs or new.reason_code <> old.reason_code then
    raise exception 'target adjustment inputs are read-only' using errcode = '42501';
  end if;
  if new.status <> old.status then
    if old.status <> 'proposed' then
      raise exception 'only proposed adjustments can be decided' using errcode = '42501';
    end if;
    if new.status = 'accepted' and coalesce(current_setting('pace.accepting_adjustment', true), '') <> 'on' then
      raise exception 'accept through accept_target_adjustment()' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger target_adjustments_guard before update on public.target_adjustments
  for each row execute function public.target_adjustments_guard();

alter table public.target_adjustments enable row level security;
revoke all on table public.target_adjustments from anon, authenticated;
-- No delete: the audit trail is kept (it is removed with the account).
grant select, insert, update on table public.target_adjustments to authenticated;

create policy "target_adjustments: select own" on public.target_adjustments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "target_adjustments: insert own" on public.target_adjustments
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status in ('proposed', 'no_change'));
create policy "target_adjustments: update own" on public.target_adjustments
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Accepts a proposal: creates the new target version and marks the proposal, atomically.
-- The target values are computed by the app (same domain code as manual edits); the database checks
-- that they match the proposal, respect the floor, and that no change was accepted in the last 14 days.
create function public.accept_target_adjustment(p_adjustment_id uuid, p_target jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  adj public.target_adjustments%rowtype;
  new_target_id uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into adj from public.target_adjustments
    where id = p_adjustment_id and user_id = uid for update;
  if not found then
    raise exception 'adjustment not found' using errcode = 'P0002';
  end if;
  if adj.status <> 'proposed' then
    raise exception 'adjustment is %', adj.status using errcode = '22023';
  end if;
  if (p_target ->> 'kcal')::int is distinct from adj.proposed_kcal then
    raise exception 'target does not match the proposal' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.target_adjustments
    where user_id = uid and status = 'accepted' and decided_at > now() - interval '14 days'
  ) then
    raise exception 'a target change was accepted less than 14 days ago' using errcode = '22023';
  end if;

  insert into public.nutrition_targets (
    user_id, effective_from, kcal, protein_g, carbs_g, fat_g, fibre_g, water_ml, bmr, tdee,
    floor_kcal, limited_by_floor, is_user_edited, calculation_version, calculation_inputs
  ) values (
    uid,
    (p_target ->> 'effective_from')::date,
    (p_target ->> 'kcal')::int,
    (p_target ->> 'protein_g')::int,
    (p_target ->> 'carbs_g')::int,
    (p_target ->> 'fat_g')::int,
    (p_target ->> 'fibre_g')::int,
    (p_target ->> 'water_ml')::int,
    (p_target ->> 'bmr')::numeric,
    (p_target ->> 'tdee')::numeric,
    (p_target ->> 'floor_kcal')::int,
    coalesce((p_target ->> 'limited_by_floor')::boolean, false),
    false,
    coalesce(p_target ->> 'calculation_version', 'recalibration-1'),
    coalesce(p_target -> 'calculation_inputs', '{}'::jsonb) || jsonb_build_object('adjustment_id', adj.id)
  )
  on conflict (user_id, effective_from) do update set
    kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g,
    fat_g = excluded.fat_g, fibre_g = excluded.fibre_g, water_ml = excluded.water_ml,
    bmr = excluded.bmr, tdee = excluded.tdee, floor_kcal = excluded.floor_kcal,
    limited_by_floor = excluded.limited_by_floor, is_user_edited = false,
    calculation_version = excluded.calculation_version, calculation_inputs = excluded.calculation_inputs
  returning id into new_target_id;

  perform set_config('pace.accepting_adjustment', 'on', true);
  update public.target_adjustments
    set status = 'accepted', decided_at = now(), resulting_target_id = new_target_id
    where id = adj.id;
  perform set_config('pace.accepting_adjustment', '', true);

  -- Any other open proposal is now out of date.
  update public.target_adjustments set status = 'superseded', decided_at = now()
    where user_id = uid and status = 'proposed' and id <> adj.id;

  return new_target_id;
end;
$$;

revoke all on function public.accept_target_adjustment(uuid, jsonb) from public, anon;
grant execute on function public.accept_target_adjustment(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- weekly_reports
-- Snapshot of a finished local week (spec 16). The current week is computed live and not stored.
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reports_one_per_week unique (user_id, week_start),
  constraint weekly_reports_payload_object check (jsonb_typeof(payload) = 'object')
);

create trigger weekly_reports_set_updated_at before update on public.weekly_reports
  for each row execute function public.set_updated_at();

alter table public.weekly_reports enable row level security;
revoke all on table public.weekly_reports from anon, authenticated;
grant select, insert, update, delete on table public.weekly_reports to authenticated;

create policy "weekly_reports: select own" on public.weekly_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "weekly_reports: insert own" on public.weekly_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weekly_reports: update own" on public.weekly_reports
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weekly_reports: delete own" on public.weekly_reports
  for delete to authenticated using ((select auth.uid()) = user_id);
