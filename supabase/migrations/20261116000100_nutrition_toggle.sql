-- Nutrition can be switched off (Settings → App features, or in onboarding). The app then hides
-- food, calorie targets and water; data is kept and targets keep being calculated, so switching
-- back on is instant.
alter table public.user_preferences
  add column nutrition_enabled boolean not null default true;

-- Onboarding saves the choice (absent in payloads from older app versions → on).
do $$
declare
  src text;
begin
  select pg_get_functiondef('public.complete_onboarding(jsonb)'::regprocedure) into src;
  if position('nutrition_enabled' in src) = 0 then
    src := replace(src,
      E'locale, sports\n  ) values (',
      E'locale, sports, nutrition_enabled\n  ) values (');
    src := replace(src,
      E'coalesce(array(select jsonb_array_elements_text(pr -> ''sports'')), ''{}'')\n  )',
      E'coalesce(array(select jsonb_array_elements_text(pr -> ''sports'')), ''{}''),\n    coalesce((pr ->> ''nutrition_enabled'')::boolean, true)\n  )');
    src := replace(src,
      E'sports = excluded.sports;',
      E'sports = excluded.sports,\n    nutrition_enabled = excluded.nutrition_enabled;');
    if position('pr ->> ''nutrition_enabled''' in src) = 0
       or position('nutrition_enabled = excluded.nutrition_enabled' in src) = 0 then
      raise exception 'complete_onboarding: preferences markers not found';
    end if;
    execute src;
  end if;
end $$;
