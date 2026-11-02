-- Invitation RPCs, phase 3 draft. Apply only in a test Supabase project.
-- Requires 202611010001_cloud_foundation.sql.
-- Direct membership changes are forbidden to authenticated browser clients.
drop policy if exists members_add on public.household_members;
drop policy if exists members_edit on public.household_members;
drop policy if exists members_remove on public.household_members;

create table public.household_invitations (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 invited_email text not null check(length(trim(invited_email)) between 3 and 320),
 role text not null check(role in ('editor','viewer')),
 invited_by uuid not null references auth.users(id),
 expires_at timestamptz not null default (now() + interval '7 days'),
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index household_invites_household_idx on public.household_invitations(household_id);
alter table public.household_invitations enable row level security;
create policy invitations_owner_read on public.household_invitations for select to authenticated
 using(public.household_role(household_id)='owner');

create function public.create_household_invitation(target_household uuid,target_email text,target_role text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare invite_id uuid;
begin
 if (select auth.uid()) is null or public.household_role(target_household) is distinct from 'owner' then
  raise exception 'Not authorized';
 end if;
 if target_role is null or target_role not in ('editor','viewer') or target_email is null or
    length(trim(target_email)) not between 3 and 320 or
    trim(target_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  raise exception 'Invalid invitation';
 end if;
 insert into public.household_invitations(household_id,invited_email,role,invited_by)
 values(target_household,lower(trim(target_email)),target_role,(select auth.uid()))
 returning id into invite_id;
 return invite_id;
end
$$;

create function public.accept_household_invitation(invitation_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare inv public.household_invitations%rowtype; email_address text; verified_at timestamptz;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select lower(email),email_confirmed_at into email_address,verified_at
 from auth.users where id=(select auth.uid());
 if verified_at is null then raise exception 'Verified email required'; end if;
 select * into inv from public.household_invitations where id=invitation_id for update;
 if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at<=now()
 then raise exception 'Invitation unavailable'; end if;
 if email_address is distinct from inv.invited_email then raise exception 'Invitation email mismatch'; end if;
 insert into public.household_members(household_id,user_id,role)
 values(inv.household_id,(select auth.uid()),inv.role)
 on conflict (household_id,user_id) do nothing;
 update public.household_invitations set accepted_at=now() where id=invitation_id;
 return inv.household_id;
end
$$;

create function public.revoke_household_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare target_household uuid;
begin
 select household_id into target_household from public.household_invitations where id=invitation_id;
 if target_household is null or public.household_role(target_household) is distinct from 'owner' then
  raise exception 'Not authorized';
 end if;
 update public.household_invitations set revoked_at=now()
 where id=invitation_id and accepted_at is null;
end
$$;
revoke all on function public.create_household_invitation(uuid,text,text) from public;
revoke all on function public.accept_household_invitation(uuid) from public;
revoke all on function public.revoke_household_invitation(uuid) from public;
grant execute on function public.create_household_invitation(uuid,text,text) to authenticated;
grant execute on function public.accept_household_invitation(uuid) to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;
