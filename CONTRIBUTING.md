# Contributing

How to make a change and get it merged. For setup, see [docs/development.md](docs/development.md).

## Workflow

1. **Branch from `main`.** Use a short descriptive name, for example `fix/report-day-boundaries` or `feat/supplier-returns`.
2. **Make a small, focused change.** One pull request should do one thing.
3. **Test it.** Run the tests for what you touched (CI does not run unit tests) and typecheck.
4. **Open a pull request into `main`** and describe what changed, why, and how you checked it.
5. **Wait for CI**, address review comments, then merge with a merge commit.
6. **Deploy** follows the steps in [docs/deployment.md](docs/deployment.md). Merging does not deploy.

## Commit messages

Use the conventional style already in the history:

```
feat(reports): money in/out report
fix(orders): manual WhatsApp send no longer reports success when nothing was sent
chore(deps): bump handlebars to 4.7.10
docs: rewrite README and add architecture guide
```

Format: `type(scope): summary in lower case`. Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`. Put the reason for the change in the body when it is not obvious.

## Before you open the pull request

- [ ] Tests for the changed module pass (`npm test --workspace=api -- <module>` or `npm test --workspace=web`).
- [ ] `npx tsc --noEmit` is clean in `packages/api` or `apps/web`.
- [ ] New or changed queries filter by `business_id` and check ids from the client.
- [ ] New API routes have explicit `@Roles(...)`.
- [ ] Schema change has a migration; new env variable is in `.env.example`.
- [ ] UI changes were checked at a 375px phone width.
- [ ] No secrets, tokens or real customer data in the diff.
- [ ] Docs updated if behaviour, commands or variables changed.

## What CI checks

API typecheck and build, web typecheck and build, and a dependency audit that blocks on **critical** advisories. It does not run the unit tests. A failing Vercel preview check is a known issue and does not block merging.

## Security

Never post secrets or customer data in issues, pull requests or logs. If you find a vulnerability, tell a maintainer directly instead of opening a public issue.
