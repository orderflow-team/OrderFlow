# Architecture

How OBIX 360 (Orderflow) fits together. Read this first if you are new to the codebase.

## The big picture

```
 Browser / Android app (Capacitor)
            │  HTTPS, JWT in Authorization header
            ▼
   Reverse proxy (Apache2) ──► Next.js web app  (apps/web)
            │
            └─► NestJS API  (packages/api)  ──► PostgreSQL
                     │                    └─► S3-compatible storage (images, PDFs, APKs)
                     ├─► Evolution API  (WhatsApp send/receive)
                     ├─► Google Gemini   (order parsing, invoice OCR)
                     ├─► Firebase FCM    (push notifications)
                     └─► SMTP or apps/mailer (email)
```

- One **API** serves the web app, the Android app and the super-admin console.
- The **Android app** is the same Next.js code exported as static files and wrapped with Capacitor. It talks to the same API.
- Every business ("tenant") shares one database. Data is separated by a `business_id` column, see [Multi-tenancy](#multi-tenancy-the-rule-that-matters-most).

## Repository layout

| Path | What lives there |
|---|---|
| `apps/web` | Next.js 16 App Router app: public marketing/SEO pages, the staff app, the super-admin console (`/admin`), Capacitor config and Android project |
| `apps/mailer` | Small serverless function that sends transactional email, used where SMTP ports are blocked |
| `packages/api` | NestJS REST API. Feature code in `src/modules/<feature>`, shared code in `src/common`, database in `src/database` |
| `packages/shared` | Shared business models, terminology presets (what a "product" is called per business type) and API interfaces |
| `packages/ui` | Shared UI components |
| `packages/database` | `schema.sql` reference snapshot only. The real entities and migrations are in `packages/api/src/database` |
| `packages/eslint-config`, `packages/typescript-config` | Shared tooling config |
| `docs/` | Documentation |
| `scripts/` | Operational scripts (database restore) |
| `tools/` | Standalone helper tools (Google Sheets sync) |

## API

### Modules

Each folder in `packages/api/src/modules` is one feature with its own controller, service, DTOs and tests. Routes are prefixed `/api/<module>`, except authentication which is served at `/auth`.

| Module | Purpose |
|---|---|
| `auth` | Signup, login, OTP, password reset, Google sign-in, guest (QR) login |
| `businesses` | Business profile and settings, logo, WhatsApp connection |
| `products`, `categories` | Catalog, variants, bulk upload, product images |
| `inventory` | Stock, batches and expiry, adjustments, supplier returns, purchase orders |
| `suppliers`, `customers` | Parties, credit limits and outstanding balances |
| `orders` | Order lifecycle, payments, returns, prescriptions, WhatsApp invoice send |
| `billing` | Invoices, PDF generation (Puppeteer), payments |
| `expenses` | Expense records |
| `reports` | Dashboard, sales, profit, Day Book, ageing, party ledgers, money flow, stock summary |
| `restaurant` | Tables and kitchen order tickets |
| `salesman` | Field-visit check-ins and salesman accounts |
| `staff` | Staff and kitchen accounts and roles |
| `invoice-scan` | OCR of purchase invoices into stock |
| `ai` | Order parsing from chat text (Gemini) |
| `whatsapp` | Evolution API client and the inbound webhook |
| `notifications` | Push notifications and expiry reminders |
| `business-connections` | B2B links between retailer and wholesaler accounts |
| `subscriptions` | Plans, trial, paywall, upgrade requests |
| `platform-admin` | Super-admin console APIs and the Google Sheets order feed |
| `app-updates`, `app-apk-releases` | Over-the-air bundles and APK hosting for the Android app |
| `dev-tools` | Seeding and reset helpers, admin only, destructive |

### Authentication, roles and access

Three guards run in this order on most controllers:

1. **`JwtAuthGuard`** checks the login token. Guest (QR customer) tokens are rejected unless a route is marked `@AllowGuest()`.
2. **`RolesGuard`** checks the `@Roles(...)` list on the route or controller.
3. **`BusinessScopeGuard`** rejects any `businessId` in the query or body that is not the one inside the caller's token.

Roles: `super_admin`, `admin` (the business owner), `manager`, `accountant`, `cashier`, `waiter`, `kitchen_staff`, `salesman`, `delivery_person`, `guest`.

Things to know:
- `@Roles()` with an empty list means "any logged-in user". A write route with **no** `@Roles` at all is also open to every staff role. Several such routes exist today; check before adding more.
- `super_admin` is the platform owner. `admin` is the owner of one business and must never reach platform-wide data.

### Multi-tenancy: the rule that matters most

Every business-owned table has a `business_id`. **Every query must filter by it**, including raw SQL. Never trust an id from the client without checking that it belongs to the caller's business (customer ids, table ids and product ids are visible in public QR links). Cross-tenant reads were the source of several past security fixes.

### Database

- PostgreSQL through TypeORM 1.0. Entities are in `src/database/entities`, migrations in `src/database/migrations`.
- Migrations run automatically when the API starts (`migrationsRun: true`). With a single API process this is safe. If the API is ever scaled to several processes, move migrations into a one-off deploy step.
- `synchronize` is only on for local databases (no `DATABASE_URL`). Never rely on it. Write a migration for every schema change.
- Set `DATABASE_URL` for a managed database (SSL is required). Without it the API uses the `DB_*` variables.
- Money columns are numeric and arrive as strings from Postgres, so convert with `Number()` and round at the edge.

### Time and dates

Business days are **Indian days (IST)**, whatever timezone the server uses. The code that builds date ranges for reports assumes the API server and Postgres both run in **UTC**. If either is changed, report day boundaries will shift. When adding date filters, parse a bare `YYYY-MM-DD` as that day in IST (`+05:30`).

### Subscriptions and the paywall

A global interceptor (`SubscriptionPaywallInterceptor`) enforces plan limits and returns HTTP 402 with a reason. Set `PAYWALL_ENFORCED=false` to switch enforcement off without a deploy. Plan upgrades go through an approval flow: the owner requests, a super admin approves.

### Files

Uploads go to S3-compatible object storage, not the server disk. Buckets: `product-images` (public), `prescriptions` (private, short-lived URLs), `invoice-scans` (legacy), `app-releases` (APKs and OTA bundles). Credentials come from the standard `AWS_*` variables.

### Integrations

| Service | Used for | Config |
|---|---|---|
| Evolution API | WhatsApp messages and inbound order messages | `EVOLUTION_API_*`, `WHATSAPP_WEBHOOK_SECRET` |
| Google Gemini | Order parsing, invoice OCR | `GEMINI_API_KEY` (+ `_2`) |
| Firebase FCM | Push notifications | `FIREBASE_SERVICE_ACCOUNT` |
| SMTP / `apps/mailer` | OTP and notification email | `SMTP_*` or `EMAIL_PROXY_*` |
| Google sign-in | Login | `GOOGLE_CLIENT_ID` |
| Google Sheets | Read-only order feed for the owner's sheet (`tools/google-sheets-sync`) | `SHEETS_SYNC_KEY` |

Variables are listed in [`.env.example`](../.env.example).

## Web app (`apps/web`)

- **Routing:** Next.js App Router under `app/`. Public pages (home, `/signup`, `/login`, `/terms`, `/privacy-policy` and the pharmacy SEO pages) have no app shell. Logged-in screens wrap themselves in `components/app-shell.tsx`.
- **Staff app routes:** `/dashboard`, `/orders`, `/products`, `/inventory`, `/customers`, `/billing`, `/reports`, `/restaurant`, `/salesman`, `/staff`, `/settings`. These are blocked in `robots.txt` and return `X-Robots-Tag: noindex`.
- **Super admin:** `/admin/*`, only for the `super_admin` role.
- **API calls:** go through `lib/api-client.ts` (axios; adds the login token and handles expired sessions).
- **SEO pages:** server-rendered, no client JavaScript. The pharmacy pages share `components/seo/seo-page.tsx`. Update `public/sitemap.xml` when you add a public page.
- **Styling:** Tailwind CSS 4. The site loads Plus Jakarta Sans.

### Android app

`npm run build:capacitor --workspace=web` produces a static export (`app-export`), which Capacitor copies into `android/`. Because it is a static export, pages that need a server (route handlers, middleware) do not work in the app.

Three release paths, each a GitHub Actions workflow in `.github/workflows/`:
- **OTA bundle** (`release-ota.yml`, or `npm run release:ota`): new web code to installed apps without a store release. Served by the `app-updates` module.
- **Direct APK** (`release-apk.yml`): downloadable APK, hosted by `app-apk-releases`.
- **Play Store AAB** (`release-playstore.yml`).

## Quality gates

- **CI** (`.github/workflows/ci.yml`) runs on every pull request: API typecheck and build, web typecheck and build (the Capacitor export), and a dependency audit. **CI does not run the unit tests.** Run them locally, see [development.md](development.md).
- `keep-alive.yml` pings the API on a schedule.
- A Vercel preview check also runs on pull requests. Production is not served from Vercel, and that check has been failing for a long time, so it does not block merging.
