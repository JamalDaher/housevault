# Cloud synchronization deployment and verification

HouseVault's revisioned cloud synchronization is **not enabled** by merging the adapter PRs. Local inventory remains authoritative until a separately reviewed, explicit opt-in rollout.

## Prerequisites

1. Back up the existing Supabase project and test the migration in a staging project first.
2. Confirm the deployed `public.households` table has `id` and `created_by` UUID columns, and `public.household_members` has `household_id`, `user_id`, and a `role` whose values include `owner`/`editor` as appropriate.
3. Review existing household and membership RLS policies for recursion and ensure members cannot forge ownership or editor roles.
4. Review `supabase/migrations/20261103010000_inventory_revisions.sql` with a database administrator. Apply using the project's established migration process, not from the browser.
5. Verify `write_inventory_revision` has only the intended authenticated EXECUTE grant, and the `inventory_revisions` table does not permit direct client writes. Audit SECURITY DEFINER ownership and `search_path`.
6. Verify read permissions separately for owner, editor, viewer, unrelated signed-in user and anonymous user. An empty RLS-filtered result alone is **not** evidence of authorization.
7. Verify the write RPC rejects viewer and unrelated accounts, accepts authorized editor/owner writes, and rejects stale expected revisions without changing the remote record.
8. Test simultaneous edits from two authenticated devices, offline retry, sign-out during an in-flight check, and household switching.
9. Define and review storage bucket policies for household-scoped attachments before connecting the attachment transport. Verify upload, download, deletion, file size limits, MIME restrictions, and cross-household denial.
10. Only then wire the revision adapter, conflict handling, attachment transport, and an explicit opt-in toggle into the UI. Add end-to-end tests and a rollback plan before enabling automatic sync.

## Manual preflight

Sign in to HouseVault, open **Account → Cloud readiness**, choose a household and select **Check cloud access**. A successful result means only that the current account can read the revision table for that household. It does **not** verify RPC write access, attachment storage, migration completeness, or end-to-end sync.

If the check fails, verify the migration and RLS policies using the Supabase dashboard and project logs. Do not loosen policies simply to make the indicator green.

## Rollback

Disable the future sync toggle first. Preserve local IndexedDB data and queued changes. Do not drop cloud tables, purge the outbox, or overwrite local inventory as part of a rollback without an independently verified backup and explicit user consent.
