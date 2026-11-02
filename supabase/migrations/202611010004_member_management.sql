-- Owner-only member management. Apply after 202611010003.
-- Client table writes remain revoked; all changes go through audited RPCs.
create function public.set_household_member_role(target_household uuid,target_user uuid,target_role text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or public.household_role(target_household) is distinct from 'owner' then
  raise exception 'Not authorized';
 end if;
 if target_role not in ('editor','viewer') or target_role is null then
  raise exception 'Invalid role';
 end if;
 update public.household_members
 set role=target_role
 where household_id=target_household and user_id=target_user and role<>'owner';
 if not found then raise exception 'Member not found or owner role cannot be changed'; end if;
end
$$;
create function public.remove_household_member(target_household uuid,target_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or public.household_role(target_household) is distinct from 'owner' then
  raise exception 'Not authorized';
 end if;
 delete from public.household_members
 where household_id=target_household and user_id=target_user and role<>'owner';
 if not found then raise exception 'Member not found or owner cannot be removed'; end if;
end
$$;
revoke all on function public.set_household_member_role(uuid,uuid,text) from public,anon;
revoke all on function public.remove_household_member(uuid,uuid) from public,anon;
grant execute on function public.set_household_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.remove_household_member(uuid,uuid) to authenticated;
