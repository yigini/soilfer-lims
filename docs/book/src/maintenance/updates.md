# Updating SoilFER-LIMS

When a new version is released, updating is simple. Your data is safe — it lives in a Docker volume that persists across updates.

---

## Step-by-Step Update

```bash
# 1. Connect to your server
ssh root@YOUR_SERVER_IP

# 2. Back up your database first (always!)
docker exec soilfer-lims node scripts/backup_db.js
mkdir -p /opt/backups
docker cp soilfer-lims:/app/server/backups/ /opt/

# 3. Pull the latest code
cd /opt/soilfer-lims
git pull origin main

# 4. Rebuild and restart
docker compose down

# For Scenario A (fresh server):
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d --build

# For Scenario B (existing server):
docker compose up -d --build
```

The `--build` flag tells Docker to rebuild the application with the new code. This takes 2-3 minutes.

---

## Verify the Update

```bash
docker ps                           # Check containers are running
curl http://localhost:3000/api/health   # Check API responds
```

Then open your LIMS in the browser and verify it loads correctly.

---

## Rolling Back

If something goes wrong with the update:

```bash
# 1. Stop containers
cd /opt/soilfer-lims
docker compose stop

# 2. Restore the database backup if schema changes occurred
docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups \
  soilfer-lims-app node scripts/restore_db.js /app/server/backups/<backup-filename>.db.gz

# 3. Roll back the code to previous commit or release tag
git checkout HEAD~1

# 4. Rebuild and restart
docker compose up -d --build
```
