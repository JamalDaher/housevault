-- Household taxonomy: shared, owner/editor managed, viewer readable.
create table public.household_categories(
 household_id uuid not null references public.households(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 60 and name=btrim(name)),
 created_at timestamptz not null default now(),
 primary key(household_id,name)
);
create table public.household_locations(
 household_id uuid not null references public.households(id) on delete cascade,
 path text not null check(length(btrim(path)) between 1 and 240 and path=btrim(path)),
 created_at timestamptz not null default now(),
 primary key(household_id,path)
);
alter table public.household_categories enable row level security;
alter table public.household_locations enable row level security;
create policy household_categories_read on public.household_categories for select to authenticated using(public.household_role(household_id) is not null);
create policy household_locations_read on public.household_locations for select to authenticated using(public.household_role(household_id) is not null);
grant select on public.household_categories,public.household_locations to authenticated;
revoke insert,update,delete on public.household_categories,public.household_locations from public,anon,authenticated;
create function public.manage_household_taxonomy(target_household uuid,target_kind text,target_value text,target_action text)
returns void language plpgsql security definer set search_path=''
as $taxonomy$
declare cleaned text;
begin
 if auth.uid() is null or public.household_role(target_household) not in ('owner','editor') then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 cleaned:=btrim(target_value);
 if cleaned is null or length(cleaned)<1 or length(cleaned)>case when target_kind='category' then 60 else 240 end
 or target_kind not in ('category','location') or target_action not in ('add','remove') then
  raise exception 'Invalid category or location' using errcode='22023';
 end if;
 if target_kind='category' then
  if target_action='add' then
   insert into public.household_categories(household_id,name) values(target_household,cleaned) on conflict do nothing;
  else
   delete from public.household_categories where household_id=target_household and name=cleaned;
  end if;
 else
  if target_action='add' then
   insert into public.household_locations(household_id,path) values(target_household,cleaned) on conflict do nothing;
  else
   delete from public.household_locations where household_id=target_household and path=cleaned;
  end if;
 end if;
end;
$taxonomy$;
revoke all on function public.manage_household_taxonomy(uuid,text,text,text) from public,anon;
grant execute on function public.manage_household_taxonomy(uuid,text,text,text) to authenticated;
