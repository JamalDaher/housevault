# Cloud backend setup (development only)

This directory contains a **draft Supabase PostgreSQL migration** for HouseVault family workspaces. **Do not deploy it to production yet.** It is not connected to the PWA and does not upload any inventory.

## Tables and access
- `households`: household workspaces, creator and display name.
- `household_members`: user memberships and owner/editor/viewer roles.
- `inventory_records`: per-household JSON records, revisions and deletion tombstones.
- `inventory_attachments`: attachment metadata (not binary file contents), checksums and paths.
- RLS: household members may read their workspace; owners and editors may edit records; only owners manage memberships.
- A database trigger creates the initial owner when a signed-in user creates a household; another prevents removing its last owner.

## Important deployment blockers
1. **Invitation security**: current membership insert policy allows an owner to add a user ID directly. Before public launch, add an invitation/acceptance flow with verified invitee identity and restrict membership writes to audited server functions.
2. **Storage policies**: create a private Supabase Storage bucket and enforce household-scoped object access. Do not use a public bucket or assume metadata RLS protects file bytes.
3. **Optimistic concurrency**: require server-side expected-revision checks, atomic increments and tombstones. RLS alone does not prevent lost updates.
4. **Payload validation**: enforce size, schema, attachment references and safe limits server-side.
5. **Authorization tests**: integration tests with real signed-in users covering cross-household isolation, viewers, editors, revocation and last-owner protection.
6. **Environment**: configure public Supabase project URL and publishable/anon key only after review; never commit service-role keys, credentials, real inventory or secrets.
7. **Migration**: implement explicit first-sync preview and verified JSON backup before transferring local data.

The GitHub Pages app remains offline-first and fully local. Applying SQL alone does not enable sync.
