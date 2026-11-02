-- HouseVault cloud backend foundation. Apply only in a dedicated Supabase project.
-- No client credentials, real inventory, or service-role keys belong in Git.
create extension if not exists pgcrypto;

create table public.households (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.household_members (
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','editor','viewer')),
 created_at timestamptz not null default now(),
 primary key (household_id,user_id)
);
create table public.inventory_records (
 household_id uuid not null references public.households(id) on delete cascade,
 item_id text not null check(length(item_id) between 1 and 128),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 revision bigint not null default 1 check(revision>0),
 deleted_at timestamptz,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 primary key (household_id,item_id)
);
create table public.inventory_attachments (
 household_id uuid not null,
 item_id text not null,
 attachment_id text not null check(length(attachment_id) between 1 and 200),
 storage_path text not null unique,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size bigint not null check(byte_size>=0),
 created_at timestamptz not null default now(),
 primary key(household_id,item_id,attachment_id),
 foreign key(household_id,item_id) references public.inventory_records(household_id,item_id) on delete cascade
);

create index household_members_user_idx on public.household_members(user_id);
create index inventory_records_household_updated_idx on public.inventory_records(household_id,updated_at);

-- Security definer helper bypasses membership RLS recursion; fixed search_path.
create function public.household_role(target_household uuid)
returns text language sql stable security definer set search_path = ''
as $$
 select m.role from public.household_members m
 where m.household_id=target_household and m.user_id=(select auth.uid())
 limit 1
$$;
revoke all on function public.household_role(uuid) from public;
grant execute on function public.household_role(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.inventory_records enable row level security;
alter table public.inventory_attachments enable row level security;

create policy households_read on public.households for select to authenticated
 using(public.household_role(id) is not null);
create policy households_create on public.households for insert to authenticated
 with check(created_by=(select auth.uid()));
create policy households_update on public.households for update to authenticated
 using(public.household_role(id)='owner')
 with check(public.household_role(id)='owner');

create policy members_read on public.household_members for select to authenticated
 using(public.household_role(household_id) is not null);
create policy members_add on public.household_members for insert to authenticated
 with check(public.household_role(household_id)='owner');
create policy members_edit on public.household_members for update to authenticated
 using(public.household_role(household_id)='owner')
 with check(public.household_role(household_id)='owner');
create policy members_remove on public.household_members for delete to authenticated
 using(public.household_role(household_id)='owner');

create policy inventory_read on public.inventory_records for select to authenticated
 using(public.household_role(household_id) is not null);
create policy inventory_insert on public.inventory_records for insert to authenticated
 with check(public.household_role(household_id) in ('owner','editor') and updated_by=(select auth.uid()));
create policy inventory_update on public.inventory_records for update to authenticated
 using(public.household_role(household_id) in ('owner','editor'))
 with check(public.household_role(household_id) in ('owner','editor') and updated_by=(select auth.uid()));

create policy attachments_read on public.inventory_attachments for select to authenticated
 using(public.household_role(household_id) is not null);
create policy attachments_insert on public.inventory_attachments for insert to authenticated
 with check(public.household_role(household_id) in ('owner','editor'));
create policy attachments_update on public.inventory_attachments for update to authenticated
 using(public.household_role(household_id) in ('owner','editor'))
 with check(public.household_role(household_id) in ('owner','editor'));
create policy attachments_delete on public.inventory_attachments for delete to authenticated
 using(public.household_role(household_id) in ('owner','editor'));

-- Bootstrap must be transactional and server-side; clients cannot self-assign owner.
-- The owner is added by a trigger using the trusted households.created_by value.
create function public.bootstrap_household_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.household_members(household_id,user_id,role)
 values(new.id,new.created_by,'owner');
 return new;
end
$$;
create trigger bootstrap_household_owner_after_insert
after insert on public.households for each row
execute function public.bootstrap_household_owner();

-- Prevent membership changes that could eliminate the last owner.
create function public.protect_last_household_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if old.role='owner' and (tg_op='DELETE' or new.role<>'owner') then
  if not exists(select 1 from public.household_members m where m.household_id=old.household_id and m.user_id<>old.user_id and m.role='owner') then
   raise exception 'Cannot remove the last household owner';
  end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end
$$;
create trigger protect_last_owner_before_change
before update or delete on public.household_members for each row
execute function public.protect_last_household_owner();

-- Before production: add invitation acceptance, optimistic concurrency enforcement,
-- server-side payload validation, storage.objects RLS, and end-to-end authorization tests.
