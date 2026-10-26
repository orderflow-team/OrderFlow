# OrderFlow / OBIX 360 — Security Audit, 2026-10-26

Scope: whole monorepo at `main` @ `ffb65eb` (includes PR #36 returnable containers and the multi-language change).
Method: manual code review of every API controller/guard/service path that matters, the web app, the Android project, CI and deploy files, `npm audit`, and unit tests. **Nothing was run against a real Postgres, a live VPS, Neon storage, or a phone** — those parts are listed under "Could not verify".

No audit can guarantee an application is 100% secure. This report lowers risk; it does not remove it. See "Residual risk".

Fixes are on branch `claude/security-audit-2026-10-26` (pushed, no PR opened).

---

## 1. Fixed in this branch

### HIGH

**H1. Any signed-up user could delete (or probe) arbitrary files on the API server — path traversal through `logoUrl`.**
- `PATCH /api/businesses/:id` accepted a free-text `logoUrl` and stored it (`businesses.service.ts` `update`, `create`). `deleteLogoFile` / `deleteUpiQrFile` then did `fs.unlink(uploadsFilePathFromUrl(url))` whenever the string merely *contained* `/uploads/logos/`, and `uploadsFilePathFromUrl` (`common/utils/public-url.util.ts`) did a bare `path.join(cwd, pathname)`.
- Exploit: set `logoUrl` to `/uploads/logos/../../.env.local` (not an http URL, so `URL()` never normalises it), then `DELETE /api/businesses/:id/logo` → the API process deletes `.env.local` (or `dist/`, other files it can write). Every self-signup owner is `ADMIN`, so this was reachable by anyone. The same stored value also made `loadImageDataUri` read any `.png/.jpg/.gif/.webp` file on disk into invoices.
- Fix: `uploadsFilePathFromUrl` now resolves and throws unless the result is inside `<cwd>/uploads`; callers handle the throw; `logoUrl` is no longer client-settable (logos only go through the validated `POST :id/logo` upload). Test: `common/utils/public-url.util.spec.ts`.

**H2. Tenant-controlled text rendered by server-side Chromium with JavaScript on and no request filter (SSRF / local file read into the PDF).**
- `escapeHtml` in `billing/templates/invoice.template.ts` did not escape `"` or `'`, but the business name is interpolated into `alt="…"` (lines ~202, 351, 570). A business name like `x" onload="…` injects an event handler; `PdfService` renders that HTML in a `--no-sandbox` Chromium with JS enabled and unrestricted network/file access, so injected script (or an `<iframe src="http://127.0.0.1:…">` / `file:///…`) is rendered into the invoice PDF the attacker then downloads. The thermal/A4 receipt endpoints return the same HTML to the browser as well.
- Fix: `escapeHtml` escapes quotes; names are truncated before escaping (the old `.slice(0,20)` after escaping could cut an entity); the PDF page now has JS disabled and all requests except `data:` aborted (`pdf.service.ts`). Tests: `invoice.template.spec.ts`, assertions added to `pdf.service.spec.ts`.

**H3. Vulnerable Next.js, Capacitor, DOMPurify in the shipped web app.**
- `apps/web` was on Next 16.3.8: advisories GHSA-2464-fhr4-w9xw (unauthenticated RCE in the image-optimisation API), GHSA-673q-mjm6-r5xr (RCE in `use cache`), GHSA-p3m5-59mp-jv5r (DoS in Server Actions), all fixed in ≥16.4.1. The production web app is `next start` behind Apache, so the server is reachable. Also `@capacitor/android` 8.5.0 (critical: remote content loaded at the app origin), DOMPurify ≤3.4.16 (critical, via jspdf/html2pdf), `shell-quote`, `compression`, `zod`.
- Fix: `next` ^16.4.3, `@capacitor/{android,core,cli}` ^8.5.3, `zod` ^4.6.7, root `overrides` for `dompurify`, `shell-quote`, `compression`. `npm audit` (web, production deps): critical 4 → 0. API: 0 vulnerabilities at any level.
- Remaining web highs are in packages that are not shipped or are build-time only (Expo/React-Native packages pulled in as peers of `@react-three/fiber`, the `shadcn` CLI, `image-size`/`postcss`/`source-map-js` in the Next build, a nested `undici` in `@expo/cli`).
- **Needs deploy:** `npm ci`, rebuild web, restart; Capacitor fix reaches phones only with a new APK/AAB (OTA cannot update native code).

**H4. Production database could run with `synchronize: true` and full SQL query logging.**
- `database/database.config.ts` only switched these off when `DATABASE_URL` was set. `scripts/restore-vps-db.sh` shows the VPS uses a local Postgres via `sudo -u postgres`; if the API there is configured with `DB_HOST/DB_PASSWORD` (the documented local mode), TypeORM auto-alters the live schema on every boot and logs every query — including OTP codes, password hashes, staff passwords and phone numbers — to the pm2 logs.
- Fix: both are now development-only (`NODE_ENV !== 'production'`); `DB_LOG_QUERIES=true` still opts in. **Owner action:** confirm `NODE_ENV=production` is set in the pm2 environment, and if query logging was on, clear/rotate old pm2 logs (see section 4).

**H5. Restore script and docs reset the super-admin and owner passwords to the known string `admin123`.**
- `scripts/restore-vps-db.sh` lines 28–29 and `docs/deployment/database-restore.md` steps C/D/5. Anyone who read the repo (or the PDF copy) knew the password for `admin.cleverminds@gmail.com`, a super admin, if the script was ever run on production.
- Fix: removed; the script now only resets a password when `RESTORE_ADMIN_EMAIL` and `RESTORE_ADMIN_PASSWORD` are exported (sent on stdin, not the command line). **Owner action: assume the prod passwords may still be `admin123`; set new ones now (section 4).**

### MEDIUM

| # | Finding | Fix |
|---|---|---|
| M1 | Destructive routes open to every staff role (cashier, waiter, kitchen, delivery, salesman): delete customer / supplier / expense / category / order, B2B connection request/accept/reject/remove, push test. (`customers.controller.ts`, `suppliers.controller.ts`, `expenses.controller.ts`, `categories.controller.ts`, `orders.controller.ts` `remove`, `business-connections.controller.ts`, `notifications.controller.ts`) | `@Roles(ADMIN, MANAGER)` plus `RolesGuard` on those controllers. Test: `src/security-route-roles.spec.ts`. The web app has no per-role UI gating, so this matches how product/inventory delete already worked. |
| M2 | Store-limit (paywall) bypass: `POST /api/businesses` (`create`) had no role or plan check; `onboard` enforces `maxStores`, `create` did not. Any owner could mint unlimited businesses and switch with `:id/select`. Any staff role could also call onboard/select and move themselves to a new tenant. | `create` is SUPER_ADMIN only; `onboard` and `select` are ADMIN only. The web app never calls `create`. |
| M3 | OTP brute-force limit could be exceeded: the attempt counter was read-then-written, so parallel guesses at one email all saw the same count (login OTP, signup OTP, password-reset code). | Per-email serialisation (`auth/serial-by-key.ts`, test `serial-by-key.spec.ts`). Single-process only; see residual risk. |
| M4 | Order responses exposed the creator's whole user row (email, `google_id`, role, `sessions_valid_after`, MFA flag) to anyone who can read the order, including table QR guests (`orders.service.ts` `sanitizeCreatedBy` only dropped `password_hash`). | Allow-list: `id`, `full_name`, `role` (the web app only uses `full_name`). |
| M5 | Table/takeaway guests could list draft (unpublished) products by passing `isDraft=true/all` (`products.controller.ts` guest branch). | Guests always get the default non-draft list. |
| M6 | Deleting a business left its `container_ledger` rows behind (no foreign keys on that table), so customer-linked data survived "permanently deleted". | `deleteAccount` now deletes them (`businesses.service.ts`). |
| M7 | Referral farming: the same owner could refer their own second store for +30 days each time; `apply-referral` was open to any staff role and 500'd on a non-string code. | Same-owner referrals rejected; ADMIN only; type check. Test added. A global cap per referrer is an owner decision (below). |

### LOW (fixed)
- `platform-admin.service.ts` `updateStoreSubscription`: raw `dto.extend_days` was interpolated into an `INTERVAL '…'` string; now uses the clamped integer (super-admin only, so no practical exploit).

---

## 2. Open findings (not fixed here — need your decision or a larger change)

### HIGH / MEDIUM
1. **Role matrix is still incomplete (MEDIUM).** Writes still open to every staff role: `PATCH /api/customers/:id` (including `credit_limit`), `POST` customers/suppliers/categories/expenses, order `PATCH :id/status`, `POST :id/return`, `PUT :id/items`, `POST /api/containers/returns`, `POST /api/staff/...` is already ADMIN/MANAGER. Reads open to every role: `/api/reports/dashboard` (revenue), billing invoices/payments lists, stock history, salesman list. I changed only the unambiguous destructive routes because a wrong role list breaks real shop workflows (e.g. delivery staff must update order status). Decision needed: a role × route table, then an automated test over all routes (a starting point is `security-route-roles.spec.ts`).
2. **OTA integrity depends on two optional env vars (MEDIUM).** The server only requires a signature if `OTA_PUBLIC_KEY` is set (`app-updates.service.ts:~70`), and the app only verifies if `NEXT_PUBLIC_OTA_PUBLIC_KEY` was compiled in (`apps/web/lib/ota-updater.ts:79–92` — otherwise it logs a warning and applies the bundle unsigned). The code is correct; whether it is *protecting you* depends on production config I cannot see. APK updates are safe regardless of this: Android refuses an update not signed with the installed app's key.
3. **Referral reward has no cap (MEDIUM, product decision).** With throwaway emails someone can still chain referrals for unlimited Pro days.
4. **Login lockout is per email and in memory (LOW–MEDIUM).** Anyone can lock a victim out of password sign-in for 15 minutes with 10 wrong passwords (OTP/Google still work); counters reset on restart.
5. **Guest checkout can pick `fulfillment: 'pickup'` (LOW).** For dual-priced (water/containers) products a table-QR guest can buy at the cheaper pickup price. Force `delivery` for table guests if that matters to you.
6. **Container ledger (PR #36) review — no security defects found; integrity notes (LOW).** All three endpoints and the order hooks are tenant-scoped (`business_id` from the guarded token, customer/product re-validated against it). `returnedQuantity` on an order line is unbounded by what was delivered; `pending` is computed from the ledger so it simply floors at 0, but a staff member can record returns that were never delivered. The migration is additive and idempotent; no FKs on `container_ledger` (hence M6).
7. **Tokens are stored unencrypted (LOW–MEDIUM).** Web: `localStorage`. Android: mirrored into Capacitor Preferences (SharedPreferences) for 30-day refresh tokens. `allowBackup=false` and the CSP reduce exposure; Keystore-backed storage and shorter refresh lifetime would reduce it further.
8. **Webhook secret travels in the URL query** (`/api/whatsapp/webhook?token=…`), so it can appear in Apache access logs. Compare in a header if the gateway can send one, or exclude that path from access logging.
9. **No `helmet`; CSP keeps `'unsafe-inline'` for scripts and styles** (`apps/web/lib/csp.ts`, documented known gap). The headers that matter are set manually in `main.ts` and `next.config.ts`. `connect-src` is an allowlist, which limits token exfiltration.
10. **Unbounded text fields** (`notes`, `customerName`, `customProductName` have no `@MaxLength`); the 100 kb body limit bounds it. `POST /auth/table-guest-login` takes a raw `tableId` (non-UUID → database error 500, not a security issue).
11. **Android (LOW):** `minifyEnabled false` (no code shrinking/obfuscation); `file_paths.xml` exposes all external storage (the provider is not exported, so only usable via granted URIs); `REQUEST_INSTALL_PACKAGES` is a Play Store policy risk for the store build; `google-services.json` with a Firebase client key is committed (normal, but restrict the key to the app's package + SHA in Google Cloud).
12. **CI runs typecheck, build and `npm audit` but not the unit tests**, and the API audit gate is `--audit-level=high` (fine). Add `npx jest` to CI.
13. **`docker-compose.prod.yml` is not what production runs (pm2), and is inconsistent:** it points `DATABASE_URL` at a plain-text Postgres (`sslmode=disable`) while `database.config.ts` forces `ssl: { rejectUnauthorized: true }` for any `DATABASE_URL`, so that stack would fail to connect. `docker-compose.yml` (dev) publishes Postgres on `127.0.0.1` with `password123` — fine locally.
14. **Intentional design, flagged for awareness:** owners can view staff passwords (encrypted, `CREDENTIAL_ENCRYPTION_KEY`); `/api/billing/invoices/public/pdf?token=` is public by a 192-bit, 15-minute token (clean); `GET /api/app-apk-releases/latest` and `/api/app-updates/latest` are public by design.

---

## 3. Verified fixed on current main (earlier audits)

| Earlier finding | Status |
|---|---|
| Free paid plan via `simulate-upgrade` | **Fixed**: SUPER_ADMIN only (`subscriptions.controller.ts`); owners use the approve-by-admin request flow. |
| Public WhatsApp webhook | **Fixed**: `?token=` compared in constant time, fails closed if `WHATSAPP_WEBHOOK_SECRET` unset (`whatsapp-webhook.controller.ts`). |
| Release-upload role bug | **Fixed**: APK and OTA create/rollback are SUPER_ADMIN only. |
| Receipt XSS (web) | **Fixed**: `lib/receipt-template.ts` escapes quotes and allow-lists image URLs. **The server-side twin was still vulnerable — H2.** |
| invoice-scans bucket exposure | **Fixed in code**: `invoice-scans-private` (no public access), presigned reads, boot-time migration; prescriptions bucket private. `invoice-scans` legacy bucket still `public_read` in `neon.ts` until it is empty. |
| Public invoice PDFs under `/uploads/invoices` | **Fixed**: path returns 404; PDFs under `storage/invoices/<id>.pdf`, served only via authenticated route or share token. |
| Guest lockdown | **Fixed**: GUEST tokens denied by default; only seven `@AllowGuest()` routes (orders create/list/view/add-items, products and categories list, tables list), the order ones scoped to the guest's table/takeaway. |
| `ILike(email)` wildcard account takeover, `SignupDto.businessId`, salesman link takeover | **Fixed** (`emailMatches` exact match used for every lookup; fields removed/validated). |
| Paywall guard never ran | **Fixed**: `SubscriptionPaywallInterceptor` with wiring test. |
| Dev OTP leakage | **Clean**: OTP only returned if `ALLOW_OTP_DEV_BYPASS=true` and email failed. |
| admin123 caveat | Repo copies removed (H5). **Production value must still be checked.** |
| MRP enforcement / pharmacy items | Out of scope of this run; not re-verified. |

## 4. What was checked and found clean

- **Auth:** bcrypt cost 10; `randomInt` for all OTPs; OTP expiry, per-code attempt counter, cooldown; password reset and change invalidate older sessions (`sessions_valid_after`, checked in `JwtStrategy` and `refresh`); disabled/deleted users are rejected on every request; access token 1 h, refresh 30 d, MFA challenge token cannot be used as a session; impersonation token 1 h with `impersonatedBy` and audit log; TOTP with step replay protection, per-user lockout and hashed recovery codes; Google sign-in checks audience and `email_verified`; the new Google handoff uses `randomBytes` ids, hashed 6-digit code and `timingSafeEqual`; guest tokens carry only the table/business and are blocked from non-guest routes.
- **Tenant isolation:** `BusinessScopeGuard` forces the caller's own `businessId` into query and body and rejects mismatches or missing tenant; every service lookup I traced filters by `business_id` (orders, customers, products, invoices, payments, invoice scans, containers, connections — recipient/party checks on B2B actions). No unscoped `findOne({ id })` found outside the intentionally global ones (platform admin, businesses owner checks, share token).
- **SQL injection:** no string-built `WHERE` with user input; the few `INTERVAL '${n}'` splices use code constants or integers; dev-tools table names are constants; LIKE patterns escaped (`escapeLikePattern`).
- **Uploads:** every upload checks magic bytes against the declared type (`detect-file-type.util.ts`), size limits (5 MB images, 15 MB scans, 150 MB APK), random UUID keys; SVG/HTML rejected by construction; buckets: private for prescriptions and invoice scans, presigned 1 h reads.
- **SSRF:** all outbound HTTP goes to fixed hosts (Google, Evolution gateway from env, mail proxy). The web `api-proxy` route only forwards to configured origins.
- **Secrets:** no live keys in tracked files (scanned for AWS/Google/Stripe/GitHub/private-key/DB-URL patterns). `.env*`, keystores gitignored. Only committed credential-like values: dev compose password, `.env.example` placeholders, Firebase client config. API refuses to start in production without `JWT_SECRET`, with a missing/shared `CREDENTIAL_ENCRYPTION_KEY`, or without a DB password.
- **CORS** allow-list (no reflection), credentials only for listed origins; `trust proxy` limited to N hops; throttling global 300/min and 5–10/min on auth routes.
- **Headers:** web: nosniff, DENY framing, strict referrer policy, HSTS, CSP with `connect-src` allow-list and `object-src 'none'`; API: nosniff/DENY/no-referrer.
- **Android:** `allowBackup=false`, `usesCleartextTraffic=false`, single exported activity (launcher only), no deep-link intent filters, provider not exported, no `server.url` in Capacitor config, APK update verifies SHA-256 and Android enforces signing-key match.
- **CI/CD:** workflows use `permissions: contents: read`, `persist-credentials: false`, first-party actions only, workflow inputs passed through env (no script injection), signing key and ADMIN_TOKEN as secrets, OTA private key kept out of the server.
- **Dockerfile:** runs as non-root `node`; only `storage/invoices` writable.
- **Migrations:** `1789000000000-AddReturnableContainers` is additive, `IF NOT EXISTS`, safe to re-run. Migrations run on API boot (`migrationsRun: true`); fine for a single pm2 process, risky if the API is ever scaled to several instances at once.
- **Multi-language change:** UI strings come from bundled JSON, no remote loading. `escapeValue: false` is safe with React as long as translated strings are never put into `dangerouslySetInnerHTML`/`document.write` (none are today; keep it that way).

## 5. Could not verify

- Anything needing the real VPS: actual env vars (`NODE_ENV`, `OTA_PUBLIC_KEY`, `WHATSAPP_WEBHOOK_SECRET`, `EVOLUTION_API_KEY`, `CREDENTIAL_ENCRYPTION_KEY`, `TRUST_PROXY_HOPS`), Apache config (TLS versions, access-log contents, which paths are proxied), server patch level, Postgres exposure to the internet, backups, pm2 log contents, file permissions of `.env*`.
- Real-Postgres behaviour (no database was available): the SQL in the container ledger and new reports, locking/race behaviour, the migration run. Reasoned from code and unit tests only.
- Neon bucket ACLs in the live project (read from `neon.ts` only).
- The Android build on a device, Play Console settings, Google Cloud API-key restrictions.
- Penetration testing of the live site, dependency behaviour at runtime, performance/DoS resistance.

---

## 6. Owner actions (production)

**Do first**
1. **Set new passwords for every super-admin and owner account that may have been reset by the restore script/docs to `admin123`** (`admin.cleverminds@gmail.com`, `bhattneel2004@gmail.com`). Then test that `admin123` no longer logs in. Turn on `MFA_REQUIRED_FOR_SUPER_ADMIN=true` after the super admin has enrolled.
2. **Deploy this branch** (after review/merge): `git pull`, `npm ci`, `npm run build:api`, `npm run build:web`, `pm2 restart <api> <web> --update-env`. This closes H1–H4. No migrations in this branch.
3. **Confirm `NODE_ENV=production`** in the pm2 environment for the API (affects `synchronize`/logging and the credential-key and DB-password startup checks). If query logging may have been on, review and rotate the pm2 logs; treat OTPs/hashes in them as exposed and rotate any secrets that appear.
4. **Check for damage from H1** before the fix is live: look for missing files under the API directory, and in the database for businesses whose `logo_url`/`upi_qr_url` contains `..` (`SELECT id, name, logo_url, upi_qr_url FROM businesses WHERE logo_url LIKE '%..%' OR upi_qr_url LIKE '%..%';`). Also check business names containing `"` or `<` (H2).

**Soon**
5. Set/verify env: `OTA_PUBLIC_KEY` on the server and the GitHub variable `OTA_PUBLIC_KEY` so builds embed `NEXT_PUBLIC_OTA_PUBLIC_KEY`; `WHATSAPP_WEBHOOK_SECRET`; `EVOLUTION_API_KEY` (rotate if it ever lived in code); `CREDENTIAL_ENCRYPTION_KEY` different from `JWT_SECRET`; `TRUST_PROXY_HOPS` matching the proxy chain; `ALLOWED_ORIGINS`.
6. Ship a new APK/AAB so phones get the patched Capacitor (OTA cannot).
7. Restrict the Firebase/Google API key (package name + SHA-1) in Google Cloud.
8. Decide the role matrix (finding 1), a referral cap (3), and whether table guests may use pickup pricing (5).
9. Ensure database backups exist and a restore has been tried; set up uptime/error alerting (the `/api/health` GitHub check exists; add error tracking and a log-based alert on repeated 401/403 spikes).
10. Delete `packages/api/uploads/invoices/` on the server if it still exists (old public PDFs), and drain/delete the legacy `invoice-scans` bucket in the Neon Console.

## 7. Residual risk and recommended follow-ups

- This was a code review plus automated checks, not a penetration test. Business-logic abuse (pricing, credit limits, stock, returns), the role matrix, and the multi-tenant design are the highest-risk areas of this application because tenancy is enforced by hand in each service, not by the database. A single missed `business_id` filter in new code is a cross-tenant leak. Consider Postgres row-level security as a second layer.
- Get an external penetration test before or soon after hand-over, focused on auth, tenant isolation, file upload/PDF rendering, and the OTA channel.
- Keep dependencies monitored (Dependabot is already on for GitHub Actions; enable it for npm and add `npm audit` alerting). Re-run `npm audit` before every release.
- Run the API unit tests in CI; add route×role and tenant-isolation tests that run against a real Postgres in CI.
- Add centralised logging with alerts (failed logins, OTP spikes, 403s, impersonation, release uploads, account deletion).
- The OTP serialisation (M3) and login lockout are in-process: if the API is ever run as more than one process or instance, move them to the database or Redis.
- Rotate `JWT_SECRET`/`CREDENTIAL_ENCRYPTION_KEY` on a schedule using the documented process (set `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` first).
