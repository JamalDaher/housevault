# Authenticated cloud revision test workflow

This is an opt-in **staging/test household** workflow. Do not use a real household or regular user account. The production migration has been deployed, but this workflow does not enable sync.

## Prerequisites

1. Create a dedicated test user using the normal HouseVault sign-up flow. Confirm its email if required.
2. Sign in as that test user and create a new household named `HouseVault Sync Test`. Do not invite real household members.
3. Verify the new household appears in Account → Cloud readiness and that **Check cloud access** succeeds.
4. Keep the test user's credentials private. Never commit access tokens, passwords, or Supabase service-role keys.

## Test through the authenticated API

Use the test user's normal Supabase session with `createCloudRevisionApi` from `src/cloudRevisionApi.ts` and the test household ID.

1. Generate a unique item ID with prefix `__housevault_test_` (do not reuse IDs).
2. Call `read(itemId)`; expect `null`.
3. Call `write({itemId,expectedRevision:null,value:{smoke_test:true,step:1}})`; expect `saved` and a revision token.
4. Read the item and verify its revision and payload.
5. Write again with the returned revision and payload `{smoke_test:true,step:2}`; expect a different revision.
6. Attempt to write using the *first* revision. Expect `conflict`, with the second revision and payload returned.
7. Read again; verify the rejected stale write did not overwrite the second payload.
8. Sign in with a different test user **not in the household**. Reads must return no row, and writes must be denied. Do not treat a missing row as proof that an unauthorized write was denied.
9. If a viewer role is available, verify viewer writes are denied; an editor should be able to write only within the test household.

**Cleanup:** The public client currently has no authorized deletion RPC for revision records. Test records therefore remain **inside the isolated test household** until a reviewed cleanup mechanism is added. Do not claim they are automatically deleted. Never use production inventory records for this test.

## SQL transaction test

The companion `supabase/verification/revision_rpc_rollback_smoke.sql` is a separate database-level rollback test. It is not an authenticated end-to-end API test. Its role/JWT simulation should be run only in a controlled test environment after reviewing the authorization model. Do not use it to impersonate a real household member.

## Release gate

Do not turn on automatic inventory sync until authenticated create/read/update/conflict, cross-household denial, viewer denial, and device-to-device reconciliation have been verified and documented.
