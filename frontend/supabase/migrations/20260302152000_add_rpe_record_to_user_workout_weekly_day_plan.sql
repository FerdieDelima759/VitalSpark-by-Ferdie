alter table public.user_workout_weekly_day_plan
add column if not exists rpe_record smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_workout_weekly_day_plan_rpe_record_check'
  ) then
    alter table public.user_workout_weekly_day_plan
    add constraint user_workout_weekly_day_plan_rpe_record_check
    check (rpe_record is null or (rpe_record between 1 and 10));
  end if;
end $$;
