# OBIX 360 (Orderflow)

Multi-tenant billing, inventory and order-management platform for **retail, wholesale, restaurants and pharmacies** in India. One codebase serves the web app, the Android app and the REST API.

- **Live site:** https://obix360.com
- **Product name:** OBIX 360. **Repository / internal name:** Orderflow.
- **License:** proprietary, all rights reserved.

## What it does

| Area | Highlights |
|---|---|
| Counter and billing | POS, GST invoices (CGST/SGST/IGST by HSN code), financial-year invoice numbers, thermal and A4 PDF, WhatsApp invoices |
| Inventory | Stock, batches and expiry, low-stock alerts, supplier returns, purchase orders, distributor-bill (invoice) scanning |
| Pharmacy | MRP cap, Schedule H1/X register with prescription photos, batch traceability |
| Restaurant | Tables, kitchen tickets (KOT), QR ordering for guests |
| Customers and money | Credit customers, payments, ageing, party ledgers, expenses |
| Reports | Day Book, profit per bill, staff-wise sales, money in/out, stock summary, CSV and print export |
| Team | Staff, salesman (field visits), kitchen and cashier roles, per-role access |
| B2B | Store-to-store connections that sync catalogs and orders |
| Platform admin | Super-admin console: stores, users, subscriptions, sales by store, announcements |
| AI helpers | Order parsing from WhatsApp text and voice, invoice OCR (Google Gemini) |

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Android app | Capacitor 8 wrapping the static web export; self-hosted over-the-air updates |
| API | NestJS 11, TypeORM 1.0, PostgreSQL |
| Files | S3-compatible object storage (Neon Object Storage) |
| Integrations | Evolution API (WhatsApp), Google Gemini, Firebase Cloud Messaging, Google sign-in, SMTP via `apps/mailer` |
| Monorepo | npm workspaces + Turborepo |

## Repository layout

```
orderflow/
├── apps/
│   ├── web/                  # Next.js app: marketing pages, staff app, super-admin console, Capacitor shell
│   └── mailer/               # Small serverless function that sends transactional email
├── packages/
│   ├── api/                  # NestJS REST API (src/modules/<feature>, src/database for entities + migrations)
│   ├── shared/               # Shared business models, terminology presets and API interfaces
│   ├── ui/                   # Shared UI components
│   ├── database/             # schema.sql reference snapshot (migrations live in packages/api)
│   ├── eslint-config/        # Shared lint config
│   └── typescript-config/    # Shared tsconfig presets
├── docs/                     # All documentation, start at docs/README.md
├── scripts/                  # Operational helper scripts (e.g. database restore)
├── tools/                    # Standalone helper tools (e.g. Google Sheets sync script)
├── .github/workflows/        # CI and release pipelines
├── docker-compose.yml        # Local Postgres for development
└── docker-compose.prod.yml   # Optional container-based production stack
```

## Quick start

You need **Node.js 20+**, **npm 10+** and a **PostgreSQL 15** database (the repo's `docker-compose.yml` can start one).

```bash
git clone <repo-url> orderflow && cd orderflow
npm install

# 1. environment: copy the template and fill in the values you need
cp .env.example packages/api/.env.local

# 2. start API (http://localhost:4000) and web app (http://localhost:3000) together
npm run dev
```

The API applies database migrations itself when it starts. Details, env variables and troubleshooting: [docs/development.md](docs/development.md).

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | API (watch) and web dev server together |
| `npm run dev:api` / `npm run dev:web` | Run one side only |
| `npm test` | API unit tests (Jest) |
| `npm test --workspace=web` | Web unit tests (Vitest) |
| `npm run test:e2e --workspace=web` | Web end-to-end tests (Playwright) |
| `npm run build:api` / `npm run build:web` | Production builds |
| `npm run build:capacitor --workspace=web` | Static export for the Android app |
| `npm run migration:generate --workspace=api -- <path>` | Create a database migration |
| `npx tsc --noEmit` (inside `packages/api` or `apps/web`) | Typecheck, the same check CI runs |

## Documentation

Start at **[docs/README.md](docs/README.md)**. Short version:

- [Architecture](docs/architecture.md): how the pieces fit, API modules, auth and multi-tenancy rules
- [Development](docs/development.md): setup, environment, testing, migrations, CI
- [Deployment](docs/deployment.md): how production runs and how to release
- [API reference](docs/api-reference.md): REST endpoints and testing recipes
- [Contributing](CONTRIBUTING.md): branch, commit and pull-request workflow

## Releases

- **Web and API:** deployed to a VPS (see [docs/deployment.md](docs/deployment.md)).
- **Android:** over-the-air updates (`release:ota`), APK builds and Play Store builds run from GitHub Actions workflows in `.github/workflows/`.
