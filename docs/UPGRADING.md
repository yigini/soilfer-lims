# SoilFER-LIMS Upgrade, Rollback & Disaster Recovery Runbook

> **Target Platform:** SoilFER-LIMS v1.4.0+  
> **Container Image:** `soilfer-lims:latest`  
> **Default Compose Project:** `soilfer-lims`  
> **Volumes:** `soilfer-lims_lims-data`, `soilfer-lims_lims-assets`, `soilfer-lims_lims-backups`

---

## 1. Database Schema Evolution Architecture

SoilFER-LIMS uses Prisma ORM with SQLite (via `better-sqlite3`). Schema evolution follows strict safety rules:
- **Zero Destructive Sync:** Production updates never run destructive `prisma db push --accept-data-loss`.
- **Automatic Additive Migrations:** On container boot, `docker-entrypoint.sh` automatically and idempotently executes versioned additive migrations before accepting traffic:
  - `scripts/migrate_lab_operations_v3.js --apply` (Analysis versioning, WorkItem rackPosition, Batch capacity)
  - `scripts/migrate_appearance_preference.js` (User theme preference)
  - `scripts/migrate_project_templates_and_policy.js` (Project template and channel policies)
- **Conservation Invariants:** All existing samples, results, reports, and audit logs are strictly preserved.

---

## 2. Standard Production Upgrade Procedure

### Step 1: Pre-Upgrade Safety Backup (Stopped Writers)
Always create a transactionally consistent backup before initiating an update:

```bash
cd /opt/soilfer-lims

# 1. Quiesce database writes
docker compose stop lims

# 2. Capture immutable host backup of database volume and assets
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ./backups

docker run --rm \
  -v soilfer-lims_lims-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar -czf /backup/db_snapshot_${TIMESTAMP}.tar.gz -C /data .

docker run --rm \
  -v soilfer-lims_lims-assets:/assets \
  -v $(pwd)/backups:/backup \
  alpine tar -czf /backup/assets_snapshot_${TIMESTAMP}.tar.gz -C /assets .

# 3. Verify the generated SQLite backup file
docker run --rm \
  -v soilfer-lims_lims-data:/app/server/prisma \
  soilfer-lims:latest node -e "
    const Database = require('better-sqlite3');
    const db = new Database('/app/server/prisma/dev.db', { readonly: true });
    const check = db.pragma('integrity_check');
    const fk = db.pragma('foreign_key_check');
    db.close();
    if (check[0]?.integrity_check !== 'ok' || fk.length > 0) {
      console.error('Integrity check failed');
      process.exit(1);
    }
    console.log('✓ SQLite database passed integrity and foreign key checks.');
  "
```

### Step 2: Fetch Code & Build Updated Container
```bash
# Pull latest reviewed main
git pull origin main

# Build updated container image (tagged soilfer-lims:latest)
docker compose build lims
```

### Step 3: Launch Upgraded Service
```bash
# Start container with appropriate compose files:
# For Single-Lab:
docker compose up -d

# For Single-Lab with NGINX (SSL):
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d

# For Multi-Lab with NGINX:
docker compose -f docker-compose.yml -f docker-compose.global.yml -f docker-compose.nginx.yml up -d
```

### Step 4: Post-Deployment Verification
```bash
# 1. Verify HTTP 200 healthcheck
curl -fsSL http://localhost:3000/api/health

# 2. Check container logs for migration confirmation
docker compose logs lims --tail 30
```

---

## 3. Rollback & Disaster Recovery Protocol

If an issue occurs after an update, follow this procedure to restore previous state.

### Step 1: Stop Writers Immediately
```bash
docker compose stop lims
```

### Step 2: Restore Database Snapshot
When restoring an existing backup, use the verified restore utility in the bound container image. This utility automatically:
1. Validates the backup archive before touching target files.
2. Creates a pre-restore backup of the current target file.
3. Cleans up stale `-wal` and `-shm` SQLite files.
4. Executes SQLite `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
5. **Invalidates Data Exchange Epoch:** If external sync tables (`_exchange_meta`) exist, it automatically rotates the exchange generation (epoch) so that remote consumers (OpenNSIS / Kobo) fail expired cursors closed with HTTP 410 and cleanly re-baseline.

```bash
docker run --rm \
  -v soilfer-lims_lims-data:/app/server/prisma \
  -v $(pwd)/backups:/app/server/backups \
  soilfer-lims:latest node scripts/restore_db.js /app/server/backups/<backup-filename>.db.gz
```

### Step 3: Restart Application & Verify Health
```bash
docker compose start lims

# Verify application health
curl -f http://localhost:3000/api/health
```
