-- Phase 4: nutrition. Foods, food log, water, saved meals, recipes, meal plan, shopping list.
-- Design notes (docs/decisions.md, Phase 4):
-- * A logged item is a full nutrition snapshot; editing or deleting a food never changes history.
-- * The food log has no header table: a "meal" is the items for (local_date, meal_type).
-- * Saved meals and recipe ingredients are stored as jsonb snapshots in one row.

-- ------------------------------------------------------------------ foods
-- System rows (owner_id null) come from USDA FoodData Central (CC0) via a generated seed.
-- Users add their own foods (owner_id = user). Nutrition is per 100 g (or 100 ml).
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 100),
  barcode text,
  category text,
  basis text not null default 'per_100g' check (basis in ('per_100g', 'per_100ml')),
  kcal numeric(6, 1) check (kcal between 0 and 950),
  protein_g numeric(6, 2) check (protein_g between 0 and 100),
  carbs_g numeric(6, 2) check (carbs_g between 0 and 100),
  fat_g numeric(6, 2) check (fat_g between 0 and 100),
  fibre_g numeric(6, 2) check (fibre_g between 0 and 100),
  -- Named portions, e.g. [{"label":"1 large","grams":50}].
  portions jsonb not null default '[]'::jsonb,
  source text not null check (source in ('usda', 'off', 'user')),
  external_id text,
  nutritional_confidence text not null check (nutritional_confidence in ('reference', 'crowdsourced', 'user')),
  search tsvector generated always as (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, ''))) stored,
  archived_at timestamptz,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_external_unique unique (source, external_id),
  constraint foods_system_is_reference check (owner_id is not null or source <> 'user')
);

create index foods_search_idx on public.foods using gin (search);
create index foods_owner_idx on public.foods (owner_id) where owner_id is not null;
create index foods_barcode_idx on public.foods (barcode) where barcode is not null;

create trigger foods_set_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------- meal_log_items
create table public.meal_log_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at timestamptz not null default now(),
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid,
  name_snapshot text not null check (char_length(name_snapshot) between 1 and 200),
  quantity numeric(8, 2) check (quantity > 0),
  unit text,
  grams numeric(7, 1) check (grams > 0 and grams <= 5000),
  kcal numeric(7, 1) check (kcal >= 0 and kcal <= 10000),
  protein_g numeric(6, 1) check (protein_g >= 0),
  carbs_g numeric(6, 1) check (carbs_g >= 0),
  fat_g numeric(6, 1) check (fat_g >= 0),
  fibre_g numeric(6, 1) check (fibre_g >= 0),
  source_snapshot text,
  confidence_snapshot text,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_log_items_user_date_idx on public.meal_log_items (user_id, local_date);

create trigger meal_log_items_set_updated_at before update on public.meal_log_items
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------- water_logs
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  recorded_at timestamptz not null,
  local_date date not null,
  client_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create index water_logs_user_date_idx on public.water_logs (user_id, local_date);

-- ---------------------------------------------------------- day_log_status
create table public.day_log_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  nutrition_complete boolean not null default false,
  client_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create trigger day_log_status_set_updated_at before update on public.day_log_status
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- saved_meals
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  -- Snapshot items: [{name, quantity, unit, grams, kcal, protein_g, carbs_g, fat_g, fibre_g, food_id}]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  archived_at timestamptz,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger saved_meals_set_updated_at before update on public.saved_meals
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- recipes
-- source 'themealdb': cached by the recipes-proxy Edge Function (service role), readable by all
-- signed-in users, never has nutrition. source 'user': built from foods, nutrition calculated.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  source text not null check (source in ('themealdb', 'user')),
  external_id text,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  image_url text,
  category text,
  cuisine text,
  tags text[] not null default '{}',
  instructions text[] not null default '{}',
  -- [{name, raw_measure, quantity_min, quantity_max, unit, parse_status, food_id, grams}]
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  preparation_minutes smallint check (preparation_minutes between 0 and 1440),
  cooking_minutes smallint check (cooking_minutes between 0 and 1440),
  servings_stated smallint check (servings_stated between 1 and 50),
  source_url text,
  video_url text,
  nutritional_confidence text not null default 'none' check (nutritional_confidence in ('none', 'calculated')),
  kcal_per_serving numeric(7, 1),
  protein_per_serving numeric(6, 1),
  carbs_per_serving numeric(6, 1),
  fat_per_serving numeric(6, 1),
  fibre_per_serving numeric(6, 1),
  fetched_at timestamptz,
  archived_at timestamptz,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_external_unique unique (source, external_id),
  constraint recipes_ownership check ((source = 'user') = (owner_id is not null)),
  constraint recipes_no_invented_nutrition check (
    source = 'user' or (nutritional_confidence = 'none' and kcal_per_serving is null)
  )
);

create index recipes_owner_idx on public.recipes (owner_id) where owner_id is not null;
create index recipes_name_idx on public.recipes using gin (to_tsvector('simple', name));

create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ saved_recipes
create table public.saved_recipes (
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- How many servings the original recipe makes, when the source does not say (spec 12.3).
  base_servings smallint check (base_servings between 1 and 50),
  default_servings smallint check (default_servings between 1 and 50),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- -------------------------------------------------------- meal_plan_entries
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes (id) on delete set null,
  saved_meal_id uuid references public.saved_meals (id) on delete set null,
  custom_title text check (char_length(custom_title) <= 120),
  title_snapshot text not null,
  servings numeric(4, 1) not null default 1 check (servings > 0 and servings <= 20),
  status text not null default 'planned' check (status in ('planned', 'eaten', 'skipped')),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_plan_entries_user_date_idx on public.meal_plan_entries (user_id, local_date);

create trigger meal_plan_entries_set_updated_at before update on public.meal_plan_entries
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ shopping lists
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  range_start date,
  range_end date,
  status text not null default 'active' check (status in ('active', 'archived')),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shopping_lists_set_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shopping_list_id uuid not null references public.shopping_lists (id) on delete cascade,
  ingredient_name text not null check (char_length(ingredient_name) between 1 and 200),
  quantity_min numeric(10, 2),
  quantity_max numeric(10, 2),
  unit text,
  raw_text text,
  source_recipes text[] not null default '{}',
  is_checked boolean not null default false,
  is_manual boolean not null default false,
  sort_index integer not null default 0,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_list_items_list_idx on public.shopping_list_items (shopping_list_id);

create trigger shopping_list_items_set_updated_at before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- RLS
alter table public.foods enable row level security;
alter table public.meal_log_items enable row level security;
alter table public.water_logs enable row level security;
alter table public.day_log_status enable row level security;
alter table public.saved_meals enable row level security;
alter table public.recipes enable row level security;
alter table public.saved_recipes enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

revoke all on table public.foods, public.meal_log_items, public.water_logs, public.day_log_status,
  public.saved_meals, public.recipes, public.saved_recipes, public.meal_plan_entries,
  public.shopping_lists, public.shopping_list_items from anon, authenticated;

-- Catalogue tables: read system + own rows; write own rows; archive instead of delete.
grant select, insert, update on table public.foods, public.recipes to authenticated;

create policy "foods: read system and own" on public.foods
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "foods: insert own" on public.foods
  for insert to authenticated with check (owner_id = (select auth.uid()) and source = 'user');
create policy "foods: update own" on public.foods
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and source = 'user');

create policy "recipes: read system and own" on public.recipes
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "recipes: insert own" on public.recipes
  for insert to authenticated with check (owner_id = (select auth.uid()) and source = 'user');
create policy "recipes: update own" on public.recipes
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and source = 'user');

-- User-owned tables: the standard four own-row policies.
grant select, insert, update, delete on table public.meal_log_items, public.water_logs,
  public.day_log_status, public.saved_meals, public.saved_recipes, public.meal_plan_entries,
  public.shopping_lists, public.shopping_list_items to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['meal_log_items', 'water_logs', 'day_log_status', 'saved_meals',
    'saved_recipes', 'meal_plan_entries', 'shopping_lists'] loop
    execute format('create policy "%1$s: select own" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: insert own" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: update own" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: delete own" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- Children must point at the caller's own parent rows.
create policy "shopping_list_items: select own" on public.shopping_list_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "shopping_list_items: insert own" on public.shopping_list_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.shopping_lists l where l.id = shopping_list_id and l.user_id = (select auth.uid()))
  );
create policy "shopping_list_items: update own" on public.shopping_list_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.shopping_lists l where l.id = shopping_list_id and l.user_id = (select auth.uid()))
  );
create policy "shopping_list_items: delete own" on public.shopping_list_items
  for delete to authenticated using ((select auth.uid()) = user_id);

