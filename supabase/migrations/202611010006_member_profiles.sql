-- Member directory scoped to households the caller belongs to.
-- Auth emails are returned only for fellow members of a shared household.
create function public.list_household_member_profiles()
returns table(household_id uuid,user_id uuid,role text,email text,display_name text)
language sql stable security definer set search_path=''
as $$
 select m.household_id,m.user_id,m.role,u.email,
        left(nullif(btrim(u.raw_user_meta_data->>'display_name'),''),80)
 from public.household_members m
 join auth.users u on u.id=m.user_id
 where exists(
  select 1 from public.household_members own
  where own.household_id=m.household_id and own.user_id=(select auth.uid())
 )
$$;
revoke all on function public.list_household_member_profiles() from public,anon;
grant execute on function public.list_household_member_profiles() to authenticated;
