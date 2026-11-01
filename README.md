# HouseVault

A modular, local-first home inventory dashboard for the future Daher HomeOS.

## Features
- Responsive dashboard, create/edit/delete inventory items
- Search, category filtering, quantity-adjusted valuation
- CSV export, browser-local persistence, fictional sample records
- Vitest domain tests, ESLint, TypeScript and GitHub Actions

## Development
```sh
npm install
npm run dev
npm run lint
npm test
npm run build
```

## Deployment
Enable **GitHub Actions** as the Pages source under Settings → Pages. The deployment workflow publishes the demo on pushes to main.

## Privacy
This is a local-only demo, **not** a secure private inventory service. Do not enter sensitive serial numbers, receipts or personal data in a shared browser. Browser data can be lost. Future versions will add authenticated private storage and backups.

## Roadmap
Hierarchical locations → valuation reports and imports → secure documents/photos → HomeOS module integration.
