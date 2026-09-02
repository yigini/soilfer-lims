# SoilFER-LIMS Upgrade & Rollback Runbook

This runbook describes the procedure for deploying updates, executing schema migrations, and performing rollbacks across SoilFER-LIMS releases.

---

## 1. Database Schema Evolution Path

SoilFER-LIMS uses Prisma ORM with automated SQLite/PostgreSQL schema synchronization.

When upgrading from previous releases, run the sequential migration scripts to safely update existing production tables:

```bash
# In production container:
docker exec -w /app/server soilfer-lims node scripts/migrate_stage3_schema.js
docker exec -w /app/server soilfer-lims node scripts/migrate_stage4_schema.js
docker exec -w /app/server soilfer-lims node scripts/migrate_stage5_schema.js
docker exec -w /app/server soilfer-lims node scripts/migrate_stage6_schema.js
docker exec -w /app/server soilfer-lims node node_modules/prisma/build/index.js generate
```

### Stage Summary:
- **Stage 3**: Added `isGlobal`, `methodologyId`, `controlledUnits`, `unitCode` to `Analysis` and `MethodReference`.
- **Stage 4**: Added `executionOrder`, `prerequisites` (DAG dependencies) to `Analysis`.
- **Stage 5**: Added `BatchQcResult` table, `ProficiencyRound` table, and `Result.provenance` column.
- **Stage 6**: Added `ExternalMapping` shelf, dropped dormant `glosis_*` columns.

---

## 2. Standard Production Upgrade Procedure

### Step 1: Pre-Upgrade Safety Backup
Always create an immediate timestamped backup of the production database before initiating an update:

```bash
# On host server:
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp /var/lib/docker/volumes/lims_lims-data/_data/dev.db \
   /var/lib/docker/volumes/lims_lims-data/_data/dev.db.pre_upgrade_${TIMESTAMP}
```

### Step 2: Tag-Based Container Deployment
Pull the target release tag from the GitHub Container Registry (GHCR) or Docker Hub:

```bash
# Pull new image tag
docker pull ghcr.io/yigini/soilfer-lims:v1.0.0

# Stop and recreate container with new image
docker compose stop
docker compose up -d
```

### Step 3: Run Post-Deployment Migrations
```bash
docker exec -w /app/server soilfer-lims node scripts/migrate_stage6_schema.js
docker exec -w /app/server soilfer-lims node node_modules/prisma/build/index.js generate
docker restart soilfer-lims
```

### Step 4: Verification
```bash
# Verify HTTP 200 health check
curl -fsSL -I https://lims.yigini.net/

# Verify database integrity
sqlite3 /var/lib/docker/volumes/lims_lims-data/_data/dev.db \
  "SELECT 'Users:', count(*) FROM User; SELECT 'Samples:', count(*) FROM Sample;"
```

---

## 3. Rollback Procedure

If unexpected errors occur after deployment:

### Step 1: Rollback Container to Previous Tag
```bash
docker stop soilfer-lims
docker run -d --name soilfer-lims-rollback \
  --restart unless-stopped \
  -v lims_lims-data:/app/server/prisma \
  ghcr.io/yigini/soilfer-lims:v0.9.9
```

### Step 2: Restore Database Snapshot (if needed)
```bash
cp /var/lib/docker/volumes/lims_lims-data/_data/dev.db.pre_upgrade_${TIMESTAMP} \
   /var/lib/docker/volumes/lims_lims-data/_data/dev.db
docker restart soilfer-lims
```
