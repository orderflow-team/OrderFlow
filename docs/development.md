# Development guide

Everything you need to run, test and change the project on your own machine.

## Prerequisites

- **Node.js 20 or newer** (CI uses 20) and npm 10+
- **PostgreSQL 15.** The simplest way is the repo's `docker-compose.yml`:
  ```bash
  docker compose up -d postgres
  ```
- Optional: Android Studio and `adb` for the Android app.

## First-time setup

```bash
npm install
cp .env.example packages/api/.env.local      # API settings
cp .env.example apps/web/.env.local          # web settings (keep only the WEB block)
```

Fill in the values you need. For basic local work you only need:

| Variable | Why |
|---|---|
| `JWT_SECRET` | The API will not start without it |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Local Postgres (the template defaults match `docker-compose.yml`) |
| `NEXT_PUBLIC_API_URL` | Points the web app at your API, normally `http://localhost:4000` |

Everything else (WhatsApp, Gemini, email, push, storage) is optional locally. Features that need a missing service simply report an error or are skipped. The API reads env files in this order: `.env.local`, `.env` in its own folder, then the repository root.

## Running it

```bash
npm run dev          # API on :4000 and web on :3000, together
npm run dev:api      # API only
npm run dev:web      # web only
```

- With no `PORT` set, the API listens on **4000** in development and **3001** in production.
- On first start the API applies all pending migrations to the database.
- Create the first super admin with `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` set, then:
  ```bash
  npm run bootstrap:admin --workspace=api
  ```
- Seed demo data (admin token required, development only): `POST /api/dev/seed?businessId=<id>`. The other dev routes are destructive: `DELETE /api/dev/clear/:module` and `DELETE /api/dev/clear-all` wipe a business's data. Never call them on a real database.

## Testing

| Suite | Command | Notes |
|---|---|---|
| API unit tests | `npm test` | Jest, ~70 suites, mocks only (no database needed) |
| One API module | `npm test --workspace=api -- reports` | Pass a path or name pattern |
| Web unit tests | `npm test --workspace=web` | Vitest |
| Web end-to-end | `npm run test:e2e --workspace=web` | Playwright; needs a running API and web app, see `apps/web/e2e/` |
| Typecheck | `npx tsc --noEmit` inside `packages/api` or `apps/web` | The same check CI runs. `npm run check-types` only covers `shared` and `ui` |

**CI does not run the unit tests**, it only typechecks, builds and audits dependencies. Run the tests for what you changed before opening a pull request. The API tests use mocked repositories, so they do not prove that raw SQL runs correctly. For new queries, run them once against a real database.

## Database migrations

Never change the schema by editing entities alone. Create a migration:

```bash
# 1. change the entity in packages/api/src/database/entities
# 2. generate the migration (path = where to write it)
npm run migration:generate --workspace=api -- src/database/migrations/AddSomething
# 3. read the generated SQL, then run it
npm run migration:run --workspace=api
```

Other useful commands: `migration:revert` (undo the last migration). Migrations also run automatically when the API starts. Keep them idempotent where possible (`IF NOT EXISTS`) and never edit one that has already been deployed.

## Working on the web app

- Public marketing pages are server components with no client JavaScript. Add a page by creating `app/<slug>/page.tsx`, set `metadata` (title, description, canonical), and add the URL to `public/sitemap.xml`. For the pharmacy guide pages, reuse `components/seo/seo-page.tsx`.
- Staff-app screens live under `app/<feature>` and use `components/app-shell.tsx`.
- Always call the API through `lib/api-client.ts`.
- Check layouts at a **375px phone width**. A horizontally wide table inside a grid is the usual cause of side-scrolling, so give the grid column `min-w-0`.

## Working on the API

1. Add or change code in the feature's folder under `src/modules`.
2. Put `@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)` on new controllers and an explicit `@Roles(...)` on every route.
3. Filter every query by `business_id` and check that ids from the client belong to the caller's business.
4. Add a unit test next to the code (`*.spec.ts`).
5. Add a migration for any schema change.

See [architecture.md](architecture.md) for the rules behind these steps.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| API exits immediately on start | `JWT_SECRET` missing, or the database is unreachable |
| `Cannot find module 'qrcode'` in the web dev server | Dependencies not installed in this worktree; run `npm install` |
| Web app cannot reach the API | `NEXT_PUBLIC_API_URL` wrong, or the origin is missing from `ALLOWED_ORIGINS` |
| WhatsApp or AI features fail | Their keys are not set locally; this is expected |
| Report totals are off by a day | Server or database timezone is not UTC, see the time section in [architecture.md](architecture.md) |
