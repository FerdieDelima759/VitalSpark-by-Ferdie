alter table public.user_workout_weekly_day_plan
add column if not exists is_completed boolean not null default false;

alter table public.user_workout_weekly_plan
add column if not exists status text not null default 'Not Started';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_workout_weekly_plan_status_check'
  ) then
    alter table public.user_workout_weekly_plan
    add constraint user_workout_weekly_plan_status_check
    check (status in ('Not Started', 'In Progress', 'Completed'));
  end if;
end $$;

alter table public.user_workout_plans
add column if not exists is_finished boolean not null default false;

alter table public.user_workout_sessions
add column if not exists day_plan_id uuid null references public.user_workout_weekly_day_plan(id) on delete set null;

create index if not exists idx_user_workout_sessions_day_plan_id
on public.user_workout_sessions(day_plan_id);

create index if not exists idx_user_workout_sessions_day_plan_ended_at
on public.user_workout_sessions(day_plan_id, ended_at);

-- Backfill session->day linkage when all session exercises map to one day plan.
update public.user_workout_sessions as s
set day_plan_id = mapped.weekly_plan_id
from (
  select
    se.session_id,
    min(pe.weekly_plan_id) as weekly_plan_id,
    count(distinct pe.weekly_plan_id) as day_plan_count
  from public.user_workout_session_exercises as se
  inner join public.user_workout_plan_exercises as pe
    on pe.id = se.plan_id
  group by se.session_id
) as mapped
where s.id = mapped.session_id
  and s.day_plan_id is null
  and mapped.day_plan_count = 1;

create or replace function public.recompute_user_workout_plan_finished_status(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_weeks integer := 0;
  v_completed_weeks integer := 0;
  v_has_zero_remaining_days boolean := false;
  v_is_finished boolean := false;
begin
  if p_plan_id is null then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where wp.status = 'Completed')::integer,
    coalesce(bool_or(wp.remaining_days = 0), false)
  into
    v_total_weeks,
    v_completed_weeks,
    v_has_zero_remaining_days
  from public.user_workout_weekly_plan as wp
  where wp.plan_id = p_plan_id;

  v_is_finished :=
    v_total_weeks > 0
    and v_completed_weeks = v_total_weeks
    and v_has_zero_remaining_days;

  update public.user_workout_plans
  set is_finished = v_is_finished
  where id = p_plan_id
    and is_finished is distinct from v_is_finished;
end;
$$;

create or replace function public.recompute_user_workout_week_status(p_week_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_days integer := 0;
  v_completed_days integer := 0;
  v_status text := 'Not Started';
  v_plan_id uuid;
begin
  if p_week_plan_id is null then
    return;
  end if;

  select wp.plan_id
  into v_plan_id
  from public.user_workout_weekly_plan as wp
  where wp.id = p_week_plan_id;

  if v_plan_id is null then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where coalesce(wdp.is_completed, false))::integer
  into
    v_total_days,
    v_completed_days
  from public.user_workout_weekly_day_plan as wdp
  where wdp.week_plan_id = p_week_plan_id;

  if v_total_days = 0 or v_completed_days = 0 then
    v_status := 'Not Started';
  elsif v_completed_days = v_total_days then
    v_status := 'Completed';
  else
    v_status := 'In Progress';
  end if;

  update public.user_workout_weekly_plan
  set status = v_status
  where id = p_week_plan_id
    and status is distinct from v_status;

  perform public.recompute_user_workout_plan_finished_status(v_plan_id);
end;
$$;

create or replace function public.recompute_user_workout_day_completion(p_day_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_completed boolean := false;
  v_week_plan_id uuid;
begin
  if p_day_plan_id is null then
    return;
  end if;

  select wdp.week_plan_id
  into v_week_plan_id
  from public.user_workout_weekly_day_plan as wdp
  where wdp.id = p_day_plan_id;

  if v_week_plan_id is null then
    return;
  end if;

  select exists (
    select 1
    from public.user_workout_sessions as s
    where s.day_plan_id = p_day_plan_id
      and s.ended_at is not null
  )
  into v_is_completed;

  update public.user_workout_weekly_day_plan
  set is_completed = v_is_completed
  where id = p_day_plan_id
    and is_completed is distinct from v_is_completed;

  perform public.recompute_user_workout_week_status(v_week_plan_id);
end;
$$;

-- Backfill day completion from completed sessions.
update public.user_workout_weekly_day_plan as wdp
set is_completed = exists (
  select 1
  from public.user_workout_sessions as s
  where s.day_plan_id = wdp.id
    and s.ended_at is not null
)
where wdp.is_completed is distinct from exists (
  select 1
  from public.user_workout_sessions as s
  where s.day_plan_id = wdp.id
    and s.ended_at is not null
);

-- Backfill weekly status from day completion.
update public.user_workout_weekly_plan as wp
set status = day_stats.next_status
from (
  select
    wp2.id as week_plan_id,
    case
      when count(wdp.id) = 0 then 'Not Started'
      when count(wdp.id) filter (where coalesce(wdp.is_completed, false)) = 0 then 'Not Started'
      when count(wdp.id) filter (where coalesce(wdp.is_completed, false)) = count(wdp.id) then 'Completed'
      else 'In Progress'
    end as next_status
  from public.user_workout_weekly_plan as wp2
  left join public.user_workout_weekly_day_plan as wdp
    on wdp.week_plan_id = wp2.id
  group by wp2.id
) as day_stats
where wp.id = day_stats.week_plan_id
  and wp.status is distinct from day_stats.next_status;

-- Backfill plan is_finished from weekly status and remaining days.
update public.user_workout_plans as p
set is_finished = plan_stats.next_is_finished
from (
  select
    p2.id as plan_id,
    (
      count(wp.id) > 0
      and count(wp.id) filter (where wp.status = 'Completed') = count(wp.id)
      and coalesce(bool_or(wp.remaining_days = 0), false)
    ) as next_is_finished
  from public.user_workout_plans as p2
  left join public.user_workout_weekly_plan as wp
    on wp.plan_id = p2.id
  group by p2.id
) as plan_stats
where p.id = plan_stats.plan_id
  and p.is_finished is distinct from plan_stats.next_is_finished;

create or replace function public.trg_user_workout_sessions_recompute_day_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_day_plan_id uuid;
  v_old_day_plan_id uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_day_plan_id := new.day_plan_id;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old_day_plan_id := old.day_plan_id;
  end if;

  if v_old_day_plan_id is not null and v_old_day_plan_id is distinct from v_new_day_plan_id then
    perform public.recompute_user_workout_day_completion(v_old_day_plan_id);
  end if;

  if v_new_day_plan_id is not null then
    perform public.recompute_user_workout_day_completion(v_new_day_plan_id);
  end if;

  return null;
end;
$$;

create or replace function public.trg_user_workout_weekly_day_plan_recompute_week_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_week_plan_id uuid;
  v_old_week_plan_id uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_week_plan_id := new.week_plan_id;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old_week_plan_id := old.week_plan_id;
  end if;

  if v_old_week_plan_id is not null and v_old_week_plan_id is distinct from v_new_week_plan_id then
    perform public.recompute_user_workout_week_status(v_old_week_plan_id);
  end if;

  if v_new_week_plan_id is not null then
    perform public.recompute_user_workout_week_status(v_new_week_plan_id);
  end if;

  return null;
end;
$$;

create or replace function public.trg_user_workout_weekly_plan_recompute_plan_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_plan_id uuid;
  v_old_plan_id uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_plan_id := new.plan_id;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old_plan_id := old.plan_id;
  end if;

  if v_old_plan_id is not null and v_old_plan_id is distinct from v_new_plan_id then
    perform public.recompute_user_workout_plan_finished_status(v_old_plan_id);
  end if;

  if v_new_plan_id is not null then
    perform public.recompute_user_workout_plan_finished_status(v_new_plan_id);
  end if;

  return null;
end;
$$;

drop trigger if exists trg_user_workout_sessions_recompute_day_completion
on public.user_workout_sessions;

create trigger trg_user_workout_sessions_recompute_day_completion
after insert or update of ended_at, day_plan_id or delete
on public.user_workout_sessions
for each row
execute function public.trg_user_workout_sessions_recompute_day_completion();

drop trigger if exists trg_user_workout_weekly_day_plan_recompute_week_status
on public.user_workout_weekly_day_plan;

create trigger trg_user_workout_weekly_day_plan_recompute_week_status
after insert or update of is_completed, week_plan_id or delete
on public.user_workout_weekly_day_plan
for each row
execute function public.trg_user_workout_weekly_day_plan_recompute_week_status();

drop trigger if exists trg_user_workout_weekly_plan_recompute_plan_finished
on public.user_workout_weekly_plan;

create trigger trg_user_workout_weekly_plan_recompute_plan_finished
after insert or update of status, remaining_days, plan_id or delete
on public.user_workout_weekly_plan
for each row
execute function public.trg_user_workout_weekly_plan_recompute_plan_finished();
