# Quick Reference Card

A single-page reference with the most commonly needed commands and information.

---

## Common Commands

| Action | Command |
|--------|---------|
| **Start LIMS (Scenario A)** | `cd /opt/soilfer-lims && docker compose -f docker-compose.yml -f docker-compose.global.yml up -d` |
| **Start LIMS (Scenario B)** | `cd /opt/soilfer-lims && docker compose up -d` |
| **Stop LIMS** | `cd /opt/soilfer-lims && docker compose down` |
| **Restart LIMS** | `cd /opt/soilfer-lims && docker compose restart` |
| **View logs** | `docker logs soilfer-lims -f --tail 50` |
| **Check status** | `docker ps` |
| **Backup database** | `docker exec soilfer-lims node scripts/backup_db.js` |
| **Verify backup** | `docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<file>.db.gz` |
| **Restore database** | `docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups soilfer-lims-app node scripts/restore_db.js /app/server/backups/<file>.db.gz` |
| **Update LIMS** | `cd /opt/soilfer-lims && git pull && docker compose down && docker compose up -d --build` |
| **Check health** | `curl http://localhost:3000/api/health` |
| **Reset admin password** | See [Password Reset](../maintenance/password-reset.md) |

---

## Initial Administration Credentials

| Mode | Username | Initial Password | Role |
|------|----------|------------------|------|
| Local | `admin` | `<generated-initial-password>` (printed on startup) | Lab Manager |
| Global | `admin` | `<generated-initial-password>` (printed on startup) | Super Admin |

> ⚠️ Initial password is randomly generated upon first database initialization unless `ADMIN_INITIAL_PASSWORD` is supplied. You **must** change this password on first login.

---

## Important File Locations (on server)

| File/Directory | Purpose |
|---------------|---------|
| `/opt/soilfer-lims/` | Main application directory |
| `/opt/soilfer-lims/.env` | Configuration file |
| `/opt/soilfer-lims/deploy/nginx.conf` | NGINX web server configuration |
| `/opt/backups/` | Database backups (if you set up automatic backups) |
| Docker volume `lims-data` | Persistent database storage |
| Docker volume `lims-assets` | Uploaded files (spectra, photos) |

---

## Key URLs

| Resource | URL |
|----------|-----|
| Your LIMS | `https://your-domain.com` |
| Health check API | `https://your-domain.com/api/health` |
| Source code | [github.com/yigini/soilfer-lims](https://github.com/yigini/soilfer-lims) |
| Report issues | [github.com/yigini/soilfer-lims/issues](https://github.com/yigini/soilfer-lims/issues) |
| FAO SoilFER | [fao.org/soils-portal/soilfer](https://www.fao.org/soils-portal/soilfer) |
| GLOSOLAN | [fao.org/global-soil-partnership/glosolan](https://www.fao.org/global-soil-partnership/glosolan) |

---

## Port Reference

| Port | Used By | Scenario |
|------|---------|----------|
| 22 | SSH (your terminal connection) | Both |
| 80 | HTTP (web traffic) | Both |
| 443 | HTTPS (secure web traffic) | Both |
| 3000 | LIMS internal port | Scenario B (exposed to host) |
