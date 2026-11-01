# HouseVault

**A local-first home inventory and equipment maintenance dashboard.**

[**Open the live demo**](https://jamaldaher.github.io/housevault/) · [Source code](https://github.com/JamalDaher/housevault)

HouseVault helps you organize household equipment, track estimated replacement value, monitor warranties, and plan recurring maintenance. Built with React, TypeScript, and Vite as a portfolio project and a possible future module of Daher HomeOS.

> **Important:** HouseVault currently stores data in your browser's local storage. It is not a hosted account, encrypted vault, or cross-device synchronization service. The demo starts with fictional sample equipment; do not put private serial numbers or sensitive documents in a shared browser.

## Features

| Area | Capabilities |
| --- | --- |
| Inventory | Add, edit, and delete items; track category, location, quantity, unit value, brand, model, serial number, purchase date, warranty end, and notes |
| Organization | Nested location paths and location browser; search and filters for category, warranty, and maintenance; inventory sorting |
| Dashboard | Quantity-adjusted total value, category and location summaries, most valuable equipment, and missing-detail checklist |
| Warranties | Active, expiring, expired, or unknown coverage; attention list for expired and soon-to-expire warranties |
| Maintenance | Service task, last service date, recurring interval, calculated next service date, status, prioritized attention queue, and monthly maintenance calendar |
| Service history | Log completed maintenance with date, notes, and cost; review cumulative spending by equipment |
| Import/export | Validated CSV inventory import with preview and duplicate checks; blank CSV template; inventory, warranty, maintenance schedule, and service history CSV exports |
| Reports and backups | Printable inventory report (including Save as PDF through the browser); versioned JSON backup and restore |

**Maintenance status definitions:** Overdue = before today; Due = today; Upcoming = within the next 30 days; Scheduled = more than 30 days away; Unscheduled = no valid calculated due date. The attention queue shows overdue, due, and upcoming tasks; the calendar and schedule CSV include future scheduled work.

## Getting started

### Try the hosted demo

Open **https://jamaldaher.github.io/housevault/**. Data you enter stays in that browser's local storage; it is not synchronized with another browser or device.

### Run locally

Prerequisites: a recent Node.js LTS release and npm.

```bash
git clone https://github.com/JamalDaher/housevault.git
cd housevault
npm install
npm run dev
```

Open the local URL printed by Vite.

### Quality checks

```bash
npm run lint
npm test
npm run build
```

The project uses Vitest for domain tests, ESLint, TypeScript checks, and GitHub Actions CI.

## Common workflows

**Add equipment:** Create an inventory record, choose its category and location, and optionally add purchase, warranty, and service details. Nested locations use paths such as `House / Garage / Shelf`.

**Import a spreadsheet:** Download the CSV template, fill it in, and use **Import CSV** to review records and duplicate warnings before importing. Existing records should be backed up first.

**Track maintenance:** Enter a last-service date and interval (in days) for an item. HouseVault calculates the next service date. Use **Log service** after maintenance to record cost and notes and update the item's last-service date.

**Export data:** Use the inventory controls to export inventory CSV or print a filtered inventory report. Warranty and maintenance sections provide their own CSV exports; the service spending section exports detailed service history.

**Back up or restore:** Use **Backup JSON** regularly to download a copy of your data. **Restore JSON** replaces the current inventory after confirmation, so export your current data before restoring.

## Privacy and limitations

- Records are stored in browser `localStorage` on the current device/browser only.
- Clearing site data, using private browsing, or changing browsers/devices may remove or hide your inventory.
- No authentication, encryption-at-rest feature, cloud database, or automatic cross-device sync is provided.
- JSON backup files and exported CSVs may contain inventory details; store and share them carefully.
- Values are user-entered estimates, not insurance appraisals.
- Maintenance and warranty information is informational; verify critical service requirements with manufacturer documentation.

## Tech stack

- React 19 + TypeScript
- Vite
- Lucide icons
- Vitest, ESLint, and GitHub Actions
- Browser localStorage for persistence

## Deployment

The GitHub Pages deployment workflow builds and publishes the `dist` directory after pushes to `main`. Under repository **Settings → Pages**, select **GitHub Actions** as the deployment source.

## Roadmap

Potential future work includes item photos and attachments, improved dashboard navigation, advanced reporting, optional authenticated private storage and cross-device sync, and integration with Daher HomeOS. These are **not yet implemented**.

---

HouseVault is an evolving open-source portfolio project. Contributions and issue reports are welcome through [GitHub Issues](https://github.com/JamalDaher/housevault/issues).
