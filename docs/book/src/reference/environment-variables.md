# Environment Variables

SoilFER LIMS reads its server configuration from the `.env` file in the project root directory (`/opt/soilfer-lims/.env`).

---

## Supported Environment Variables

| Variable | Default | Required | Description |
| :--- | :--- | :---: | :--- |
| `PORT` | `3000` | No | Internal HTTP port on which the Node.js server listens (or host bind such as `127.0.0.1:3000`). |
| `NODE_ENV` | `production` | No | Runtime environment (`production`, `development`, or `test`). Always use `production` on deployed servers. |
| `DEPLOYMENT_MODE` | `local` | No | `local` for a single laboratory (initial `admin` is `LAB_MANAGER`) or `global` for a multi-laboratory network (initial `admin` is `SUPER_ADMIN`). |
| `JWT_SECRET` | *(auto-generated & persisted in `prisma/.jwt_secret`)* | No | Secret key used to sign login JWT tokens and HMAC cursors. If left blank, a cryptographic secret is generated and persisted on first boot. Setting an explicit 64+ character random string is recommended for production. |
| `ADMIN_INITIAL_PASSWORD` | *(randomly generated on first boot)* | No | Optional initial password for the `admin` account when seeding a brand-new database. If omitted, a random password is generated and printed once in the startup logs. |
| `DATABASE_URL` | `file:./dev.db` | No | SQLite database file path used by Prisma ORM inside `/app/server/prisma`. |
| `DISABLE_BACKGROUND_JOBS` | `false` | No | When set to `true` during pre-exposure upgrade verification (see `docs/UPGRADING.md`), suppresses background schedulers so zero background writes occur before cutover commitment. |
| `API_RATE_LIMIT_USER_MAX` | `3000` | No | Positive integer: `/api` requests per user id in a valid JWT per 15 minutes. Sessions for the same user share this budget. |
| `API_RATE_LIMIT_ANON_MAX` | `300` | No | Positive integer: `/api` requests per client IP per 15 minutes without a valid JWT. Login/register and account sign-in protections also apply. See [HTTP settings](../../../http-deployment-settings.md). |
| `API_RATE_LIMIT_EXCHANGE_MAX` | `1000` | No | Positive integer: separate per-IP budget per 15 minutes for API-key headers on `/api/v2/data-exchange` and `/api/v2/sis`; valid JWTs retain the user budget and connection authentication/limits still apply. |

---

## Example `.env` File

```bash
# SoilFER LIMS Production Configuration
PORT=3000
NODE_ENV=production
DEPLOYMENT_MODE=local
JWT_SECRET=
ADMIN_INITIAL_PASSWORD=
```

---

## Operational Notes

- **Never commit `.env` to Git**: Your `.env` file is ignored by `.gitignore` so secrets stay on your server.
- **Applying changes**: After editing `/opt/soilfer-lims/.env`, recreate/restart the container for changes to take effect:
  ```bash
  cd /opt/soilfer-lims
  docker compose up -d
  ```
