# Deployment

How production runs and how to release a new version.

## How production runs today

| Piece | Setup |
|---|---|
| Host | Ubuntu VPS serving https://obix360.com |
| Reverse proxy | Apache2 in front of the API and the web app |
| API | `packages/api` (compiled to `dist/`, start command `npm run start:prod`), kept alive by **pm2** |
| Web | `apps/web` (Next.js production server), kept alive by **pm2** |
| Database | PostgreSQL (`DATABASE_URL`) |
| Files | S3-compatible object storage |

The names of the pm2 processes, the install directory and the ports are set on the server. Ask whoever runs it, or check `pm2 ls`. The API's default production port is 3001.

The Docker Compose guides in [deployment/](deployment/) describe an alternative container setup that production does **not** use.

## Before you release

Check these, they are what has gone wrong before:

1. **What is unreleased?** `git log <last-deployed-commit>..origin/main --oneline`. Read the list; do not deploy blind.
2. **New environment variables?** Compare `.env.example` with the server's API `.env`. A missing required variable (for example `JWT_SECRET` or `WHATSAPP_WEBHOOK_SECRET`) stops the API from starting.
3. **New migrations?** Look for new files in `packages/api/src/database/migrations`. They run automatically on API start, so a bad migration fails the start. Take a database backup before releasing a schema change.
4. **CI is green** on the merge commit (ignore the Vercel preview check).

## Release steps (web and API)

On the server, in the project directory:

```bash
git checkout main && git pull origin main
git log -1 --oneline                  # confirm the commit you expect
npm ci
npm run build:api                     # compiles packages/api into dist/
npm run build:web                     # next build
pm2 restart <api-name> --update-env
pm2 restart <web-name> --update-env
pm2 logs <api-name> --lines 100 --nostream
```

Important:
- **Build before restart.** The API runs from the compiled `dist/` folder. `git pull` plus `pm2 restart` alone keeps running the old code.
- Rebuild **both** the API and the web app, even if you only changed one.
- Use `--update-env` so pm2 picks up changes to the environment.

## Verify the release

1. `pm2 ls` shows both processes `online` and not restarting repeatedly.
2. The API log shows no startup or migration errors.
3. Log in on the site.
4. Check a route added in this release. A "Cannot GET ..." 404 from the API means the old build is still running.
5. `curl https://obix360.com/api/health` returns `{"status":"ok", ...}`. The scheduled "API health check" workflow calls the same address, so it should stay green.
6. For SEO or content changes, open the live page and `/sitemap.xml`.

## Roll back

```bash
git checkout <previous-good-commit>
npm ci && npm run build:api && npm run build:web
pm2 restart <api-name> --update-env && pm2 restart <web-name> --update-env
```

Migrations only move forward. Rolling back the code does **not** undo a migration. If a release included one, decide whether the old code works with the new schema before rolling back, or restore from the backup.

## Mobile app releases

Web changes reach the Android app only through a mobile release:

| Goal | How |
|---|---|
| Ship new web code to installed apps | OTA bundle: GitHub Actions "Release OTA Bundle", or `npm run release:ota --workspace=web` |
| New downloadable APK | "Release APK (direct distribution)" workflow |
| Play Store build | "Release AAB (Play Store)" workflow |

A website release on the VPS does **not** update the installed apps. Run an OTA release after changes that affect the app screens.

## Database restore and migration

- [Restore procedure](deployment/database-restore.md) and the helper `scripts/restore-vps-db.sh`
- [Moving to a new VPS](deployment/vps-migration.md)

## Operations notes

- **Reverse proxy and client IPs:** set `TRUST_PROXY_HOPS` to the number of proxies in front of the API (1 for Apache alone). Wrong values break rate limiting.
- **Time zone:** the server and database should run in UTC. Report day boundaries assume it.
- **Credential key (required in production):** `CREDENTIAL_ENCRYPTION_KEY` encrypts stored staff passwords. It must be 24+ characters and different from `JWT_SECRET`, or the API refuses to start. `JWT_SECRET` can now be rotated freely.
  - *First rollout:* set the new key and deploy. Rows written earlier with `JWT_SECRET` still decrypt. Then run `npm run rotate:credential-key --workspace=api` (dry run), then again with `-- --apply`, so every row uses the new key. Until that finishes, do not change `JWT_SECRET`.
  - *Rotating the credential key later:* move the old value into `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS`, set the new one, redeploy, run the rotate script with `--apply`, then drop the previous key.
- **Emergency switch:** `PAYWALL_ENFORCED=false` turns off subscription enforcement without a deploy.
