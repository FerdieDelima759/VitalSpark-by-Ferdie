-- Ensure new meal detail tables are accessible for authenticated users.
-- These policies scope week/day/meal rows to the owner of user_meal_plans.

grant select, insert, update, delete on table public.user_meal_weekly_plan to authenticated;
grant select, insert, update, delete on table public.user_meal_weekly_day_plan to authenticated;
grant select, insert, update, delete on table public.user_meals to authenticated;
grant select, insert, update, delete on table public.user_meals_ingredients to authenticated;

alter table public.user_meal_weekly_plan enable row level security;
alter table public.user_meal_weekly_day_plan enable row level security;
alter table public.user_meals enable row level security;
alter table public.user_meals_ingredients enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_meal_weekly_plan'
      and policyname = 'user_meal_weekly_plan_owner_all'
  ) then
    create policy user_meal_weekly_plan_owner_all
    on public.user_meal_weekly_plan
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.user_meal_plans p
        where p.id = user_meal_weekly_plan.plan_id
          and p.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.user_meal_plans p
        where p.id = user_meal_weekly_plan.plan_id
          and p.user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_meal_weekly_day_plan'
      and policyname = 'user_meal_weekly_day_plan_owner_all'
  ) then
    create policy user_meal_weekly_day_plan_owner_all
    on public.user_meal_weekly_day_plan
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.user_meal_weekly_plan wp
        join public.user_meal_plans p
          on p.id = wp.plan_id
        where wp.id = user_meal_weekly_day_plan.week_plan_id
          and p.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.user_meal_weekly_plan wp
        join public.user_meal_plans p
          on p.id = wp.plan_id
        where wp.id = user_meal_weekly_day_plan.week_plan_id
          and p.user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_meals'
      and policyname = 'user_meals_owner_all'
  ) then
    create policy user_meals_owner_all
    on public.user_meals
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.user_meal_weekly_day_plan d
        join public.user_meal_weekly_plan wp
          on wp.id = d.week_plan_id
        join public.user_meal_plans p
          on p.id = wp.plan_id
        where d.id = user_meals.meal_day_plan_id
          and p.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.user_meal_weekly_day_plan d
        join public.user_meal_weekly_plan wp
          on wp.id = d.week_plan_id
        join public.user_meal_plans p
          on p.id = wp.plan_id
        where d.id = user_meals.meal_day_plan_id
          and p.user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_meals_ingredients'
      and policyname = 'user_meals_ingredients_auth_all'
  ) then
    create policy user_meals_ingredients_auth_all
    on public.user_meals_ingredients
    for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;
