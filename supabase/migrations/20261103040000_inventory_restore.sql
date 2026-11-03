-- Restore retained inventory data only with an exact tombstone revision.
create or replace function public.restore_inventory_revision(
 p_household uuid,p_item text,p_expected uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_role text;v_revision uuid;v_deleted timestamptz;v_new uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_household is null or p_item is null or length(trim(p_item))=0 or p_expected is null then
  raise exception 'Invalid restore request';
 end if;
 select case when h.created_by=auth.uid() then 'owner' else
  (select m.role::text from public.household_members m where m.household_id=h.id and m.user_id=auth.uid() limit 1)
 end into v_role from public.households h where h.id=p_household;
 if v_role is null or v_role not in ('owner','editor') then raise exception 'Not authorized to edit household inventory';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_household::text||':'||p_item,0));
 select revision,deleted_at into v_revision,v_deleted from public.inventory_revisions
 where household_id=p_household and item_id=p_item;
 if v_revision is distinct from p_expected or v_deleted is null then
  raise exception 'Revision conflict' using errcode='HV001';
 end if;
 v_new:=gen_random_uuid();
 update public.inventory_revisions
 set revision=v_new,deleted_at=null,updated_at=now()
 where household_id=p_household and item_id=p_item;
 return v_new;
end;$$;
revoke all on function public.restore_inventory_revision(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.restore_inventory_revision(uuid,text,uuid) to authenticated;
