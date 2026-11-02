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
