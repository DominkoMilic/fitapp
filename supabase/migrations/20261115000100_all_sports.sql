-- All-sport support: PACE is no longer football/futsal only. Any sport from the app's sports
-- catalogue (src/domain/sports/catalogue.ts), several sports, or none at all.
-- Sport events are stored as '<sport>_<type>' categories (e.g. 'basketball_match'), so existing
-- 'futsal_match' / 'football_practice' rows stay valid unchanged.

-- ---------------------------------------------------------------- sports the user plays
alter table public.user_preferences
  add column sports text[] not null default '{}'
  constraint user_preferences_sports_check check (
    cardinality(sports) <= 8
    and array_to_string(sports, ',') ~ '^([a-z_]{2,30}(,|$))*$'
  );

-- ---------------------------------------------------------------- recurring sport events
alter table public.recurring_events drop constraint recurring_events_category_check;
alter table public.recurring_events add constraint recurring_events_category_check check (
  category in ('workout', 'run', 'walk', 'cycle', 'other')
  or category ~ '^[a-z_]{2,30}_(match|practice)$'
);

-- ---------------------------------------------------------------- focus tags: 'futsal' → 'sport'
-- Backfill the sports list for people who chose "Football / futsal": take the sports from their
-- recurring events; with none, assume football (the old option's first word).
update public.user_preferences p set sports = coalesce((
  select array_agg(distinct regexp_replace(e.category, '_(match|practice)$', ''))
  from public.recurring_events e
  where e.user_id = p.user_id and e.category ~ '^[a-z_]+_(match|practice)$'
), array['football'])
where exists (
  select 1 from public.user_goals g
  where g.user_id = p.user_id and g.status = 'active' and 'futsal' = any (g.focus_tags)
);

alter table public.user_goals drop constraint user_goals_focus_tags_check;
update public.user_goals set focus_tags = array_replace(focus_tags, 'futsal', 'sport')
where 'futsal' = any (focus_tags);
alter table public.user_goals add constraint user_goals_focus_tags_check
  check (focus_tags <@ array['strength', 'sport', 'running', 'cardio', 'mobility']::text[]);

-- App versions released before this change still send 'futsal'; store it as 'sport'.
create function public.user_goals_legacy_focus()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.focus_tags := array_replace(new.focus_tags, 'futsal', 'sport');
  return new;
end;
$$;

create trigger user_goals_legacy_focus before insert or update of focus_tags on public.user_goals
  for each row execute function public.user_goals_legacy_focus();

-- ---------------------------------------------------------------- equipment for any sport
alter table public.user_equipment drop constraint user_equipment_equipment_type_check;
alter table public.user_equipment add constraint user_equipment_equipment_type_check check (equipment_type in (
  'dumbbells', 'kettlebell', 'resistance_bands', 'barbell', 'bench', 'exercise_mat', 'pull_up_bar',
  'treadmill', 'exercise_bike', 'jump_rope', 'football', 'ball', 'racket', 'stick', 'cones', 'none', 'custom'
));

-- ---------------------------------------------------------------- sport drills
alter table public.exercises drop constraint exercises_category_check;
alter table public.exercises add constraint exercises_category_check check (category in (
  'strength', 'core', 'mobility', 'conditioning', 'cardio', 'football', 'sport_skills', 'recovery'
));
-- Which sports a drill belongs to (empty = everyone).
alter table public.exercises
  add column sports text[] not null default '{}'
  constraint exercises_sports_check check (
    cardinality(sports) <= 20 and array_to_string(sports, ',') ~ '^([a-z_]{2,30}(,|$))*$'
  );

-- ---------------------------------------------------------------- onboarding saves the sports
do $$
declare
  src text;
begin
  select pg_get_functiondef('public.complete_onboarding(jsonb)'::regprocedure) into src;
  if position('pr -> ''sports''' in src) = 0 then
    src := replace(src,
      E'training_environment,\n    locale\n  ) values (',
      E'training_environment,\n    locale, sports\n  ) values (');
    src := replace(src,
      E'coalesce(pr ->> ''locale'', ''en'')\n  )',
      E'coalesce(pr ->> ''locale'', ''en''),\n    coalesce(array(select jsonb_array_elements_text(pr -> ''sports'')), ''{}'')\n  )');
    src := replace(src,
      E'locale = excluded.locale;',
      E'locale = excluded.locale,\n    sports = excluded.sports;');
    if position('pr -> ''sports''' in src) = 0 or position('sports = excluded.sports' in src) = 0 then
      raise exception 'complete_onboarding: preferences markers not found';
    end if;
    execute src;
  end if;
end $$;
