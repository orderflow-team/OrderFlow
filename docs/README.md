# Documentation

| I want to... | Read |
|---|---|
| Understand how the system is built | [architecture.md](architecture.md) |
| Run the project and write code | [development.md](development.md) |
| Deploy or roll back a release | [deployment.md](deployment.md) |
| Look up an API endpoint or test it with cURL | [api-reference.md](api-reference.md) |
| Open a pull request | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| See the environment variables | [../.env.example](../.env.example) |

## More detail

- **Docker-based deployment** (an alternative to the current pm2 setup): [deployment/docker-vps-guide.md](deployment/docker-vps-guide.md), [deployment/devops-handover.md](deployment/devops-handover.md)
- **Database restore:** [deployment/database-restore.md](deployment/database-restore.md) (script: `../scripts/restore-vps-db.sh`)
- **Moving servers:** [deployment/vps-migration.md](deployment/vps-migration.md)
- **Archive** (history only): [archive/week1-summary.md](archive/week1-summary.md)

## Keeping the docs useful

- Update the docs in the same pull request as the change they describe.
- New environment variable: add it to `.env.example` with a one-line comment.
- New API module: add a row to the module table in `architecture.md`.
- If you find something here that is wrong, fix it or open an issue. Wrong docs are worse than none.
