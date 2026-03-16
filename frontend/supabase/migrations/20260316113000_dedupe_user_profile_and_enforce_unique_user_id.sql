-- Ensure one profile row per auth user.
-- 1) Keep the most recently updated profile for each user_id.
-- 2) Enforce uniqueness on user_profile.user_id for future writes/upserts.

delete from public.user_profile up
using (
  select ctid
  from (
    select
      ctid,
      row_number() over (
        partition by user_id
        order by updated_at desc nulls last, created_at desc nulls last, id desc
      ) as rn
    from public.user_profile
    where user_id is not null
  ) ranked
  where ranked.rn > 1
) duplicates
where up.ctid = duplicates.ctid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profile_user_id_key'
      and conrelid = 'public.user_profile'::regclass
  ) then
    alter table public.user_profile
      add constraint user_profile_user_id_key unique (user_id);
  end if;
end $$;
