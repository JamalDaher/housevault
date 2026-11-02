-- Inventory sync phase 1: server-side revision-checked record writes.
-- No client direct write policies. No browser integration yet.
create function public.put_inventory_record(
 target_household uuid,target_item text,target_payload jsonb,expected_revision bigint
) returns bigint language plpgsql security definer set search_path=''
as $$
declare next_revision bigint; actor uuid;
begin
 actor:=auth.uid();
 if actor is null or public.household_role(target_household) not in ('owner','editor') then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 if target_item is null or length(target_item) not between 1 and 128
 or target_payload is null or jsonb_typeof(target_payload)<>'object'
 or target_payload->>'id' is distinct from target_item
 or length(target_payload::text)>262144
 or expected_revision is null or expected_revision<0 then
  raise exception 'Invalid inventory record' using errcode='22023';
 end if;
 -- Photos/documents require separate private Storage implementation; reject inline data.
 if target_payload::text like '%data:image/%' or target_payload::text like '%data:application/%'
 or target_payload::text like '%hv-asset:%' then
  raise exception 'Attachments are not yet supported by cloud sync' using errcode='22023';
 end if;
 if expected_revision=0 then
  insert into public.inventory_records(household_id,item_id,payload,revision,updated_by)
  values(target_household,target_item,target_payload,1,actor)
  on conflict do nothing returning revision into next_revision;
 else
  update public.inventory_records set payload=target_payload,revision=revision+1,
   updated_at=now(),updated_by=actor,deleted_at=null
  where household_id=target_household and item_id=target_item
   and revision=expected_revision and deleted_at is null
  returning revision into next_revision;
 end if;
 if next_revision is null then raise exception 'Inventory revision conflict' using errcode='40001'; end if;
 return next_revision;
end
$$;
create function public.delete_inventory_record(
 target_household uuid,target_item text,expected_revision bigint
) returns bigint language plpgsql security definer set search_path=''
as $$
declare next_revision bigint;
begin
 if auth.uid() is null or public.household_role(target_household) not in ('owner','editor') then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 if target_item is null or expected_revision is null or expected_revision<1 then
  raise exception 'Invalid delete request' using errcode='22023';
 end if;
 update public.inventory_records set deleted_at=now(),revision=revision+1,
  updated_at=now(),updated_by=auth.uid()
 where household_id=target_household and item_id=target_item
  and revision=expected_revision and deleted_at is null
 returning revision into next_revision;
 if next_revision is null then raise exception 'Inventory revision conflict' using errcode='40001'; end if;
 return next_revision;
end
$$;
revoke all on function public.put_inventory_record(uuid,text,jsonb,bigint) from public,anon;
revoke all on function public.delete_inventory_record(uuid,text,bigint) from public,anon;
grant execute on function public.put_inventory_record(uuid,text,jsonb,bigint) to authenticated;
grant execute on function public.delete_inventory_record(uuid,text,bigint) to authenticated;
