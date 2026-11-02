# HouseVault

**A local-first home inventory, asset documentation, and equipment maintenance app.**

[**Launch HouseVault**](https://jamaldaher.github.io/housevault/) · [GitHub repository](https://github.com/JamalDaher/housevault) · [Report an issue](https://github.com/JamalDaher/housevault/issues)

HouseVault is an installable, offline-capable progressive web app (PWA) built with React, TypeScript, and Vite. Organize household assets, workshop tools, appliances, vehicles, and outdoor equipment in one searchable inventory. The hosted demo starts with **fictional sample items**.

> **Your data stays on your device.** HouseVault uses browser IndexedDB, not an online account. It does not automatically sync between devices or back up to the cloud. Export JSON backups regularly, especially before switching browsers or installing the iPhone Home Screen app.

## Features

| Area | What HouseVault supports |
| --- | --- |
| Inventory | Add, edit, duplicate, and delete records; quantity and value; category, nested location, brand, model, serial number, purchase and warranty dates, notes, and custom fields |
| Photos & documents | Up to six equipment photos per item with cover selection and viewer; up to 15 attached receipts/manuals/documents per item, 10 MB each; in-app document previews |
| Browse & organize | Table and gallery views, location browser, advanced search (including custom fields), sorting, saved filters, and bulk location/category changes or deletion |
| Dashboard | Inventory value, category and location summaries, highest-value assets, incomplete records, warranty attention, and maintenance status |
| Maintenance | Recurring service intervals, calculated due dates, overdue/upcoming alerts with 7/14/30-day windows, checklists, service history, costs, and monthly calendar |
| Calendar export | Download maintenance events as an `.ics` file for import into a calendar; **one-time export, not live sync** |
| Warranties | Active, expiring, expired, and unknown warranty status with attention lists |
| Reports | Printable inventory report, inventory CSV, warranty CSV, maintenance schedule CSV, and service history CSV |
| Import & backup | CSV import with preview and duplicate checks, downloadable CSV template, versioned JSON backup and restore |
| QR equipment labels | Open an equipment record, select **QR label**, and print a scannable label; scanning opens its record on a device containing the same local inventory |
| Offline PWA | Add to iPhone Home Screen, launch in standalone mode, and reopen the app offline after first loading it online |
| Device storage | IndexedDB inventory with separate attachment storage, automatic orphan attachment cleanup, and storage usage inspection |

## Install on iPhone

1. Open [HouseVault](https://jamaldaher.github.io/housevault/) in **Safari** while online.
2. **Before installing**, export a **JSON backup** and save it to Files.
3. Tap **Share → Add to Home Screen → Add**. Enable **Open as Web App** if iOS offers the option.
4. Launch HouseVault from the new Home Screen icon.
5. Check your inventory. If the installed app has separate storage from Safari, **restore your JSON backup inside the installed app**.
6. Once the app has loaded online, you can test offline access using Airplane Mode.

**Important:** Do not uninstall the app, clear website data, or delete your Safari inventory until you have verified a complete backup and restored records and attachments. iOS may isolate Safari and installed-app storage. A PWA is not a native App Store app, and background push notifications, cloud sync, and live calendar subscriptions are not implemented.

### App updates and offline use

HouseVault caches its public application shell for offline access. When online, the service worker checks for updates and refreshes static assets, with cached assets as an offline fallback. After an update is deployed, reopen the app while connected to the internet; another reopen may be needed for the new version to take control. **Inventory, photos, and documents are stored in IndexedDB, not in the service worker cache.**

## Common workflows

**Add an item:** Go to **Inventory → Add Item**. Attach photos, enter the item name, category, nested location (for example `House / Garage / Shelf`), value, and optional specifications. The mobile editor scrolls as one form; its heading scrolls away naturally.

**Manage equipment:** Open an item for its photo gallery, specifications, custom fields, receipts, warranty information, maintenance schedule, and service history. Duplicate a record to reuse its descriptive fields without copying the serial number, service history, or attachments.

**Plan maintenance:** Enter a maintenance task, last-service date, and service interval in days. Add checklist steps if needed. Use the Maintenance view to see due/overdue tasks, change the alert window, log completed work and costs, or export an `.ics` calendar snapshot.

**Organize records:** Search names, brands, models, serial numbers, maintenance tasks, and custom fields. Save frequently used filter combinations. Select records for bulk category changes, moves, or deletion.

**Import or export:** Use the CSV template and preview importer for tabular inventory data. Export CSVs for reporting. Use **Backup JSON** for a more complete backup, including supported photos and attachments.

**Restore carefully:** Restoring a JSON backup replaces the current inventory after confirmation. Back up your current records first.

## Local development

Requires a current Node.js LTS release and npm.

```bash
git clone https://github.com/JamalDaher/housevault.git
cd housevault
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm test
npm run build
```

The project uses React 19, TypeScript, Vite, Lucide icons, Vitest, ESLint, and GitHub Actions CI. The production site is deployed to GitHub Pages from the `main` branch.

## Data, privacy, and limitations

- Inventory metadata and attachments are persisted locally in **IndexedDB**. HouseVault has no account login, hosted database, end-to-end encryption, or cross-device synchronization.
- Attachments are stored separately from inventory metadata in IndexedDB. HouseVault cleans up unreferenced attachments; it does not upload them to GitHub.
- Clearing browser/app data or uninstalling the installed PWA may permanently remove local records unless you have a JSON backup.
- JSON backups and exported reports can contain serial numbers, receipts, and personal details. Store them securely.
- Equipment values are user-entered estimates, **not professional appraisals**. Verify safety-critical maintenance and warranty details with manufacturers.
- Maintenance alerts appear **inside the app**, not as system push notifications.
- Calendar `.ics` export is a **snapshot**; subsequent edits do not automatically update previously imported events.
- Storage capacity and offline/PWA behavior depend on the browser and operating system.

## Roadmap

Potential next upgrades: printable QR-code equipment labels, richer maintenance work orders and spare-parts tracking, insurance documentation and valuation tools, interactive room maps, and **optional** authenticated cloud sync that preserves local-first operation.

---

HouseVault is an evolving portfolio project. Suggestions and bug reports are welcome via [GitHub Issues](https://github.com/JamalDaher/housevault/issues).

### Printable equipment QR labels

Open an equipment record, choose **QR label**, then **Print label**. The QR is generated on your device, without a third-party QR service. It encodes the HouseVault URL and an opaque equipment ID, **not** the item's serial number or documents. Scan with your iPhone camera to open that record. Because HouseVault does not sync data between devices, a scan on a different phone may show a missing-record warning until that device has the matching inventory restored from a backup. Labels require the deployed HouseVault URL to remain accessible; offline scanning depends on the PWA being installed and cached.

### Scan QR codes inside the installed app

In the **Inventory** view, tap **Scan QR** to open the built-in camera scanner. Allow camera permission when prompted, then point your iPhone at a HouseVault equipment label. The matching local record opens inside HouseVault, avoiding Safari's separate storage context. A QR code cannot retrieve inventory stored only on another device. Camera access requires HTTPS and permission; you can close the scanner at any time.

### Cleaner dashboard and quick actions

The Overview dashboard now has one-tap **Scan equipment**, **Add equipment**, and **Browse inventory** shortcuts. The Inventory screen keeps **Scan QR** visible while grouping less-frequent CSV, backup, and print commands under **Import, export & print**. These changes only reorganize the interface; they do not change inventory storage or attachment handling.

## Cloud Sync & Family Accounts (in development)

The first development phase adds [a safety-first rollout plan](docs/CLOUD_SYNC_PLAN.md), initial synchronization decision logic, and family-role tests. **No cloud account or automatic synchronization is active yet.** All current inventory, photos, documents, and maintenance records remain in the existing device storage. Future phases will require explicit user opt-in and a verified backup before first migration.

### Phase 2: private family workspace backend (PR #63)

The repository now includes a [draft Supabase database migration](supabase/migrations/202611010001_cloud_foundation.sql) for household membership, owner/editor/viewer roles, inventory record revisions, attachment metadata, and row-level access policies. See [backend setup and security blockers](supabase/README.md). **This schema is not deployed or connected to HouseVault.** Authentication, invitation acceptance, private file storage policies, concurrency safeguards, and security integration tests are required before cloud sync can be enabled. Existing IndexedDB data remains unchanged.

### Phase 3: invitation security groundwork (PR #64)

A second [draft Supabase migration](supabase/migrations/202611010002_family_invitations.sql) removes direct client membership writes and adds owner-only invitation creation/revocation and verified-email acceptance functions. Invitations expire after seven days and can grant editor or viewer access. **No invitation emails are sent and no sign-in or cloud sync is enabled yet.** This SQL has not been deployed or integration-tested against Supabase. Before enabling it, we must test real authentication, membership isolation, revoked access, account recovery, and private attachment storage. Existing local inventory remains unchanged.

### Phase 4: Account page (PR #65)

HouseVault now includes an **Account** navigation page explaining the current local-only status, backup precautions, and upcoming family workspace features. This is an informational screen, **not a working sign-in form**. No Supabase credentials, remote calls, account sessions, inventory uploads, or IndexedDB changes are introduced. Existing inventory remains accessible without signing in. Future authentication controls will only be enabled after the backend and security tests are ready.

### Cloud backend security review (PR #66)

The connected **HouseVault** Supabase project exists in US East (Ohio), but **the cloud schema is not deployed and no sync is enabled**. This review tightens the pending SQL migrations: household creator fields cannot be edited by browser clients, inventory and attachment writes remain disabled until revision-safe audited RPCs exist, and direct membership writes are revoked. The schema remains a draft requiring real database integration tests, an audit of privileged functions, secure Storage policies, and a reviewed deployment. Local IndexedDB data is unchanged.

### Supabase database deployment (PR #67)

The HouseVault Supabase project now has the five empty household, membership, invitation, inventory, and attachment metadata tables from the first two migrations, with RLS enabled. The third deployed migration explicitly revokes anonymous execution of privileged functions and prevents authenticated users from invoking trigger functions directly. The security advisor still flags **four intentionally callable authenticated SECURITY DEFINER RPCs**; they require dedicated authorization tests and further review before family accounts launch. No local inventory was uploaded; browser cloud sync remains disabled. This PR tracks the deployed permissions in GitHub.

### Supabase live permission smoke test (PR #68)

Run the read-only SQL in [supabase/tests/security_smoke.sql](supabase/tests/security_smoke.sql) in the connected HouseVault project's SQL editor. **Zero returned rows means its configuration checks pass.** It checks the five RLS-enabled tables, anonymous access to privileged functions, authenticated trigger-function access, direct membership/invitation writes, and disabled inventory/attachment write policies. This query was run against the live empty project and returned zero failures. It **does not** prove cross-account RLS isolation or the safety of authenticated invitation RPCs; those need dedicated integration tests before enabling sign-in or cloud sync. Local inventory remains unchanged.

### Email authentication UI (PR #69)

The Account page includes optional Supabase passwordless email sign-in/sign-out, isolated from IndexedDB inventory. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your build environment (see `.env.example`); **never use service-role or secret keys in a browser**. The deployed GitHub Pages site does not automatically inherit local `.env` settings: configure the build workflow explicitly before enabling it. In Supabase Authentication URL Configuration, allow the exact deployed redirect URL (`https://jamaldaher.github.io/housevault/`) and configure Site URL appropriately before attempting email links. Until these settings are in place, the Account page shows a disabled cloud sign-in notice. No household membership UI, inventory upload/download, or cloud sync is included. Existing local inventory remains untouched. Auth session persistence is separate from inventory persistence. Do not use with real family accounts until cross-user authorization tests are complete.

### GitHub Pages authentication configuration (PR #70)

The deploy workflow supplies the **public** Supabase project URL and publishable API key at build time. These values are safe to embed in the browser; **never** add secret/service-role keys. Before email sign-in can complete, configure Supabase Dashboard → Authentication → URL Configuration with Site URL `https://jamaldaher.github.io/housevault/` and allow the same exact redirect URL. Verify email provider settings and test with a dedicated test account. Sign-in does not upload, merge, or sync any inventory. Avoid using real family accounts until authenticated RLS isolation tests are complete.

### Household management (PR #71)

Signed-in users can list households visible under existing Supabase RLS and create a new named household. The existing database trigger creates the initial owner membership; the browser cannot directly edit household membership. Households are future cloud workspaces and **do not upload or sync device inventory**. Invitations, member role management, and inventory sync remain disabled. A household list is only as secure as the server RLS policies; cross-user authorization testing remains a prerequisite for inviting family members.

### iPhone in-app email OTP sign-in (PR #72)

HouseVault Account now accepts a six-digit email verification code directly in the installed iPhone PWA, avoiding Safari's separate login session. The app sends email with `signInWithOtp` and verifies with `verifyOtp({email,token,type:'email'})`. **Supabase dashboard setup required:** Authentication → Email Templates → Magic Link, replace the link-only template or add a clearly labeled six-digit code using `{{ .Token }}`. Keep a usable magic link as fallback if desired. The OTP email template controls whether a numeric code is actually delivered; frontend changes alone cannot change the email. Test with a dedicated account in the installed PWA. Never paste sign-in codes into issues or support chats. No inventory upload or cloud sync is enabled.

**Email OTP length:** HouseVault accepts six- or eight-digit numeric codes because the configured Supabase email template may issue eight-digit codes. Enter the entire code from the latest email in the installed PWA.

The OTP field uses a length-neutral placeholder rather than a misleading six-digit sample; both six- and eight-digit codes remain supported.

### Household invitations (PR #75)

Signed-in household owners can create 7-day invitations for verified email addresses, assign viewer/editor roles, review invitation IDs and revoke pending invitations. A recipient signs in with the matching verified email and enters the invitation UUID to accept. This uses deployed Supabase RPCs (`create_household_invitation`, `accept_household_invitation`, `revoke_household_invitation`) and existing RLS; the browser never writes membership records directly. **Invitations are not emailed automatically**: owners must securely share the invitation ID. Invite IDs are sensitive; do not post them publicly. Roles prepare for future sharing but **inventory remains device-local** and is not accessible to other household members yet. Test cross-account permissions before any cloud sync rollout.

### Account interface refresh (PR #76)

Account & Family now uses a responsive account profile banner, clear sign-in state, dedicated household cards, invitation creation and management, invitation ID copy controls, and a private accept-invitation form. The outdated 'no account connected' copy was removed. Local-only inventory and backup guidance remain prominent. The redesign changes presentation only; Supabase authorization RPCs, storage, and sync behavior are unchanged.

### Mobile navigation (PR #77)

On narrow screens the seven main navigation destinations now use a compact four-column, two-row touch-friendly grid, rather than a horizontally scrolling strip. All destinations are visible at once on iPhone; desktop sidebar navigation is unchanged. This is a CSS-only layout update and does not affect device inventory or cloud access.

### Compact mobile header (PR #78)

Reduce the iPhone masthead footprint with smaller branding, tighter navigation spacing and shorter navigation buttons while retaining all seven visible destinations in a four-column, two-row grid. Desktop layout and stored inventory are unchanged.

### Collapsible mobile navigation (PR #79)

The mobile header now shows the current section and a Menu control instead of permanently showing all seven destinations. Tapping Menu opens a two-column section picker; selecting a destination closes it. Desktop navigation remains a persistent sidebar. No inventory storage or cloud authentication behavior changes.

### Household member management (PR #80)

The Account page lists household members and their viewer/editor/owner roles. Owners can change non-owner roles between viewer and editor or remove non-owner members through `set_household_member_role` and `remove_household_member` authenticated Supabase RPCs. These functions require owner authorization, reject owner demotion/removal, and keep direct client membership writes revoked. **Deploy `supabase/migrations/202611010004_member_management.sql` to the HouseVault Supabase project before testing the action buttons.** The roster shows abbreviated member IDs, not other users' private email addresses. Inventory remains local and is not shared. Cross-account authorization tests are required before cloud sync.

### Household creation fix (PR #81)

Deploy `supabase/migrations/202611010005_create_household_rpc.sql`. Account → Create household now calls the authenticated `create_household` RPC, which inserts and returns a household in one owner-authorized transaction, avoiding `INSERT ... RETURNING` RLS visibility issues. No inventory is uploaded.

### Household member names and emails (PR #82)

Deploy `supabase/migrations/202611010006_member_profiles.sql`. The authenticated `list_household_member_profiles` RPC returns member email addresses and optional self-chosen display names **only for households the caller belongs to**. Display names are saved to the signed-in user's own Supabase Auth metadata using `auth.updateUser`; names are presentation-only and never trusted for authorization. Household roles and permissions still use server-validated UUIDs. Shared household members can see one another's email addresses; do not join a household if you do not want its members to see your sign-in email. Inventory remains local.

### Inventory synchronization rollout — phase 1 (PR #83)

**Not yet enabled in the browser.** Migration `supabase/migrations/202611010007_inventory_sync_writes.sql` adds authenticated, server-checked `put_inventory_record` and `delete_inventory_record` RPCs. Only household owners and editors may write. Writes require an expected revision (0 means create), prevent overwriting concurrent edits, and use tombstones for deletes. Viewers remain read-only. Browser table writes remain disabled. Payloads are limited to 256 KiB and inline image/document data and local-only asset references are rejected until private attachment storage is ready. Run `supabase/tests/inventory_sync_smoke.sql` after deployment. The existing `src/syncFoundation.ts` requires a reviewed initial reconciliation. **Do not upload personal inventories yet.** Remaining gates: full payload schema validation, cross-account role and concurrency integration tests, explicit initial backup/reconciliation UI, device sync queue, private attachment storage, and recovery/rollback testing. No existing local inventory is modified by this PR.

### First-time sync preview (PR #85)

Account → Compare device and cloud inventory offers a **read-only** household-specific comparison. It reports local and remote record counts, differences by stable item ID, and local attachment counts. It reads IndexedDB and authorized Supabase inventory rows but **never uploads, downloads into local storage, deletes, or enables background synchronization**. It limits cloud previews to 1,000 rows and refuses to continue on read/validation errors. A preview is not consent to transfer. Future releases must add an explicit reviewed action, backup verification, attachment handling, conflict resolution, and role/security integration tests before syncing personal inventory.

### Shared household categories and locations (PR #86)

After deploying migration `202611010009_household_taxonomy.sql`, Account → Categories & locations offers per-household shared lists. All members can read; only owners/editors can add/remove via an authenticated role-checked RPC. Removing a list entry does not modify existing inventory. **This phase does not yet change the local item editor's built-in category options or automatically sync local inventory.** A later PR will integrate household taxonomy selection, migrations of existing local values, and reviewed sync.

### Shared list refresh (PR #90)

Account → Categories & locations re-fetches the selected household's categories and locations immediately after a successful add/remove RPC. The **Refresh lists** button fetches updates made by another family member without restarting the PWA. This is an explicit refresh, not a background real-time subscription, and does not yet populate the inventory item editor.

### Shared categories and locations in the item editor

When signed in, the Add/Edit Item form includes the selected household's shared categories alongside existing item categories and the built-in defaults. Location suggestions combine shared household paths with paths already used locally. Account → Categories & locations selects the household used by the editor; changes refresh without restarting. Item records remain local-first; this feature does not upload inventory. Existing custom categories are preserved by JSON backup/restore, CSV import, and reports.
