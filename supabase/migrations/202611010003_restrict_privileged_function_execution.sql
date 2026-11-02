-- Deployed to HouseVault Supabase project after initial security scan.
-- Deny anonymous invocation of all privileged public functions.
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.bootstrap_household_owner() from authenticated;
revoke execute on function public.protect_last_household_owner() from authenticated;
grant execute on function public.household_role(uuid) to authenticated;
grant execute on function public.create_household_invitation(uuid,text,text) to authenticated;
grant execute on function public.accept_household_invitation(uuid) to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;
alter default privileges in schema public revoke execute on functions from public;
