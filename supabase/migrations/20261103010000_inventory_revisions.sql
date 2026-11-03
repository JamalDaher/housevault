-- Opt-in, revision-guarded inventory storage. Does not migrate existing records.
create table if not exists public.inventory_revisions (
 household_id uuid not null references public.households(id) on delete cascade,
 item_id text not null,
 payload jsonb not null,
 revision uuid not null default gen_random_uuid(),
 updated_at timestamptz not null default now(),
 primary key (household_id,item_id),
 constraint item_id_nonempty check (length(trim(item_id))>0),
 constraint payload_is_object check (jsonb_typeof(payload)='object')
);
alter table public.inventory_revisions enable row level security;
revoke all on public.inventory_revisions from anon, authenticated;
grant select on public.inventory_revisions to authenticated;
create policy "read own household revisions" on public.inventory_revisions for select to authenticated
 using (
 exists(select 1 from public.households h where h.id=household_id and h.created_by=auth.uid())
 or exists(select 1 from public.household_members m where m.household_id=inventory_revisions.household_id and m.user_id=auth.uid())
 );
-- Writes only through a server-side atomic compare-and-swap RPC.
create or replace function public.write_inventory_revision(
 p_household uuid,p_item text,p_expected uuid,p_payload jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_role text;v_revision uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_item is null or length(trim(p_item))=0 or jsonb_typeof(p_payload) is distinct from 'object' then
  raise exception 'Invalid inventory record';
 end if;
 select case when h.created_by=auth.uid() then 'owner' else
  (select m.role::text from public.household_members m where m.household_id=h.id and m.user_id=auth.uid() limit 1)
 end into v_role from public.households h where h.id=p_household;
 if v_role is null or v_role not in ('owner','editor') then raise exception 'Not authorized to edit household inventory';end if;
 -- Serialize concurrent writers for the same household, including first creates.
 perform pg_advisory_xact_lock(hashtextextended(p_household::text||':'||p_item,0));
 select revision into v_revision from public.inventory_revisions where household_id=p_household and item_id=p_item;
 if v_revision is distinct from p_expected then raise exception 'Revision conflict' using errcode='40001';end if;
 v_revision:=gen_random_uuid();
 insert into public.inventory_revisions(household_id,item_id,payload,revision,updated_at)
 values(p_household,p_item,p_payload,v_revision,now())
 on conflict(household_id,item_id) do update
 set payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at;
 return v_revision;
end;$$;
revoke all on function public.write_inventory_revision(uuid,text,uuid,jsonb) from public;
grant execute on function public.write_inventory_revision(uuid,text,uuid,jsonb) to authenticated;
