create extension if not exists pgcrypto;

-- 1) Remove description from weekly day table (no longer needed)
alter table if exists public.user_meal_weekly_day_plan
  drop column if exists description;

-- 2) Extend user_meals for direct meal data storage
alter table if exists public.user_meals
  add column if not exists cooking_instructions text[] null,
  add column if not exists meal_time text null,
  add column if not exists est_cost double precision null;

-- 3) Remove ingredient_id from user_meals (use link table instead)
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'user_meals_ingredient_id_fkey'
  ) then
    alter table public.user_meals
      drop constraint user_meals_ingredient_id_fkey;
  end if;
end $$;

alter table if exists public.user_meals
  drop column if exists ingredient_id;

-- 4) Ensure meal_day_plan FK is ON DELETE CASCADE
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'user_meals_meal_day_plan_id_fkey'
  ) then
    alter table public.user_meals
      drop constraint user_meals_meal_day_plan_id_fkey;
  end if;

  alter table public.user_meals
    add constraint user_meals_meal_day_plan_id_fkey
    foreign key (meal_day_plan_id)
    references public.user_meal_weekly_day_plan(id)
    on delete cascade;
end $$;

-- 5) Create link table between meals and ingredients
create table if not exists public.user_meal_ingredients_link (
  id uuid not null default gen_random_uuid(),
  meal_id uuid null default gen_random_uuid(),
  ingredient_id uuid null default gen_random_uuid(),
  constraint user_meal_ingredients_link_pkey primary key (id)
) tablespace pg_default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_meal_ingredients_link_ingredient_id_fkey'
  ) then
    alter table public.user_meal_ingredients_link
      add constraint user_meal_ingredients_link_ingredient_id_fkey
      foreign key (ingredient_id)
      references public.user_meals_ingredients(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_meal_ingredients_link_meal_id_fkey'
  ) then
    alter table public.user_meal_ingredients_link
      add constraint user_meal_ingredients_link_meal_id_fkey
      foreign key (meal_id)
      references public.user_meals(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_user_meal_ingredients_link_meal_id
  on public.user_meal_ingredients_link(meal_id);

create index if not exists idx_user_meal_ingredients_link_ingredient_id
  on public.user_meal_ingredients_link(ingredient_id);

grant select, insert, update, delete on table public.user_meal_ingredients_link to authenticated;
alter table public.user_meal_ingredients_link enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_meal_ingredients_link'
      and policyname = 'user_meal_ingredients_link_owner_all'
  ) then
    create policy user_meal_ingredients_link_owner_all
    on public.user_meal_ingredients_link
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.user_meals m
        join public.user_meal_weekly_day_plan d
          on d.id = m.meal_day_plan_id
        join public.user_meal_weekly_plan wp
          on wp.id = d.week_plan_id
        join public.user_meal_plans p
          on p.id = wp.plan_id
        where m.id = user_meal_ingredients_link.meal_id
          and p.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.user_meals m
        join public.user_meal_weekly_day_plan d
          on d.id = m.meal_day_plan_id
        join public.user_meal_weekly_plan wp
          on wp.id = d.week_plan_id
        join public.user_meal_plans p
          on p.id = wp.plan_id
        where m.id = user_meal_ingredients_link.meal_id
          and p.user_id = auth.uid()
      )
    );
  end if;
end $$;
