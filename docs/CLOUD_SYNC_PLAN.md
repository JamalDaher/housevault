# Cloud Sync & Family Accounts — rollout plan

HouseVault remains **local-first**. This document describes a staged implementation, not a currently available cloud feature.

## Safety invariants
1. Existing IndexedDB inventory and attachment stores are never cleared or replaced merely by signing in.
2. Before first upload, prompt for and verify a complete JSON backup including photos and receipts.
3. All first connections compare validated local and remote inventories. Conflicting IDs, divergent edits, and one-sided records require an explicit review; no automatic last-write-wins.
4. Remote reads/writes must be scoped to a server-authorized workspace membership, not a client-supplied role. Owners manage invitations; editors edit; viewers read only.
5. The public GitHub Pages bundle contains **no service-role keys, private credentials, personal inventory, or real serial numbers**.
6. The app remains fully usable offline; network failures never erase local edits.
7. Attachments must be uploaded/downloaded and verified before a migration is marked complete.
8. Sync must handle deletions with tombstones, revisions, retryable idempotent operations, and conflict resolution before background upload is enabled.

## Incremental PRs
- **Phase 1 — sync safety domain (this PR):** typed manifests, initial-sync classification, role capabilities and unit tests. No network calls, sign-in, or IndexedDB schema changes.
- **Phase 2 — backend and authorization:** select/configure an authentication and database provider; add owner-scoped family workspaces, membership roles, invitations, server-enforced row-level access, and security tests. Keep private configuration out of source control.
- **Phase 3 — explicit opt-in migration:** account UI, mandatory backup prompt, local/remote preview, item and attachment transfer with checksums, verified completion and rollback path. Never silently replace local data.
- **Phase 4 — offline synchronization:** outbox, revision tokens, tombstones, conflict review UI, resumable attachment transfer, and tests for network interruption, concurrent devices and partial failures.
- **Phase 5 — family experience:** invitation acceptance, read-only member mode, device status, audit trail, permission revocation, and account recovery documentation.

## Threats and testing
- Two phones edit the same item offline; one deletes it.
- A viewer attempts writes by calling the API directly.
- A member guesses another household's workspace ID.
- A revoked member retries a cached token.
- An attachment upload succeeds but its inventory transaction fails.
- iPhone storage is isolated from Safari and contains a different inventory.
- Sign-in occurs on an empty device with an existing cloud workspace.
- The app closes midway through first migration.

**Current status:** This PR introduces only the pure decision logic. It does **not** turn on sync or make cloud privacy claims.
