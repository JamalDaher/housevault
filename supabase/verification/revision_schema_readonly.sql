-- Read-only checks for the revisioned cloud schema.
-- Run in the Supabase SQL editor after deploying the reviewed migration.
-- No household data or permissions are changed.
select
 to_regclass('public.inventory_revisions') is not null as revision_table_exists,
 to_regprocedure('public.write_inventory_revision(uuid,text,uuid,jsonb)') is not null as write_rpc_exists;

select
 table_name,
 column_name,
 data_type
from information_schema.columns
where table_schema='public'
  and table_name in ('households','household_members','inventory_revisions')
order by table_name,ordinal_position;

select
 c.relname as table_name,
 c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='inventory_revisions';

select
 grantee,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='inventory_revisions'
  and grantee in ('anon','authenticated')
order by grantee,privilege_type;

select
 p.proname,
 p.prosecdef as security_definer,
 p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='write_inventory_revision';

-- These catalog checks are not substitutes for signed-in owner/editor/viewer
-- authorization and stale-revision RPC integration tests.
