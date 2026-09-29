# SoilFER-LIMS Upgrade, Rollback & Disaster Recovery Runbook

> **Target Platform:** SoilFER-LIMS v1.4.0+  
> **Release Image Standard:** Immutable Image ID (`docker inspect --format '{{.Id}}' soilfer-lims:v1.4.0-<commit-sha>`)  
> **Volume Scoping:** Bound directly to live container mounts discovered from Compose context

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
Docker Compose prefixes volumes with the project name. Rather than guessing volume names or relying on fallbacks, discover them directly from the active container mounts and inspect the baseline immutable image ID, carrying the active Compose configuration context throughout:

```bash
set -e

cd /opt/soilfer-lims

# Define Compose file context (include overlay files if deployed, e.g. -f docker-compose.yml -f docker-compose.nginx.yml)
COMPOSE_FILES=${COMPOSE_FILES:-"-f docker-compose.yml"}

# 1. Discover active container from Compose context (Fail Closed if not running)
CONTAINER_ID=$(docker compose ${COMPOSE_FILES} ps -q lims 2>/dev/null)
if [ -z "$CONTAINER_ID" ]; then
    echo "❌ Active LIMS container not found in Compose context! Ensure 'docker compose ${COMPOSE_FILES} ps' lists an active lims container before upgrading."
    exit 1
fi

# 2. Extract bound volumes and baseline image identity directly from the live container
DATA_VOLUME=$(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/server/prisma"}}{{.Name}}{{end}}{{end}}')
ASSETS_VOLUME=$(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/server/uploads"}}{{.Name}}{{end}}{{end}}')
BASELINE_IMAGE_ID=$(docker inspect "$CONTAINER_ID" --format '{{.Id}}')
BASELINE_IMAGE_REF=$(docker inspect "$CONTAINER_ID" --format '{{.Config.Image}}')

if [ -z "$DATA_VOLUME" ] || [ -z "$ASSETS_VOLUME" ] || [ -z "$BASELINE_IMAGE_ID" ]; then
    echo "❌ Failed to inspect required volume mounts or image ID from active container ${CONTAINER_ID}. Aborting."
    exit 1
fi

# 3. Verify target volumes exist in Docker engine
docker volume inspect "$DATA_VOLUME" >/dev/null
docker volume inspect "$ASSETS_VOLUME" >/dev/null

echo "✓ Verified Live Environment:"
echo "  - Container ID:       ${CONTAINER_ID}"
echo "  - Database Volume:    ${DATA_VOLUME}"
echo "  - Assets Volume:      ${ASSETS_VOLUME}"
echo "  - Baseline Image ID:  ${BASELINE_IMAGE_ID}"
echo "  - Baseline Image Ref: ${BASELINE_IMAGE_REF}"
```

### Step 2: Quiesce Writers & Produce Bound Backup
Always create a transactionally consistent, writer-quiesced backup before fetching new code:

```bash
set -e

# 1. Quiesce database writers
docker compose ${COMPOSE_FILES} stop lims

# 2. Create timestamped host backup directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ./backups

# Method A: Direct LIMS Database Backup (.db.gz) — recommended for CLI restore
BACKUP_OUTPUT=$(docker run --rm \
  -v "${DATA_VOLUME}:/app/server/prisma" \
  -v "$(pwd)/backups:/app/server/backups" \
  "${BASELINE_IMAGE_ID}" node scripts/backup_db.js)
echo "$BACKUP_OUTPUT"

# Extract exact generated filename, verify existence, compute sha256 hash, and bind artifact
BACKUP_FILE=$(echo "$BACKUP_OUTPUT" | grep -oE "(soilfer_lims_backup_|backup_)[^ ')]+\.db\.gz" | head -n 1)
if [ -z "$BACKUP_FILE" ] || [ ! -f "backups/${BACKUP_FILE}" ]; then
    echo "❌ Failed to identify generated backup artifact in backups directory!"
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
set -e

# 1. Pull canonical reviewed code
git pull origin main

# 2. Derive release tag & build container image
RELEASE_TAG=$(git rev-parse --short HEAD)
export LIMS_IMAGE_TAG="v1.4.0-${RELEASE_TAG}"
echo "Building release image: soilfer-lims:${LIMS_IMAGE_TAG}"

docker compose ${COMPOSE_FILES} build lims

# 3. Resolve and record immutable target image ID
TARGET_IMAGE_ID=$(docker inspect --format '{{.Id}}' "soilfer-lims:${LIMS_IMAGE_TAG}")
echo "Target Immutable Image ID: ${TARGET_IMAGE_ID}"
```

### Step 4: Launch Upgraded Service
Start the updated containers with your chosen topology, carrying forward your Compose configuration:

```bash
set -e

# Option A: Single Laboratory Direct Port 3000 (No NGINX):
docker compose -f docker-compose.yml up -d

# Option B: Single Laboratory with NGINX Reverse Proxy (Recommended):
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d

# Option C: Multi-Laboratory Network with NGINX:
docker compose -f docker-compose.yml -f docker-compose.global.yml -f docker-compose.nginx.yml up -d
```

### Step 5: Post-Deployment Verification & Bounded Release Gates
Execute the comprehensive release gates. Any failure halts the release:

```bash
set -e

# 1. Verify running container is bound to the immutable TARGET_IMAGE_ID
LIVE_CONTAINER_ID=$(docker compose ${COMPOSE_FILES} ps -q lims)
LIVE_IMAGE_ID=$(docker inspect "$LIVE_CONTAINER_ID" --format '{{.Image}}')
if [ "$LIVE_IMAGE_ID" != "$TARGET_IMAGE_ID" ]; then
    echo "❌ Deployment Mismatch: Container is running $LIVE_IMAGE_ID, expected target $TARGET_IMAGE_ID"
    exit 1
fi
echo "✓ Live container verified running target image ID: ${LIVE_IMAGE_ID}"

# 2. Verify active container mounts match discovered volumes
LIVE_DATA_VOL=$(docker inspect "$LIVE_CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/server/prisma"}}{{.Name}}{{end}}{{end}}')
LIVE_ASSETS_VOL=$(docker inspect "$LIVE_CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/server/uploads"}}{{.Name}}{{end}}{{end}}')
if [ "$LIVE_DATA_VOL" != "$DATA_VOLUME" ] || [ "$LIVE_ASSETS_VOL" != "$ASSETS_VOLUME" ]; then
    echo "❌ Mount Mismatch: Data=$LIVE_DATA_VOL (expected $DATA_VOLUME), Assets=$LIVE_ASSETS_VOL (expected $ASSETS_VOLUME)"
    exit 1
fi
echo "✓ Mounts verified: Data=${LIVE_DATA_VOL}, Assets=${LIVE_ASSETS_VOL}"

# 3. Verify HTTP 200 healthcheck and deployment mode
HEALTH_JSON=$(curl -fsSL http://localhost:3000/api/health)
echo "Health status: $HEALTH_JSON"

# 4. Verify startup logs confirm additive migrations, scheduler, and server start
docker compose ${COMPOSE_FILES} logs lims --tail 50 | grep -E "(Applying|Starting SoilFER-LIMS|Enterprise Server running)"
docker compose ${COMPOSE_FILES} logs lims --tail 50 | grep "\[SCHEDULER\] Escalation background scheduler initialized"
echo "✓ Background scheduler initialization verified."

# 5. Verify database integrity & foreign keys
docker compose ${COMPOSE_FILES} exec -T lims node -e "
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

# 6. Verify role-based API responsiveness
docker compose ${COMPOSE_FILES} exec -T lims node -e "
  const Database = require('better-sqlite3');
  const db = new Database('prisma/dev.db', { readonly: true });
  const userCount = db.prepare('SELECT count(*) as n FROM User').get().n;
  const labCount = db.prepare('SELECT count(*) as n FROM Lab').get().n;
  db.close();
  if (userCount === 0) {
    console.error('Postflight check failed: Zero users found in database!');
    process.exit(1);
  }
  console.log('✓ Database records verified. Users:', userCount, 'Labs:', labCount);
"

# 7. Verify NGINX reverse proxy connectivity (if deployed with NGINX overlay)
if docker compose ${COMPOSE_FILES} ps -q nginx >/dev/null 2>&1; then
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
docker compose ${COMPOSE_FILES} stop lims
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

#### Route B: Restoring from Full Volume Tarball (`.tar.gz`) — Staged & Fail-Closed Recovery
When restoring complete volume tarballs, stage and validate the archives in `/backup/staging` **before** modifying target volumes, preserve full pre-restore safety copies (including hidden `.jwt_secret` and WAL/SHM sidecars), and fail closed on any error without swallowing failures:

```bash
set -e

RESTORE_TS="<timestamp-of-target-backup>"

# 1. Stage and Verify Archives in Staging Directory First (Fail-Closed)
docker run --rm \
  -v "$(pwd)/backups:/backup" \
  "${BASELINE_IMAGE_ID}" \
  sh -c "
    set -e
    rm -rf /backup/staging
    mkdir -p /backup/staging/db /backup/staging/assets
    tar -xzf /backup/db_snapshot_${RESTORE_TS}.tar.gz -C /backup/staging/db
    if [ -f /backup/assets_snapshot_${RESTORE_TS}.tar.gz ]; then
      tar -xzf /backup/assets_snapshot_${RESTORE_TS}.tar.gz -C /backup/staging/assets
    fi
    node -e \"
      const Database = require('better-sqlite3');
      const db = new Database('/backup/staging/db/dev.db', { readonly: true });
      const integrity = db.pragma('integrity_check');
      const fk = db.pragma('foreign_key_check');
      db.close();
      if (integrity[0]?.integrity_check !== 'ok' || fk.length > 0) {
        console.error('Staged database integrity check failed:', integrity, fk);
        process.exit(1);
      }
      console.log('✓ Staged database archive integrity verified.');
    \"
  "

# 2. Preserve Pre-Restore Safety Snapshot of Current Volume Contents (Including Hidden Files)
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "${ASSETS_VOLUME}:/assets" \
  -v "$(pwd)/backups:/backup" \
  alpine sh -c "
    set -e
    SAFETY_DIR=\"/backup/pre_restore_safety_${RESTORE_TS}\"
    mkdir -p \"\$SAFETY_DIR/data\" \"\$SAFETY_DIR/assets\"
    # Copy all files including dotfiles (.jwt_secret, .seed_complete, WAL, SHM)
    cp -a /data/. \"\$SAFETY_DIR/data/\"
    cp -a /assets/. \"\$SAFETY_DIR/assets/\"
    echo '✓ Full pre-restore safety snapshot created in host backups.'
  "

# 3. Atomically Replace Target Volume Contents from Verified Staging
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "${ASSETS_VOLUME}:/assets" \
  -v "$(pwd)/backups:/backup" \
  alpine sh -c "
    set -e
    rm -rf /data/* /data/.* 2>/dev/null || true
    cp -a /backup/staging/db/. /data/
    if [ -d /backup/staging/assets ] && [ \"\$(ls -A /backup/staging/assets)\" ]; then
      rm -rf /assets/* /assets/.* 2>/dev/null || true
      cp -a /backup/staging/assets/. /assets/
    fi
    rm -rf /backup/staging
    echo '✓ Staged volume contents copied to target volumes.'
  "

# 4. Verify Restored Volume and Rotate Exchange Epoch
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
      console.error('Restored volume database integrity check failed:', integrity, fk);
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
Rollback must intentionally launch the verified baseline image with the recorded Compose context:

```bash
set -e

# 1. Explicitly tag the immutable BASELINE_IMAGE_ID with a dedicated rollback tag
ROLLBACK_TAG="rollback-${TIMESTAMP}"
docker tag "${BASELINE_IMAGE_ID}" "soilfer-lims:${ROLLBACK_TAG}"
export LIMS_IMAGE_TAG="${ROLLBACK_TAG}"

# 2. Launch container using Compose with the recorded configuration context
docker compose ${COMPOSE_FILES} up -d

# 3. Verify running container is bound to the immutable BASELINE_IMAGE_ID
ROLLBACK_CONTAINER_ID=$(docker compose ${COMPOSE_FILES} ps -q lims)
ACTUAL_RUNNING_IMAGE_ID=$(docker inspect "$ROLLBACK_CONTAINER_ID" --format '{{.Image}}')
if [ "$ACTUAL_RUNNING_IMAGE_ID" != "$BASELINE_IMAGE_ID" ]; then
    echo "❌ Rollback Image Mismatch: Container running $ACTUAL_RUNNING_IMAGE_ID, expected baseline $BASELINE_IMAGE_ID"
    exit 1
fi
echo "✓ Live container verified running baseline image ID: ${ACTUAL_RUNNING_IMAGE_ID}"

# 4. Verify application health
curl -fsSL http://localhost:3000/api/health
echo "✓ Rollback health check passed."
```
