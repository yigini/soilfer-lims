# Updating SoilFER-LIMS

When a new version is released, updating is simple. Your data is safe — it lives in a Docker volume that persists across updates.

---

## Step-by-Step Update

```bash
# 1. Connect to your server
ssh root@YOUR_SERVER_IP

# 2. Back up your database first (always!)
docker cp soilfer-lims:/app/server/prisma/dev.db /opt/backups/lims-pre-update-$(date +%Y%m%d).db

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
# 1. Restore the database backup
docker compose down
docker cp /opt/backups/lims-pre-update-20260211.db soilfer-lims:/app/server/prisma/dev.db

# 2. Roll back the code
cd /opt/soilfer-lims
git checkout HEAD~1   # Go back to the previous version

# 3. Rebuild
docker compose up -d --build
```
