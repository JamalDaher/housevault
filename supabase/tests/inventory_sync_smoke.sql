-- Read-only deployment checks for phase-one inventory sync.
-- Expected: no rows. This is not a substitute for cross-account integration tests.
with failures as (
 select 'missing inventory write function' as problem
 where to_regprocedure('public.put_inventory_record(uuid,text,jsonb,bigint)') is null
 union all
 select 'missing inventory delete function'
 where to_regprocedure('public.delete_inventory_record(uuid,text,bigint)') is null
 union all
 select 'anonymous can execute inventory RPC'
 where has_function_privilege('anon','public.put_inventory_record(uuid,text,jsonb,bigint)','EXECUTE')
    or has_function_privilege('anon','public.delete_inventory_record(uuid,text,bigint)','EXECUTE')
 union all
 select 'authenticated cannot execute inventory RPC'
 where not has_function_privilege('authenticated','public.put_inventory_record(uuid,text,jsonb,bigint)','EXECUTE')
    or not has_function_privilege('authenticated','public.delete_inventory_record(uuid,text,bigint)','EXECUTE')
 union all
 select 'inventory direct browser write grant'
 where has_table_privilege('authenticated','public.inventory_records','INSERT')
    or has_table_privilege('authenticated','public.inventory_records','UPDATE')
    or has_table_privilege('authenticated','public.inventory_records','DELETE')
)
select problem from failures;
