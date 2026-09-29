# SoilFER-LIMS Upgrade, Rollback & Disaster Recovery Runbook

> **Target Platform:** SoilFER-LIMS v1.4.0+  
> **Release Image Standard:** `soilfer-lims:${LIMS_IMAGE_TAG:-<commit-sha>}`  
> **Volume Scoping:** `${COMPOSE_PROJECT_NAME:-soilfer-lims}_lims-data`, `${COMPOSE_PROJECT_NAME:-soilfer-lims}_lims-assets`, `${COMPOSE_PROJECT_NAME:-soilfer-lims}_lims-backups`

---

## 1. Database Schema Evolution Architecture

SoilFER-LIMS uses Prisma ORM with SQLite (via `better-sqlite3`). Schema evolution follows strict safety rules:
- **Zero Destructive Sync:** Production updates never run destructive `prisma db push --accept-data-loss`.
- **Automatic Additive Migrations:** On container boot, `docker-entrypoint.sh` automatically and idempotently executes versioned additive migrations before accepting traffic:
  - `scripts/migrate_lab_operations_v3.js --apply` (Analysis versioning, WorkItem rackPosition, Batch capacity)
  - `scripts/migrate_appearance_preference.js` (User theme preference)
  - `scripts/migrate_project_templates_and_policy.js` (Project template and channel policies)
- **Conservation Invariants:** All existing samples, results, reports, and audit logs are strictly preserved.
- **Fail-Closed Restore:** Database restoration requires stopped writers, integrity and foreign key validation, and automatic NSIS data exchange epoch rotation (`rotateEpoch`) when synchronization tables exist.

---

## 2. Standard Production Upgrade Procedure

### Step 1: Discover Environment & Volume Identities
Docker Compose prefixes volumes with the project name (defaulting to the folder name or `COMPOSE_PROJECT_NAME`). Always verify volume identities before operating to avoid Docker silently creating empty volumes:

```bash
cd /opt/soilfer-lims

# 1. Discover active Compose project and volume names
PROJECT_NAME=$(docker compose config 2>/dev/null | grep -m1 '^name:' | awk '{print $2}')
PROJECT_NAME=${PROJECT_NAME:-$(basename "$PWD")}

DATA_VOLUME="${PROJECT_NAME}_lims-data"
ASSETS_VOLUME="${PROJECT_NAME}_lims-assets"
BACKUPS_VOLUME="${PROJECT_NAME}_lims-backups"

# 2. Verify volumes exist
docker volume inspect "$DATA_VOLUME" >/dev/null || { echo "❌ Volume $DATA_VOLUME does not exist!"; exit 1; }
docker volume inspect "$ASSETS_VOLUME" >/dev/null || { echo "❌ Volume $ASSETS_VOLUME does not exist!"; exit 1; }

echo "✓ Verified volumes for project '${PROJECT_NAME}':"
echo "  - Database Volume: ${DATA_VOLUME}"
echo "  - Assets Volume:   ${ASSETS_VOLUME}"
```

### Step 2: Quiesce Writers & Take Pre-Upgrade Backup
Always create a transactionally consistent, writer-quiesced backup before fetching new code:

```bash
# 1. Quiesce database writers
docker compose stop lims

# 2. Create timestamped host backup directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ./backups

# Method A: Direct LIMS Database Backup (.db.gz) — recommended for CLI restore
docker run --rm \
  -v "${DATA_VOLUME}:/app/server/prisma" \
  -v "$(pwd)/backups:/app/server/backups" \
  soilfer-lims:latest node scripts/backup_db.js

# Method B: Full Volume Tarball (.tar.gz) — comprehensive data & assets
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "$(pwd)/backups:/backup" \
  alpine tar -czf "/backup/db_snapshot_${TIMESTAMP}.tar.gz" -C /data .

docker run --rm \
  -v "${ASSETS_VOLUME}:/assets" \
  -v "$(pwd)/backups:/backup" \
  alpine tar -czf "/backup/assets_snapshot_${TIMESTAMP}.tar.gz" -C /assets .

# 3. Verify the generated backup archive itself (extract to disposable staging to test)
docker run --rm \
  -v "$(pwd)/backups:/backup" \
  soilfer-lims:latest node -e "
    const fs = require('fs');
    const { verifyBackup } = require('./scripts/verify_backup');
    (async () => {
      // Find latest backup file created
      const files = fs.readdirSync('/backup').filter(f => f.endsWith('.db.gz'));
      if (files.length === 0) {
        console.error('No .db.gz backup found in /backup');
        process.exit(1);
      }
      const latest = '/backup/' + files.sort().pop();
      const check = await verifyBackup(latest);
      if (!check.valid) {
        console.error('Backup verification failed:', check.error);
        process.exit(1);
      }
      console.log('✓ Backup archive is valid. Users:', check.tables.userCount, 'Samples:', check.tables.sampleCount);
      process.exit(0);
    })();
  "
```

### Step 3: Fetch Code & Build Immutable Release Image
Tag the container image with the specific Git commit hash to guarantee reproducible deployments and avoid running untracked or mutable `latest` tags:

```bash
# 1. Pull canonical reviewed code
git pull origin main

# 2. Derive immutable image tag
RELEASE_TAG=$(git rev-parse --short HEAD)
export LIMS_IMAGE_TAG="v1.4.0-${RELEASE_TAG}"
echo "Building immutable release image: soilfer-lims:${LIMS_IMAGE_TAG}"

# 3. Build container image
docker compose build lims
```

### Step 4: Launch Upgraded Service
Start the updated containers with your chosen topology:

```bash
# Option A: Single Laboratory with NGINX Reverse Proxy (Recommended):
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d

# Option B: Single Laboratory Direct Port 3000 (No NGINX):
docker compose up -d

# Option C: Multi-Laboratory Network with NGINX:
docker compose -f docker-compose.yml -f docker-compose.global.yml -f docker-compose.nginx.yml up -d
```

### Step 5: Post-Deployment Verification & Bounded Gates
Execute the standard release gates:

```bash
# 1. Verify HTTP 200 healthcheck
curl -fsSL http://localhost:3000/api/health

# 2. Verify startup logs confirm additive migrations and server start
docker compose logs lims --tail 30 | grep -E "(Applying|Starting SoilFER-LIMS)"

# 3. Verify database integrity after migration
docker compose exec lims node -e "
  const Database = require('better-sqlite3');
  const db = new Database('prisma/dev.db', { readonly: true });
  const integrity = db.pragma('integrity_check');
  const fk = db.pragma('foreign_key_check');
  db.close();
  if (integrity[0]?.integrity_check !== 'ok' || fk.length > 0) {
    console.error('Postflight DB check failed');
    process.exit(1);
  }
  console.log('✓ Post-upgrade database integrity and foreign keys verified.');
"
```

---

## 3. Rollback & Disaster Recovery Protocol

If an unexpected regression occurs after deployment, follow this procedure to restore previous state.

> ⚠️ **Important Data Consistency Rule:** Never restore an old database archive onto an active server after new analytical writes have resumed without explicit manual reconciliation. Restoring an old database rewinds analytical history and invalidates newer client results.

### Step 1: Stop Writers Immediately
```bash
docker compose stop lims
```

### Step 2: Restore Database Snapshot (Round-Trip Procedure)

#### Route A: Restoring from LIMS Database Backup (`.db.gz`)
The verified restore CLI utility (`server/scripts/restore_db.js`):
1. Verifies the backup archive integrity before touching target files.
2. Creates safety snapshots of the current target database and WAL/SHM sidecars (`.pre_restore_<timestamp>.bak`).
3. Cleans up stale WAL/SHM sidecars safely.
4. Executes `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
5. **Invalidates Data Exchange Epoch:** If external sync tables (`_exchange_meta`) exist, it automatically rotates the exchange generation (epoch) so that remote consumers (OpenNSIS / Kobo) fail expired cursors closed with HTTP 410 and cleanly re-baseline.
6. **Fails Closed:** If any step (including epoch rotation) encounters an error, it exits with status 1, retains recovery artifacts, and aborts.

```bash
# Restore specific backup file into the verified project volume:
docker run --rm \
  -v "${DATA_VOLUME}:/app/server/prisma" \
  -v "$(pwd)/backups:/app/server/backups" \
  "soilfer-lims:${LIMS_IMAGE_TAG:-latest}" \
  node scripts/restore_db.js "/app/server/backups/<backup-filename>.db.gz"
```

#### Route B: Restoring from Full Volume Tarball (`.tar.gz`)
If restoring the complete volume tarballs:

```bash
BACKUP_TS="<timestamp-of-target-backup>"

# 1. Restore Database Volume
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "$(pwd)/backups:/backup" \
  alpine sh -c "rm -rf /data/* /data/.* 2>/dev/null || true && tar -xzf /backup/db_snapshot_${BACKUP_TS}.tar.gz -C /data"

# 2. Restore Assets Volume
docker run --rm \
  -v "${ASSETS_VOLUME}:/assets" \
  -v "$(pwd)/backups:/backup" \
  alpine sh -c "rm -rf /assets/* /assets/.* 2>/dev/null || true && tar -xzf /backup/assets_snapshot_${BACKUP_TS}.tar.gz -C /assets"

# 3. Rotate Exchange Epoch after Volume Restore
docker run --rm \
  -v "${DATA_VOLUME}:/app/server/prisma" \
  "soilfer-lims:${LIMS_IMAGE_TAG:-latest}" \
  node -e "
    const Database = require('better-sqlite3');
    const { rotateEpoch, ensureTriggers, initTables } = require('./services/exchangeStateService');
    const db = new Database('prisma/dev.db');
    initTables(db);
    ensureTriggers(db);
    const res = rotateEpoch(db, 'VOLUME_RESTORE');
    db.close();
    console.log('✓ Rotated data exchange epoch to:', res.currentEpoch);
  "
```

### Step 3: Restart Application & Verify Health
```bash
docker compose start lims

# Verify application health
curl -fsSL http://localhost:3000/api/health
```
