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
Always create an online, transactionally consistent backup before initiating an update:

```bash
# Inside the running container:
docker exec soilfer-lims node scripts/backup_db.js

# Verify the generated backup archive:
docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<backup-filename>.db.gz

# Copy off-container to host storage:
docker cp soilfer-lims:/app/server/backups/<backup-filename>.db.gz /opt/backups/
```

### Step 2: Tag-Based Container Deployment
Pull the target release tag from the GitHub Container Registry (GHCR) or Docker Hub:

```bash
# Pull new image tag
docker pull ghcr.io/yigini/soilfer-lims:v1.4.0

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
curl -fsSL -I https://lims.yigini.net/api/health

# Verify database integrity inside the container
docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<backup-filename>.db.gz
```

---

## 3. Rollback Procedure

If unexpected errors occur after deployment:

### Step 1: Rollback Container to Previous Tag
```bash
docker compose stop
# Update docker-compose image tag to previous stable release and restart:
docker compose up -d
```

### Step 2: Restore Database Snapshot (if needed)
```bash
# Stop application container to prevent concurrent database writes
docker compose stop

# Restore database using the verified restore utility
docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups \
  soilfer-lims-app node scripts/restore_db.js /app/server/backups/<backup-filename>.db.gz

docker compose start
curl -f http://localhost/api/health
```
