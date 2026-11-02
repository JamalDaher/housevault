-- HouseVault deployment verification (read-only). Run against the connected Supabase project.
-- Expected: zero rows returned. This verifies configuration, not user-to-user isolation.
with expected_tables(name) as (
 values ('households'),('household_members'),('household_invitations'),('inventory_records'),('inventory_attachments')
),
failures as (
 select 'missing or RLS-disabled table: '||e.name as problem
 from expected_tables e left join pg_class c on c.relname=e.name and c.relnamespace='public'::regnamespace and c.relkind='r'
 where c.oid is null or not c.relrowsecurity
 union all
 select 'anonymous EXECUTE privilege: '||p.proname
 from pg_proc p where p.pronamespace='public'::regnamespace
 and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE')
 union all
 select 'authenticated trigger EXECUTE privilege: '||p.proname
 from pg_proc p where p.pronamespace='public'::regnamespace
 and p.proname in ('bootstrap_household_owner','protect_last_household_owner')
 and has_function_privilege('authenticated',p.oid,'EXECUTE')
 union all
 select 'browser write privilege: '||c.relname
 from pg_class c where c.relnamespace='public'::regnamespace
 and c.relname in ('household_members','household_invitations')
 and (has_table_privilege('authenticated',c.oid,'INSERT')
 or has_table_privilege('authenticated',c.oid,'UPDATE')
 or has_table_privilege('authenticated',c.oid,'DELETE'))
 union all
 select 'unexpected inventory write policy: '||p.policyname
 from pg_policies p where p.schemaname='public' and p.tablename in ('inventory_records','inventory_attachments')
 and p.cmd in ('INSERT','UPDATE','DELETE','ALL')
)
select problem from failures order by problem;
