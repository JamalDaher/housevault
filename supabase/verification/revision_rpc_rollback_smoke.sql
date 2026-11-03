-- Manual, transaction-scoped smoke test for the deployed revision RPC.
-- IMPORTANT: Use only with a test household and an authorized test user.
-- Replace both UUID placeholders with actual IDs before running in SQL editor.
-- The final ROLLBACK guarantees that no test inventory record persists.
-- Run as a single session/transaction; do not execute statements separately.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','REPLACE_WITH_TEST_USER_UUID',true);

do $$
declare
  household uuid := 'REPLACE_WITH_TEST_HOUSEHOLD_UUID';
  item text := '__housevault_revision_smoke_' || gen_random_uuid()::text;
  first_revision uuid;
  second_revision uuid;
  current_revision uuid;
  current_payload jsonb;
  conflict_seen boolean := false;
begin
  first_revision := public.write_inventory_revision(household,item,null,'{"smoke_test":1}'::jsonb);
  if first_revision is null then raise exception 'First revision missing'; end if;

  select revision,payload into current_revision,current_payload
    from public.inventory_revisions where household_id=household and item_id=item;
  if current_revision is distinct from first_revision or current_payload is distinct from '{"smoke_test":1}'::jsonb
    then raise exception 'Initial readback failed'; end if;

  second_revision := public.write_inventory_revision(household,item,first_revision,'{"smoke_test":2}'::jsonb);
  if second_revision is null or second_revision=first_revision then raise exception 'Revision did not advance'; end if;

  begin
    perform public.write_inventory_revision(household,item,first_revision,'{"smoke_test":"stale"}'::jsonb);
  exception when sqlstate '40001' then conflict_seen := true;
  end;
  if not conflict_seen then raise exception 'Stale write was not rejected'; end if;

  select revision,payload into current_revision,current_payload
    from public.inventory_revisions where household_id=household and item_id=item;
  if current_revision is distinct from second_revision or current_payload is distinct from '{"smoke_test":2}'::jsonb
    then raise exception 'Conflict changed stored record'; end if;

  raise notice 'PASS: create, readback, update, stale conflict, and unchanged record';
end $$;
rollback;
