# SoilFER-LIMS Upgrade, Rollback & Disaster Recovery Runbook

> **Target Platform:** SoilFER-LIMS v1.4.0+  
> **Release Image Standard:** Immutable Image ID (`docker inspect --format '{{.Id}}' soilfer-lims:v1.4.0-<commit-sha>`)  
> **Volume Scoping:** Bound directly to live container mounts or `${COMPOSE_PROJECT_NAME:-soilfer-lims}_lims-data`  

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

### Step 1: Discover Environment, Running Mounts & Image Identities
Docker Compose prefixes volumes with the project name. Rather than guessing volume names, discover them directly from the active container mounts and inspect the baseline immutable image ID:

```bash
cd /opt/soilfer-lims

# 1. Discover active container, mounts, and baseline image ID
CONTAINER_ID=$(docker compose ps -q lims 2>/dev/null)
if [ -n "$CONTAINER_ID" ]; then
    DATA_VOLUME=$(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/server/prisma"}}{{.Name}}{{end}}{{end}}')
    ASSETS_VOLUME=$(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/server/uploads"}}{{.Name}}{{end}}{{end}}')
    RUNNING_IMAGE_REF=$(docker inspect "$CONTAINER_ID" --format '{{.Image}}')
fi

# Fallback to Compose project discovery if container is not running
PROJECT_NAME=${COMPOSE_PROJECT_NAME:-$(docker compose config 2>/dev/null | grep -m1 '^name:' | awk '{print $2}')}
PROJECT_NAME=${PROJECT_NAME:-$(basename "$PWD")}
DATA_VOLUME=${DATA_VOLUME:-"${PROJECT_NAME}_lims-data"}
ASSETS_VOLUME=${ASSETS_VOLUME:-"${PROJECT_NAME}_lims-assets"}

# 2. Verify volumes exist
docker volume inspect "$DATA_VOLUME" >/dev/null || { echo "❌ Volume $DATA_VOLUME does not exist!"; exit 1; }
docker volume inspect "$ASSETS_VOLUME" >/dev/null || { echo "❌ Volume $ASSETS_VOLUME does not exist!"; exit 1; }

# 3. Resolve immutable baseline image ID
BASELINE_IMAGE_ID=$(docker inspect --format '{{.Id}}' "${RUNNING_IMAGE_REF:-soilfer-lims:latest}")

echo "✓ Verified Environment:"
echo "  - Project Name:       ${PROJECT_NAME}"
echo "  - Database Volume:    ${DATA_VOLUME}"
echo "  - Assets Volume:      ${ASSETS_VOLUME}"
echo "  - Baseline Image ID:  ${BASELINE_IMAGE_ID}"
```

### Step 2: Quiesce Writers & Produce Bound Backup
Always create a transactionally consistent, writer-quiesced backup before fetching new code:

```bash
# 1. Quiesce database writers
docker compose stop lims

# 2. Create timestamped host backup directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ./backups

# Method A: Direct LIMS Database Backup (.db.gz) — recommended for CLI restore
BACKUP_OUTPUT=$(docker run --rm \
  -v "${DATA_VOLUME}:/app/server/prisma" \
  -v "$(pwd)/backups:/app/server/backups" \
  "${BASELINE_IMAGE_ID}" node scripts/backup_db.js)
echo "$BACKUP_OUTPUT"

# Extract exact generated filename, compute hash, and bind artifact
BACKUP_FILE=$(echo "$BACKUP_OUTPUT" | grep -oE "backup_[0-9_]+\.db\.gz" | head -n1)
if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Failed to identify generated backup artifact!"
    exit 1
fi
sha256sum "backups/${BACKUP_FILE}" > "backups/${BACKUP_FILE}.sha256"
echo "✓ Exact backup artifact bound: backups/${BACKUP_FILE}"

# Method B: Full Volume Tarball (.tar.gz) — complete volume preservation
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "$(pwd)/backups:/backup" \
  alpine tar -czf "/backup/db_snapshot_${TIMESTAMP}.tar.gz" -C /data .

docker run --rm \
  -v "${ASSETS_VOLUME}:/assets" \
  -v "$(pwd)/backups:/backup" \
  alpine tar -czf "/backup/assets_snapshot_${TIMESTAMP}.tar.gz" -C /assets .

# 3. Verify the exact generated backup archive itself
docker run --rm \
  -v "$(pwd)/backups:/backup" \
  "${BASELINE_IMAGE_ID}" node -e "
    const { verifyBackup } = require('./scripts/verify_backup');
    (async () => {
      const check = await verifyBackup('/backup/${BACKUP_FILE}');
      if (!check.valid) {
        console.error('Backup verification failed:', check.error);
        process.exit(1);
      }
      console.log('✓ Exact backup archive verified valid. Users:', check.tables.userCount, 'Samples:', check.tables.sampleCount);
      process.exit(0);
    })();
  "
```

### Step 3: Fetch Code & Build Immutable Target Release Image
Tag the container image with the specific Git commit hash and resolve its immutable image ID:

```bash
# 1. Pull canonical reviewed code
git pull origin main

# 2. Derive release tag & build container image
RELEASE_TAG=$(git rev-parse --short HEAD)
export LIMS_IMAGE_TAG="v1.4.0-${RELEASE_TAG}"
echo "Building release image: soilfer-lims:${LIMS_IMAGE_TAG}"

docker compose build lims

# 3. Resolve and record immutable target image ID
TARGET_IMAGE_ID=$(docker inspect --format '{{.Id}}' "soilfer-lims:${LIMS_IMAGE_TAG}")
echo "Target Immutable Image ID: ${TARGET_IMAGE_ID}"
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

### Step 5: Post-Deployment Verification & Bounded Release Gates
Execute the standard release gates:

```bash
# 1. Verify running container is bound to the immutable TARGET_IMAGE_ID
LIVE_IMAGE_ID=$(docker inspect $(docker compose ps -q lims) --format '{{.Image}}')
if [ "$LIVE_IMAGE_ID" != "$TARGET_IMAGE_ID" ]; then
    echo "❌ Deployment Mismatch: Container is running $LIVE_IMAGE_ID, expected target $TARGET_IMAGE_ID"
    exit 1
fi
echo "✓ Live container verified running target image ID: ${LIVE_IMAGE_ID}"

# 2. Verify HTTP 200 healthcheck
curl -fsSL http://localhost:3000/api/health

# 3. Verify startup logs confirm additive migrations and server start
docker compose logs lims --tail 40 | grep -E "(Applying|Starting SoilFER-LIMS)"

# 4. Verify database integrity & foreign keys
docker compose exec lims node -e "
  const Database = require('better-sqlite3');
  const db = new Database('prisma/dev.db', { readonly: true });
  const integrity = db.pragma('integrity_check');
  const fk = db.pragma('foreign_key_check');
  db.close();
  if (integrity[0]?.integrity_check !== 'ok' || fk.length > 0) {
    console.error('Postflight DB check failed:', integrity, fk);
    process.exit(1);
  }
  console.log('✓ Post-upgrade database integrity and foreign keys verified.');
"

# 5. Verify NGINX reverse proxy connectivity (if deployed with NGINX overlay)
if docker compose ps -q nginx >/dev/null 2>&1; then
    curl -fsSL http://localhost/api/health
    echo "✓ NGINX reverse proxy ingress verified."
fi
```

---

## 3. Rollback & Disaster Recovery Protocol

If an unexpected regression occurs after deployment, follow this procedure to restore previous state.

> ⚠️ **Important Data Consistency Invariant:**  
> Never restore an old database archive onto an active server after new analytical writes have resumed without explicit manual reconciliation. Restoring an old database rewinds analytical history and invalidates newer client results.

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
5. **Invalidates Data Exchange Epoch:** Automatically rotates the exchange generation (epoch) so that remote consumers (OpenNSIS / Kobo) fail expired cursors closed with HTTP 410 and cleanly re-baseline.
6. **Fails Closed:** If any step (including epoch rotation) encounters an error, it exits with status 1, retains recovery artifacts, and aborts.

```bash
# Restore specific backup file into the verified project volume using the verified image ID:
docker run --rm \
  -v "${DATA_VOLUME}:/app/server/prisma" \
  -v "$(pwd)/backups:/app/server/backups" \
  "${BASELINE_IMAGE_ID}" \
  node scripts/restore_db.js "/app/server/backups/${BACKUP_FILE}"
```

#### Route B: Restoring from Full Volume Tarball (`.tar.gz`)
When restoring complete volume tarballs, verify the archive and stage safety snapshots **before** modifying target volumes:

```bash
RESTORE_TS="<timestamp-of-target-backup>"

# 1. Verify Archive Integrity First (Fail-Closed)
docker run --rm \
  -v "$(pwd)/backups:/backup" \
  alpine tar -tzf "/backup/db_snapshot_${RESTORE_TS}.tar.gz" >/dev/null || {
    echo "❌ Database backup tarball is corrupted or unreadable! Aborting restore."
    exit 1
}

# 2. Preserve Pre-Restore Safety Snapshot of Current Volume Contents
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "$(pwd)/backups:/backup" \
  alpine sh -c "mkdir -p /backup/pre_restore_safety_${TIMESTAMP} && cp -a /data/* /backup/pre_restore_safety_${TIMESTAMP}/ 2>/dev/null || true"

# 3. Extract Verified Archive into Database Volume
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "$(pwd)/backups:/backup" \
  alpine sh -c "rm -rf /data/* /data/.* 2>/dev/null || true && tar -xzf /backup/db_snapshot_${RESTORE_TS}.tar.gz -C /data"

# 4. Restore Assets Volume (if included)
if [ -f "backups/assets_snapshot_${RESTORE_TS}.tar.gz" ]; then
  docker run --rm \
    -v "${ASSETS_VOLUME}:/assets" \
    -v "$(pwd)/backups:/backup" \
    alpine sh -c "rm -rf /assets/* /assets/.* 2>/dev/null || true && tar -xzf /backup/assets_snapshot_${RESTORE_TS}.tar.gz -C /assets"
fi

# 5. Integrity Check and Rotate Exchange Epoch after Volume Restore
docker run --rm \
  -v "${DATA_VOLUME}:/app/server/prisma" \
  "${BASELINE_IMAGE_ID}" \
  node -e "
    const Database = require('better-sqlite3');
    const { rotateEpoch, ensureTriggers, initTables } = require('./services/exchangeStateService');
    const db = new Database('prisma/dev.db');
    const integrity = db.pragma('integrity_check');
    const fk = db.pragma('foreign_key_check');
    if (integrity[0]?.integrity_check !== 'ok' || fk.length > 0) {
      console.error('Restored database integrity or foreign key check failed:', integrity, fk);
      process.exit(1);
    }
    initTables(db);
    ensureTriggers(db);
    const res = rotateEpoch(db, 'VOLUME_RESTORE');
    db.close();
    console.log('✓ Restored database verified & rotated data exchange epoch to:', res.currentEpoch);
  "
```

### Step 3: Restart Baseline Container & Verify Health
```bash
# Start container using verified baseline image or docker-compose
docker compose up -d

# Verify application health
curl -fsSL http://localhost:3000/api/health
```
