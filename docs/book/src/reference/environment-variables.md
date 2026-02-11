# Environment Variables

SoilFER-LIMS reads its configuration from a `.env` file in the project root directory. Here is a reference of all supported variables.

---

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | The internal port the application listens on. Usually keep as 3000. |
| `JWT_SECRET` | *(auto-generated)* | No | Secret key for encrypting login tokens. If left blank, a secure random key is generated on first boot. Set this explicitly if you want tokens to survive container restarts. |
| `NODE_ENV` | `production` | No | Application environment. Always use `production` for deployed instances. |
| `DEPLOYMENT_MODE` | `local` | No | `local` for a single laboratory, `global` for multi-laboratory network. |

---

## Example `.env` File

```bash
# SoilFER-LIMS Configuration
PORT=3000
JWT_SECRET=
NODE_ENV=production
DEPLOYMENT_MODE=local
```

---

## Notes

- The `.env` file should **never** be committed to Git (it's listed in `.gitignore`)
- If you change a value, restart the application for it to take effect:
  ```bash
  cd /opt/soilfer-lims && docker compose restart
  ```
- The JWT_SECRET auto-generation is convenient but means that all user sessions expire if the container restarts. For production use, set an explicit JWT_SECRET so sessions persist.
