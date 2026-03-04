create extension if not exists pgcrypto;

create table if not exists public.user_meals_ingredients (
  created_at timestamp with time zone not null default now(),
  item_name text null,
  measurement text null,
  price text null,
  id uuid not null default gen_random_uuid(),
  constraint user_meals_ingredients_pkey primary key (id)
) tablespace pg_default;

create table if not exists public.user_meal_weekly_plan (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  plan_id uuid null default gen_random_uuid(),
  week_number integer null,
  remaining_days integer null,
  constraint user_meal_weekly_plan_pkey primary key (id)
) tablespace pg_default;

alter table public.user_meal_weekly_plan
  add column if not exists plan_id uuid null default gen_random_uuid(),
  add column if not exists week_number integer null,
  add column if not exists remaining_days integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_meal_weekly_plan_plan_id_fkey'
  ) then
    alter table public.user_meal_weekly_plan
      add constraint user_meal_weekly_plan_plan_id_fkey
      foreign key (plan_id)
      references public.user_meal_plans (id)
      on delete cascade;
  end if;
end $$;

create table if not exists public.user_meal_weekly_day_plan (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  week_plan_id uuid null default gen_random_uuid(),
  day_name text null,
  day_theme text null,
  daily_budget text null,
  calorie_target integer null,
  protein integer null,
  carbs integer null,
  fats integer null,
  description text null,
  constraint user_meal_weekly_day_plan_pkey primary key (id)
) tablespace pg_default;

alter table public.user_meal_weekly_day_plan
  add column if not exists week_plan_id uuid null default gen_random_uuid(),
  add column if not exists day_name text null,
  add column if not exists day_theme text null,
  add column if not exists daily_budget text null,
  add column if not exists calorie_target integer null,
  add column if not exists protein integer null,
  add column if not exists carbs integer null,
  add column if not exists fats integer null,
  add column if not exists description text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_meal_weekly_day_plan_week_plan_id_fkey'
  ) then
    alter table public.user_meal_weekly_day_plan
      add constraint user_meal_weekly_day_plan_week_plan_id_fkey
      foreign key (week_plan_id)
      references public.user_meal_weekly_plan (id);
  end if;
end $$;

create table if not exists public.user_meals (
  created_at timestamp with time zone not null default now(),
  ingredient_id uuid null default gen_random_uuid(),
  meal_name text null,
  id uuid not null default gen_random_uuid(),
  best_time_to_eat text null,
  meal_day_plan_id uuid null,
  constraint user_meals_pkey primary key (id)
) tablespace pg_default;

alter table public.user_meals
  add column if not exists ingredient_id uuid null default gen_random_uuid(),
  add column if not exists meal_name text null,
  add column if not exists best_time_to_eat text null,
  add column if not exists meal_day_plan_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_meals_ingredient_id_fkey'
  ) then
    alter table public.user_meals
      add constraint user_meals_ingredient_id_fkey
      foreign key (ingredient_id)
      references public.user_meals_ingredients (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_meals_meal_day_plan_id_fkey'
  ) then
    alter table public.user_meals
      add constraint user_meals_meal_day_plan_id_fkey
      foreign key (meal_day_plan_id)
      references public.user_meal_weekly_day_plan (id);
  end if;
end $$;

create index if not exists idx_user_meal_weekly_plan_plan_id
  on public.user_meal_weekly_plan (plan_id);

create index if not exists idx_user_meal_weekly_day_plan_week_plan_id
  on public.user_meal_weekly_day_plan (week_plan_id);

create index if not exists idx_user_meals_meal_day_plan_id
  on public.user_meals (meal_day_plan_id);
