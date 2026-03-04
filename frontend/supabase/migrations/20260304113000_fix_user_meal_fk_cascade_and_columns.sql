create extension if not exists pgcrypto;

alter table if exists public.user_meal_weekly_day_plan
  add column if not exists day_name text null,
  add column if not exists day_theme text null,
  add column if not exists daily_budget text null,
  add column if not exists calorie_target integer null,
  add column if not exists protein integer null,
  add column if not exists carbs integer null,
  add column if not exists fats integer null,
  add column if not exists description text null;

create table if not exists public.user_meals_ingredients (
  created_at timestamp with time zone not null default now(),
  item_name text null,
  measurement text null,
  price text null,
  id uuid not null default gen_random_uuid(),
  constraint user_meals_ingredients_pkey primary key (id)
) tablespace pg_default;

create table if not exists public.user_meals (
  created_at timestamp with time zone not null default now(),
  ingredient_id uuid null default gen_random_uuid(),
  meal_name text null,
  id uuid not null default gen_random_uuid(),
  best_time_to_eat text null,
  meal_day_plan_id uuid null,
  constraint user_meals_pkey primary key (id)
) tablespace pg_default;

alter table if exists public.user_meals
  add column if not exists ingredient_id uuid null default gen_random_uuid(),
  add column if not exists meal_name text null,
  add column if not exists best_time_to_eat text null,
  add column if not exists meal_day_plan_id uuid null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'user_meal_weekly_plan_plan_id_fkey'
  ) then
    alter table public.user_meal_weekly_plan
      drop constraint user_meal_weekly_plan_plan_id_fkey;
  end if;

  alter table public.user_meal_weekly_plan
    add constraint user_meal_weekly_plan_plan_id_fkey
    foreign key (plan_id)
    references public.user_meal_plans (id)
    on delete cascade;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'user_meals_ingredient_id_fkey'
  ) then
    alter table public.user_meals
      drop constraint user_meals_ingredient_id_fkey;
  end if;

  alter table public.user_meals
    add constraint user_meals_ingredient_id_fkey
    foreign key (ingredient_id)
    references public.user_meals_ingredients (id)
    on delete cascade;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'user_meals_meal_day_plan_id_fkey'
  ) then
    alter table public.user_meals
      drop constraint user_meals_meal_day_plan_id_fkey;
  end if;

  alter table public.user_meals
    add constraint user_meals_meal_day_plan_id_fkey
    foreign key (meal_day_plan_id)
    references public.user_meal_weekly_day_plan (id)
    on delete cascade;
end $$;

create index if not exists idx_user_meals_ingredient_id
  on public.user_meals (ingredient_id);

create index if not exists idx_user_meals_meal_day_plan_id
  on public.user_meals (meal_day_plan_id);
