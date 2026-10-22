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

## Signed OTA updates

Installed apps download new web bundles from `/api/app-updates/latest` and run them. The URL and checksum come from the same server, so on their own they prove nothing about who published the bundle. Releases are therefore signed with an offline key, and each app only applies a bundle that verifies against the public key built into it. A stolen super-admin token, a compromised API host or a compromised storage bucket can no longer publish code to the apps.

- **Algorithm:** ECDSA P-256 / SHA-256 over `obix-ota-v1\n<platform>\n<version>\n<checksum>`. The signature ties the bundle to its platform and version, so it cannot be re-labelled as another release.
- **One-time setup:** run `node apps/web/scripts/ota-keygen.mjs` on a trusted machine. Store the private key in a password manager and as the GitHub secret `OTA_SIGNING_PRIVATE_KEY`. Set the public key as the GitHub **variable** `OTA_PUBLIC_KEY` (the release workflows refuse to build without it) and as `OTA_PUBLIC_KEY` on the API.
- **Releasing:** the `Release OTA Bundle` workflow signs automatically. From a machine, set `OTA_SIGNING_PRIVATE_KEY` and run `scripts/release-ota.mjs` as before.
- **Rollout order:**
  1. Set the variable and secret, then publish one signed OTA release. Apps installed before this change do not verify, so they apply it, and from then on they do.
  2. Check an updated device logs `[OTA]` lines without `WITHOUT signature verification`.
  3. Set `OTA_PUBLIC_KEY` on the API. From then on it rejects unsigned uploads.
  Until step 1 reaches a device, that device still accepts unsigned bundles. New APK builds carry the key from the start.
- **Rolling back** a bad release still works: deactivating it makes the previous (also signed) release the latest again.
- **Losing the private key** means installed apps cannot be moved to a new key by OTA, because they trust only the key they were built with. Ship a new APK with the new public key. Keep a backup.
- **Not covered:** the direct-download APK. Android already refuses an update signed with a different key, but a person installing the APK for the first time trusts whatever `/api/app-apk-releases/download` serves. Publish the APK's SHA-256 next to the download link if that matters to you.

## Two-factor authentication

Every account can turn on two-factor authentication at `/security` (also linked from Settings and the admin menu). It uses an authenticator app (any TOTP app: Google Authenticator, Microsoft Authenticator, Authy, 1Password) and 10 single-use recovery codes.

- **Where it applies:** every way of signing in: password, emailed code, Google, and the sign-in that follows a password reset. The first step returns a five-minute challenge instead of tokens; the app asks for the code and exchanges the challenge for a session. A challenge cannot be used as an access or refresh token.
- **Protection against guessing and replay:** a code works once (its 30-second step is recorded), and 10 wrong codes lock the account's second-factor attempts for 15 minutes (recovery codes still work). Enrollment secrets are stored encrypted with the credential key (`CREDENTIAL_ENCRYPTION_KEY`), recovery codes as hashes.
- **Requiring it for super admins:** set `MFA_REQUIRED_FOR_SUPER_ADMIN=true` on the API. A super admin who has not enrolled can then reach only the setup routes (the web app sends them to `/security`), and cannot turn it off. Enroll your own super admin account first, with the flag still off, and save the recovery codes. Then turn the flag on.
- **Rollout:** deploy (the migration adds four columns to `users`), enroll your own super admin, confirm a fresh sign-in asks for the code, then set the flag. Existing sessions keep working; MFA is asked for at the next sign-in.
- **Lost phone and lost recovery codes:** an operator runs `npm run reset:mfa --workspace=api -- someone@example.com` (a dry run), then again with `--apply`. It turns MFA off and signs the account out everywhere. Confirm the person's identity by another route first. A super admin is asked to enroll again at next sign-in when the flag is on.
- **Clock:** codes depend on the phone's clock. The server accepts one 30-second step either side.
- **Accounts that sign in with Google only:** they still get the code step after Google accepts them, so Google's own security is not the only barrier.

## Operations notes

- **Reverse proxy and client IPs:** set `TRUST_PROXY_HOPS` to the number of proxies in front of the API (1 for Apache alone). Wrong values break rate limiting.
- **Time zone:** the server and database should run in UTC. Report day boundaries assume it.
- **Credential key (required in production):** `CREDENTIAL_ENCRYPTION_KEY` encrypts stored staff passwords. It must be 24+ characters and different from `JWT_SECRET`, or the API refuses to start. `JWT_SECRET` can now be rotated freely.
  - *First rollout:* set the new key and deploy. Rows written earlier with `JWT_SECRET` still decrypt. Then run `npm run rotate:credential-key --workspace=api` (dry run), then again with `-- --apply`, so every row uses the new key (this covers staff passwords and two-factor secrets). Until that finishes, do not change `JWT_SECRET`.
  - *Rotating the credential key later:* move the old value into `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS`, set the new one, redeploy, run the rotate script with `--apply`, then drop the previous key. Keep the previous key until the script reports nothing left: a two-factor secret it can no longer open locks that user out.
- **Emergency switch:** `PAYWALL_ENFORCED=false` turns off subscription enforcement without a deploy.
