# HouseVault

**A local-first home inventory and equipment maintenance app.**

[Launch HouseVault](https://jamaldaher.github.io/housevault/) · [Report a bug or request a feature](https://github.com/JamalDaher/housevault/issues) · [Cloud sync plan](docs/CLOUD_SYNC_PLAN.md)

HouseVault is an installable progressive web app built with React, TypeScript, and Vite. Catalog household belongings, tools, appliances, vehicles, and outdoor equipment; track maintenance and warranties; and export backups you control. The demo includes fictional sample inventory.

> **Back up your data.** Inventory and attachments are stored in this browser's IndexedDB. Signing in does **not** automatically back up or synchronize your inventory. Export a JSON backup before clearing browser data, reinstalling, switching devices, or restoring another backup.

## Features

| Area | Capabilities |
| --- | --- |
| Inventory | Add, edit, duplicate, search, sort, and bulk-organize items by category and nested location; track quantity, value, serial numbers, purchase details, and custom fields |
| Photos and documents | Item photo galleries, receipts, manuals, and document previews stored on-device |
| Dashboard and reports | Inventory summaries, warranty and maintenance alerts, printable reports, and CSV exports |
| Maintenance | Recurring schedules, checklists, service history, costs, and one-time calendar (ICS) export |
| Import and backup | CSV import with preview and duplicate checks; JSON backup and restore |
| Equipment QR codes | Print equipment labels and scan them in the app to open a matching **local** record |
| Offline app | Install to the iPhone Home Screen; use cached app screens offline after the first online visit |
| Family accounts (beta) | Optional email sign-in, household workspaces, invitations, and member roles |
| Cloud transfers (beta) | Explicitly enabled, revision-checked inventory transfers; conflicts and deletions require careful review |

## Get started

1. Open [HouseVault](https://jamaldaher.github.io/housevault/).
2. Add an item under **Inventory**, including its category, location, value, and optional photos or documents.
3. Use **Maintenance** to record recurring work and **Reports** to export inventory details.
4. Download a **JSON backup** and store it somewhere safe.

### Install on iPhone

1. Open HouseVault in **Safari** while connected to the internet.
2. Export a JSON backup before installation if you already have inventory in Safari.
3. Choose **Share → Add to Home Screen → Add** (enable **Open as Web App** if offered).
4. Launch HouseVault from the Home Screen. If its inventory is empty because iOS created separate storage, restore your JSON backup **inside the installed app**.
5. Verify your items **and attachments** before removing anything from Safari.

The installed PWA may use different storage from Safari. Uninstalling the app or clearing website data can erase locally stored inventory. The service worker caches app files, **not** your inventory backup. Reopen the app online after a deployment to receive updates; occasionally a second reopen is needed.

## Accounts and cloud synchronization

HouseVault is **local-first**. Optional Supabase email sign-in and household management are available, but an account does not imply that local inventory is backed up.

Cloud transfer capabilities are being introduced incrementally with explicit opt-in and revision checks. Some record creation, edit, pull, recovery, and deletion operations remain manual or limited. Photos and documents are **not** automatically synchronized. Do not treat beta transfers as a complete cross-device backup.

**Offline sync reliability milestone — PR #182 (draft):** Household-aware queued edits, revision-safe transport, and manual queue controls are under development. Automatic queuing from live inventory edits and end-to-end verification are **not complete**. Until this milestone is merged and tested, do not assume those features are present on the deployed site.

For design and security details, see [the cloud sync plan](docs/CLOUD_SYNC_PLAN.md) and [Supabase setup](supabase/README.md). Never put a Supabase service-role or secret key in browser code.

## Common tasks

- **Backup and restore:** Export **Backup JSON** for a fuller archive of records and supported attachments. Restoring replaces the current inventory after confirmation; back up the existing inventory first.
- **Import:** Use the CSV template and preview importer to bring in multiple records, then inspect duplicates and missing details.
- **QR labels:** Open an item, choose **QR label**, and print it. Scanning opens the matching item only if that device has the record locally. QR labels do not embed serial numbers or documents.
- **Maintenance calendar:** Export an `.ics` snapshot. Later changes in HouseVault do not automatically update an imported calendar.
- **Cloud transfers:** Sign in under **Account & Family**, choose the intended household, and review each enabled transfer option and its limitations before sending data.

## Develop locally

Requires a supported Node.js LTS release and npm.

```bash
git clone https://github.com/JamalDaher/housevault.git
cd housevault
npm install
npm run dev
```

Run the same quality checks used for development:

```bash
npm run lint
npm test
npm run build
```

The production PWA is deployed to GitHub Pages from `main`. Supabase client configuration uses the **public** values `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; see `.env.example` and the deployment workflow. Never commit privileged credentials.

## Privacy and limitations

- Inventory, photos, and documents are stored in browser IndexedDB unless you explicitly use an available cloud transfer.
- JSON backups, CSV exports, and receipts may contain sensitive household information; store and share them carefully.
- Local storage can be lost when site data is cleared or an app is removed. Keep independent backups.
- Cloud features are beta, and not all fields, attachments, deletions, or offline changes synchronize across devices.
- Maintenance reminders appear in the app; they are not system push notifications.
- Inventory values are user-entered estimates, not professional appraisals. Confirm safety-critical maintenance details with the manufacturer.

## Roadmap

Current priorities are reliable household-scoped offline synchronization, safe conflict and deletion handling, attachment transfer, and end-to-end multi-device tests. Future improvements may include richer maintenance work orders, spare-parts tracking, insurance reports, and room maps.

Contributions, bug reports, and feature requests are welcome through [GitHub Issues](https://github.com/JamalDaher/housevault/issues).
