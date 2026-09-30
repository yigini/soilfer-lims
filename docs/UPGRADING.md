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

# 2. Extract bound volumes, baseline image identity, deployment mode, and principals directly from the live container
DATA_VOLUME=$(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/server/prisma"}}{{.Name}}{{end}}{{end}}')
ASSETS_VOLUME=$(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/server/uploads"}}{{.Name}}{{end}}{{end}}')
BASELINE_IMAGE_ID=$(docker inspect "$CONTAINER_ID" --format '{{.Image}}')
BASELINE_IMAGE_REF=$(docker inspect "$CONTAINER_ID" --format '{{.Config.Image}}')

if [ -z "$DATA_VOLUME" ] || [ -z "$ASSETS_VOLUME" ] || [ -z "$BASELINE_IMAGE_ID" ]; then
    echo "❌ Failed to inspect required volume mounts or image ID from active container ${CONTAINER_ID}. Aborting."
    exit 1
fi

# Verify baseline image exists in Docker engine before stopping writers
docker image inspect "$BASELINE_IMAGE_ID" >/dev/null

# Discover running deployment mode (local/global) directly from container configuration
CONTAINER_ENVS=$(docker inspect "$CONTAINER_ID" --format '{{range .Config.Env}}{{println .}}{{end}}') || {
    echo "❌ Failed to inspect container environment for $CONTAINER_ID"
    exit 1
}
BASELINE_MODE=$(echo "$CONTAINER_ENVS" | grep '^DEPLOYMENT_MODE=' | cut -d= -f2- || true)
EXPECTED_MODE=${EXPECTED_MODE:-${BASELINE_MODE:-"local"}}

# Discover or declare reviewed existing principals for postflight role verification
# Require explicit reviewed existing principals for postflight verification
POSTFLIGHT_ADMIN_ID=${POSTFLIGHT_ADMIN_ID:-""}
POSTFLIGHT_MANAGER_ID=${POSTFLIGHT_MANAGER_ID:-""}
POSTFLIGHT_TECH_ID=${POSTFLIGHT_TECH_ID:-""}

# If any principal ID is unset, query candidate active principals from running container for operator review:
if [ -z "$POSTFLIGHT_ADMIN_ID" ] || [ -z "$POSTFLIGHT_MANAGER_ID" ] || [ -z "$POSTFLIGHT_TECH_ID" ]; then
    echo "⚠️ Required reviewed principal IDs are not explicitly declared."
    echo "Querying candidate active principals from baseline container for operator review:"
    docker compose ${COMPOSE_FILES} exec -T lims node -e "
      const Database = require('better-sqlite3');
      const db = new Database('prisma/dev.db', { readonly: true });
      const users = db.prepare('SELECT id, username, role, labId, isActive, mustChangePassword FROM User WHERE isActive = 1 AND mustChangePassword = 0').all();
      db.close();
      console.log('Candidate reviewed principals available:');
      users.forEach(u => console.log('  [' + u.role + '] ID: ' + u.id + ' (' + u.username + ', lab: ' + (u.labId || 'ALL') + ')'));
    " || true
    echo "❌ Missing explicit reviewed principal IDs! Please review candidates above and set POSTFLIGHT_ADMIN_ID, POSTFLIGHT_MANAGER_ID, and POSTFLIGHT_TECH_ID before proceeding."
    exit 1
fi

# 3. Verify target volumes exist in Docker engine
docker volume inspect "$DATA_VOLUME" >/dev/null
docker volume inspect "$ASSETS_VOLUME" >/dev/null

# Discover configured NGINX proxy container identity if deployed with NGINX overlay
BASELINE_NGINX_CONTAINER=""
if echo "${COMPOSE_FILES}" | grep -q "docker-compose\.nginx\.yml"; then
    BASELINE_NGINX_CONTAINER=$(docker compose ${COMPOSE_FILES} ps -q nginx 2>/dev/null || true)
fi

# Snapshot discovered configuration
mkdir -p ./backups
cat <<EOF > ./backups/baseline_config.env
COMPOSE_FILES="${COMPOSE_FILES}"
DATA_VOLUME="${DATA_VOLUME}"
ASSETS_VOLUME="${ASSETS_VOLUME}"
BASELINE_IMAGE_ID="${BASELINE_IMAGE_ID}"
BASELINE_IMAGE_REF="${BASELINE_IMAGE_REF}"
BASELINE_NGINX_CONTAINER="${BASELINE_NGINX_CONTAINER}"
EXPECTED_MODE="${EXPECTED_MODE}"
POSTFLIGHT_ADMIN_ID="${POSTFLIGHT_ADMIN_ID}"
POSTFLIGHT_MANAGER_ID="${POSTFLIGHT_MANAGER_ID}"
POSTFLIGHT_TECH_ID="${POSTFLIGHT_TECH_ID}"
EOF

echo "✓ Verified Live Environment:"
echo "  - Container ID:       ${CONTAINER_ID}"
echo "  - Database Volume:    ${DATA_VOLUME}"
echo "  - Assets Volume:      ${ASSETS_VOLUME}"
echo "  - Baseline Image ID:  ${BASELINE_IMAGE_ID}"
echo "  - Baseline Image Ref: ${BASELINE_IMAGE_REF}"
echo "  - NGINX Proxy ID:     ${BASELINE_NGINX_CONTAINER:-'none (direct)'}"
echo "  - Deployment Mode:    ${EXPECTED_MODE}"
echo "  - Super Admin ID:     ${POSTFLIGHT_ADMIN_ID}"
echo "  - Lab Manager ID:     ${POSTFLIGHT_MANAGER_ID}"
echo "  - Lab Technician ID:  ${POSTFLIGHT_TECH_ID}"
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

### Step 4: Launch Upgraded Service in Pre-Exposure Mode (Writer & Ingress Hold)
During pre-exposure verification, both external ingress and internal background schedulers are strictly held:
1. Internal schedulers are held via `DISABLE_BACKGROUND_JOBS=true` to guarantee zero database writes before cutover is committed.
2. External client ingress remains held at the reverse proxy / load-balancer boundary.

```bash
set -e

# Load discovered baseline configuration and reviewed principals
if [ -f "./backups/baseline_config.env" ]; then
    source ./backups/baseline_config.env
fi

# Ingress Hold: Hold external client traffic for all configured client paths during postflight
if [ -f "docker-compose.nginx.yml" ] && echo "$COMPOSE_FILES" | grep -q "docker-compose.nginx.yml"; then
    echo "Holding public ingress at NGINX reverse proxy boundary..."
    docker compose ${COMPOSE_FILES} stop nginx || {
        echo "❌ Failed to hold NGINX proxy ingress; aborting deployment!"
        exit 1
    }
    echo "✓ Ingress held at NGINX reverse proxy boundary."
else
    echo "Direct topology deployment (no NGINX overlay configured)."
    echo "Enforcing direct application port client hold: binding to loopback (127.0.0.1) for bounded postflight verification..."
    export PORT="127.0.0.1:3000"
fi

# Launch containers in pre-exposure verification mode with writer hold
DISABLE_BACKGROUND_JOBS=true docker compose ${COMPOSE_FILES} up -d lims
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
echo "$HEALTH_JSON" | grep -q '"status":"ok"' || { echo "❌ Healthcheck status is not ok"; exit 1; }

# Verify running deployment mode against explicit reviewed configuration
CONTAINER_ENVS=$(docker inspect "$LIVE_CONTAINER_ID" --format '{{range .Config.Env}}{{println .}}{{end}}') || {
    echo "❌ Failed to inspect container environment for $LIVE_CONTAINER_ID"
    exit 1
}
ACTUAL_MODE=$(echo "$CONTAINER_ENVS" | grep '^DEPLOYMENT_MODE=' | cut -d= -f2- || true)
ACTUAL_MODE=${ACTUAL_MODE:-"local"}

EXPECTED_MODE=${EXPECTED_MODE:-${DEPLOYMENT_MODE:-""}}
if [ -z "$EXPECTED_MODE" ]; then
    echo "❌ Deployment mode verification failed: EXPECTED_MODE is unset; explicit expected mode (local/global) must be defined."
    exit 1
fi

if [ "$ACTUAL_MODE" != "$EXPECTED_MODE" ]; then
    echo "❌ Deployment mode mismatch: container running in $ACTUAL_MODE, expected $EXPECTED_MODE"
    exit 1
fi
echo "✓ Healthcheck and deployment mode verified: $ACTUAL_MODE"

# 4. Verify pre-exposure writer hold is enforced
if ! echo "$CONTAINER_ENVS" | grep -q '^DISABLE_BACKGROUND_JOBS=true$'; then
    echo "❌ Pre-exposure verification failed: DISABLE_BACKGROUND_JOBS=true is not active!"
    exit 1
fi
echo "✓ Pre-exposure writer hold verified (background schedulers held)."

# Verify startup logs confirm additive migrations and writer suppression
docker compose ${COMPOSE_FILES} logs lims --tail 50 | grep -E "(Applying|Starting SoilFER-LIMS|Enterprise Server running)"
docker compose ${COMPOSE_FILES} logs lims --tail 50 | grep "\[SCHEDULER\] Background schedulers suppressed"
echo "✓ Startup logs and scheduler hold verified."

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

# 5b. Execute Pinned Issue #140 Scope & Catalogue Postflight Suite
echo "Executing pinned Issue #140 scope and catalogue postflight verification..."
docker compose ${COMPOSE_FILES} exec -T \
  -e POSTFLIGHT_BASE_URL="http://127.0.0.1:3000" \
  -e POSTFLIGHT_ADMIN_ID="${POSTFLIGHT_ADMIN_ID}" \
  -e POSTFLIGHT_MANAGER_ID="${POSTFLIGHT_MANAGER_ID}" \
  lims node scripts/postflight_issue140.cjs || {
    echo "❌ Pinned Issue #140 postflight suite failed!"
    exit 1
}
echo "✓ Pinned Issue #140 scope and catalogue verification passed."

# 6. Verify Database Records & Read-Only Role/API Postflight Gates with Reviewed Existing Principals
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

echo "Executing read-only role and route postflight protocol with reviewed principals..."
docker compose ${COMPOSE_FILES} exec -T \
  ${POSTFLIGHT_ADMIN_ID:+-e POSTFLIGHT_ADMIN_ID="$POSTFLIGHT_ADMIN_ID"} \
  ${POSTFLIGHT_MANAGER_ID:+-e POSTFLIGHT_MANAGER_ID="$POSTFLIGHT_MANAGER_ID"} \
  ${POSTFLIGHT_TECH_ID:+-e POSTFLIGHT_TECH_ID="$POSTFLIGHT_TECH_ID"} \
  lims node -e "
  const jwt = require('jsonwebtoken');
  const fs = require('fs');

  let secret = process.env.JWT_SECRET;
  if (!secret && fs.existsSync('prisma/.jwt_secret')) {
    secret = fs.readFileSync('prisma/.jwt_secret', 'utf8').trim();
  }
  if (!secret) {
    console.error('❌ Postflight failed: JWT secret not found!');
    process.exit(1);
  }

  const adminId = process.env.POSTFLIGHT_ADMIN_ID;
  const mgrId = process.env.POSTFLIGHT_MANAGER_ID;
  const techId = process.env.POSTFLIGHT_TECH_ID;

  if (!adminId || !mgrId || !techId) {
    console.error('❌ Postflight failed: POSTFLIGHT_ADMIN_ID, POSTFLIGHT_MANAGER_ID, and POSTFLIGHT_TECH_ID must all be explicitly defined.');
    process.exit(1);
  }

  const Database = require('better-sqlite3');
  let db;
  let adminPrincipal, mgrPrincipal, techPrincipal;
  try {
    db = new Database('prisma/dev.db', { readonly: true });
    adminPrincipal = db.prepare('SELECT id, username, role, labId, countries, projects, tokenVersion, mustChangePassword, isActive FROM User WHERE id = ?').get(adminId);
    mgrPrincipal = db.prepare('SELECT id, username, role, labId, countries, projects, tokenVersion, mustChangePassword, isActive FROM User WHERE id = ?').get(mgrId);
    techPrincipal = db.prepare('SELECT id, username, role, labId, countries, projects, tokenVersion, mustChangePassword, isActive FROM User WHERE id = ?').get(techId);
    db.close();
  } catch (err) {
    console.error('❌ Postflight failed: Database error looking up reviewed principals:', err.message);
    process.exit(1);
  }

  if (!adminPrincipal || adminPrincipal.role !== 'SUPER_ADMIN' || !adminPrincipal.isActive || adminPrincipal.mustChangePassword) {
    console.error('❌ Postflight failed: Reviewed active SUPER_ADMIN principal (' + adminId + ') not found, inactive, wrong role, or password not changed!');
    process.exit(1);
  }
  if (!mgrPrincipal || mgrPrincipal.role !== 'LAB_MANAGER' || !mgrPrincipal.isActive || mgrPrincipal.mustChangePassword) {
    console.error('❌ Postflight failed: Reviewed active LAB_MANAGER principal (' + mgrId + ') not found, inactive, wrong role, or password not changed!');
    process.exit(1);
  }
  if (!techPrincipal || techPrincipal.role !== 'LAB_TECHNICIAN' || !techPrincipal.isActive || techPrincipal.mustChangePassword) {
    console.error('❌ Postflight failed: Reviewed active LAB_TECHNICIAN principal (' + techId + ') not found, inactive, wrong role, or password not changed!');
    process.exit(1);
  }

  const superToken = jwt.sign({
    id: adminPrincipal.id,
    username: adminPrincipal.username,
    role: adminPrincipal.role,
    tokenVersion: adminPrincipal.tokenVersion || 0
  }, secret, { expiresIn: '5m' });

  const mgrToken = jwt.sign({
    id: mgrPrincipal.id,
    username: mgrPrincipal.username,
    role: mgrPrincipal.role,
    labId: mgrPrincipal.labId,
    tokenVersion: mgrPrincipal.tokenVersion || 0
  }, secret, { expiresIn: '5m' });

  const techToken = jwt.sign({
    id: techPrincipal.id,
    username: techPrincipal.username,
    role: techPrincipal.role,
    labId: techPrincipal.labId,
    tokenVersion: techPrincipal.tokenVersion || 0
  }, secret, { expiresIn: '5m' });

  function parseArray(val, fieldName) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) {
          console.error(\`❌ Malformed \${fieldName} metadata for principal: expected JSON array, got \${typeof parsed}\`);
          process.exit(1);
        }
        return parsed;
      } catch (err) {
        console.error(\`❌ Failed to parse \${fieldName} JSON metadata for principal: \${err.message}\`);
        process.exit(1);
      }
    }
    console.error(\`❌ Invalid \${fieldName} metadata for principal: expected array or string, got \${typeof val}\`);
    process.exit(1);
  }

  async function checkRoute(role, path, expectedStatus, token, principal) {
    const res = await fetch('http://localhost:3000' + path, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status !== expectedStatus) {
      console.error(\`❌ Role gate failed for \${role} on \${path}: expected \${expectedStatus}, got \${res.status}\`);
      process.exit(1);
    }
    let body;
    try {
      body = await res.json();
    } catch (err) {
      console.error(\`❌ Role gate failed for \${role} on \${path}: Response is not valid JSON (\${err.message})\`);
      process.exit(1);
    }
    if (!body || typeof body !== 'object') {
      console.error(\`❌ Role gate failed for \${role} on \${path}: Invalid response body structure\`);
      process.exit(1);
    }

    // Route-specific envelope and schema validation
    let records = [];
    if (path === '/api/work') {
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.data)) {
        console.error(\`❌ Invalid schema for \${path}: expected envelope object with array 'data'\`);
        process.exit(1);
      }
      records = body.data;
    } else if (path === '/api/users') {
      if (Array.isArray(body)) {
        records = body;
      } else if (Array.isArray(body.data)) {
        records = body.data;
      } else if (Array.isArray(body.users)) {
        records = body.users;
      } else {
        console.error(\`❌ Invalid schema for \${path}: expected array or envelope with 'data'/'users' array\`);
        process.exit(1);
      }
    } else if (path === '/api/labs' || path === '/api/submissions') {
      if (Array.isArray(body)) {
        records = body;
      } else if (Array.isArray(body.data)) {
        records = body.data;
      } else {
        console.error(\`❌ Invalid schema for \${path}: expected array of records\`);
        process.exit(1);
      }
    } else if (path === '/api/dashboard/live') {
      if (Array.isArray(body) || typeof body !== 'object') {
        console.error(\`❌ Invalid schema for \${path}: expected dashboard object\`);
        process.exit(1);
      }
      const queues = ['intakeQueue', 'reviewQueue', 'oversight'];
      for (const q of queues) {
        if (q in body && !Array.isArray(body[q])) {
          console.error(\`❌ Invalid schema for \${path}: queue '\${q}' must be an array\`);
          process.exit(1);
        }
      }
      records = [
        ...(Array.isArray(body.intakeQueue) ? body.intakeQueue : []),
        ...(Array.isArray(body.reviewQueue) ? body.reviewQueue : []),
        ...(Array.isArray(body.oversight) ? body.oversight : [])
      ];
    } else {
      if (Array.isArray(body)) {
        records = body;
      } else if (Array.isArray(body.data)) {
        records = body.data;
      } else {
        console.error(\`❌ Invalid schema for \${path}: unknown envelope\`);
        process.exit(1);
      }
    }

    // Validate that every record in records is a valid, non-null record object
    for (const item of records) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        console.error(\`❌ Role gate failed for \${role} on \${path}: Record is not a valid non-null object (\${JSON.stringify(item)})\`);
        process.exit(1);
      }
    }

    // Route-specific and role-specific scope validation
    if (principal.role !== 'SUPER_ADMIN') {
      const userLabId = principal.labId || null;
      const userProjects = parseArray(principal.projects, 'projects');
      const userCountries = parseArray(principal.countries, 'countries');

      for (const item of records) {
        // 1. Facility assignedLab scoping (distinguished from specimen accession labId)
        if (userLabId) {
          if (item.assignedLab && item.assignedLab !== userLabId) {
            console.error(\`❌ Scope violation: item assignedLab '\${item.assignedLab}' does not match principal labId '\${userLabId}' for \${role} on \${path}\`);
            process.exit(1);
          }
        } else {
          // Principal has NO assigned lab: must not receive facility-assigned records unless authorized by project/country
          if (item.assignedLab) {
            if (!userProjects.length || (item.projectCode && !userProjects.includes(item.projectCode))) {
              console.error(\`❌ Scope violation: unassigned-lab principal received facility record '\${item.assignedLab}' for \${role} on \${path}\`);
              process.exit(1);
            }
          }
        }

        // 2. Project scoping (route-specific):
        // /api/submissions controller scopes LAB_MANAGER strictly by assignedLab (facility),
        // so an own-facility manager legitimately processes samples from any project at their lab.
        // For other routes or when userLabId is not set, enforce project allow-list.
        if (path !== '/api/submissions' || !userLabId) {
          if (userProjects.length > 0 && item.projectCode && !userProjects.includes(item.projectCode)) {
            console.error(\`❌ Scope violation: item projectCode '\${item.projectCode}' outside authorized projects for \${role} on \${path}\`);
            process.exit(1);
          }
        }

        // 3. Country scoping
        if (item.country && !userCountries.includes('*') && !userCountries.includes(item.country)) {
          console.error(\`❌ Scope violation: item country '\${item.country}' outside authorized countries for \${role} on \${path}\`);
          process.exit(1);
        }

        // 4. Lab catalogue scoping on /api/labs
        if (path === '/api/labs' && userLabId && item.id && item.id !== userLabId) {
          console.error(\`❌ Scope violation: lab ID '\${item.id}' does not match principal labId '\${userLabId}' for \${role} on \${path}\`);
          process.exit(1);
        }

        // 5. Unscoped principal receiving scoped record
        if (!userLabId && userProjects.length === 0 && userCountries.length === 0) {
          if (item.assignedLab || item.projectCode || item.country) {
            console.error(\`❌ Scope violation: unscoped principal received scoped record for \${role} on \${path}\`);
            process.exit(1);
          }
        }
      }
    }
    console.log(\`  ✓ \${role} -> \${path} (\${res.status} OK)\`);
  }

  (async () => {
    await checkRoute('SUPER_ADMIN', '/api/users', 200, superToken, adminPrincipal);
    await checkRoute('SUPER_ADMIN', '/api/labs', 200, superToken, adminPrincipal);
    await checkRoute('LAB_MANAGER', '/api/dashboard/live', 200, mgrToken, mgrPrincipal);
    await checkRoute('LAB_MANAGER', '/api/submissions', 200, mgrToken, mgrPrincipal);
    await checkRoute('LAB_TECHNICIAN', '/api/work', 200, techToken, techPrincipal);
    console.log('✓ Read-only role and route API postflight gates verified.');
  })().catch(e => { console.error('Postflight API error:', e.message); process.exit(1); });
"

# 7. Verify NGINX Ingress Hold (if deployed with NGINX overlay)
if echo "${COMPOSE_FILES}" | grep -q "docker-compose\.nginx\.yml"; then
    echo "NGINX reverse proxy overlay is configured; verifying ingress is held..."
    NGINX_CONTAINER=$(docker compose ${COMPOSE_FILES} ps -q nginx) || {
        echo "❌ Failed to query NGINX container status via docker compose ps!"
        exit 1
    }
    TARGET_NGINX="${NGINX_CONTAINER:-${BASELINE_NGINX_CONTAINER}}"
    if [ -n "$TARGET_NGINX" ]; then
        NGINX_RUNNING=$(docker inspect -f '{{.State.Running}}' "$TARGET_NGINX") || {
            echo "❌ Failed to inspect NGINX container state!"
            exit 1
        }
        if [ "$NGINX_RUNNING" = "true" ]; then
            echo "❌ NGINX reverse proxy is unexpectedly running; ingress hold violated!"
            exit 1
        elif [ "$NGINX_RUNNING" != "false" ]; then
            echo "❌ Unexpected NGINX container state '\${NGINX_RUNNING}'!"
            exit 1
        fi
    fi
    echo "✓ Public ingress hold verified (NGINX proxy inactive during pre-exposure postflight)."
else
    echo "Verifying direct topology client ingress hold..."
    if ! HOST_BIND_IP=$(docker inspect "$LIVE_CONTAINER_ID" --format '{{range $p, $conf := .NetworkSettings.Ports}}{{range $conf}}{{.HostIp}}{{end}}{{end}}'); then
        echo "❌ Failed to inspect direct container port binding!"
        exit 1
    fi
    if [ "$HOST_BIND_IP" = "0.0.0.0" ]; then
        echo "❌ Direct application port is exposed on public interface (0.0.0.0); ingress hold violated!"
        exit 1
    fi
    echo "✓ Direct client ingress hold verified (application port bounded to host loopback ${HOST_BIND_IP:-127.0.0.1} during pre-exposure postflight)."
fi
```

### Step 6: Release Commitment & Ingress Reopening

#### 1. Commit Decision Gate
Once all Step 5 postflight checks pass:
- Image ID verified (`TARGET_IMAGE_ID`)
- Volume mounts verified (`DATA_VOLUME`, `ASSETS_VOLUME`)
- HTTP 200 healthcheck & deployment mode verified (`EXPECTED_MODE`)
- Pre-exposure writer hold verified (`DISABLE_BACKGROUND_JOBS=true`)
- Database integrity and foreign key checks verified
- Database records and role/API access verified with reviewed existing principals
- NGINX ingress hold verified (if configured)

The upgrade is officially declared **COMMITTED**.
- If any check in Step 5 failed, no background writes or user writes occurred; the system can be safely restored via Route A / Route B rollback.
- Once COMMITTED, the deployment transitions to normal production mode, background schedulers are enabled, and ingress is reopened.

#### 2. Transition to Normal Production & Schedulers Activation
```bash
set -e

# Transition to normal production: remove DISABLE_BACKGROUND_JOBS and activate schedulers on LIMS
docker compose ${COMPOSE_FILES} up -d lims

# Verify final runtime container environment: must be NODE_ENV=production with all schedulers enabled
FINAL_CONTAINER_ID=$(docker compose ${COMPOSE_FILES} ps -q lims)
FINAL_ENVS=$(docker inspect "$FINAL_CONTAINER_ID" --format '{{range .Config.Env}}{{println .}}{{end}}') || {
    echo "❌ Failed to inspect final container environment"
    exit 1
}

# Require explicit NODE_ENV=production
if ! echo "$FINAL_ENVS" | grep -q '^NODE_ENV=production$'; then
    echo "❌ Final container is not running in production mode (NODE_ENV=production required)!"
    exit 1
fi

# Reject scheduler suppression flags
if echo "$FINAL_ENVS" | grep -q '^DISABLE_BACKGROUND_JOBS=true$'; then
    echo "❌ Final production container unexpectedly retains DISABLE_BACKGROUND_JOBS=true!"
    exit 1
fi

if echo "$FINAL_ENVS" | grep -q '^ENABLE_BACKGROUND_JOBS=false$'; then
    echo "❌ Final production container unexpectedly retains ENABLE_BACKGROUND_JOBS=false!"
    exit 1
fi

echo "✓ Final container verified in normal production mode (schedulers active)."

# Verify startup logs confirm background schedulers initialized
docker compose ${COMPOSE_FILES} logs lims --tail 50 | grep "\[SCHEDULER\] Escalation background scheduler initialized"
echo "✓ Background scheduler initialization verified."
```

#### 3. Ingress Reopening & Post-Commit Recovery Rules
- **Ingress Reopening:** Reopen public ingress at reverse proxy / load-balancer boundary. External laboratory transactions resume:
```bash
if [ -f "docker-compose.nginx.yml" ] && echo "$COMPOSE_FILES" | grep -q "docker-compose.nginx.yml"; then
    echo "Reopening public ingress at NGINX reverse proxy boundary..."
    docker compose ${COMPOSE_FILES} up -d nginx
    NGINX_CONTAINER=$(docker compose ${COMPOSE_FILES} ps -q nginx) || {
        echo "❌ Failed to query NGINX container status via docker compose ps!"
        exit 1
    }
    if [ -z "$NGINX_CONTAINER" ]; then
        echo "❌ NGINX reverse proxy container is missing!"
        exit 1
    fi
    NGINX_RUNNING=$(docker inspect -f '{{.State.Running}}' "$NGINX_CONTAINER") || {
        echo "❌ Failed to inspect NGINX container state!"
        exit 1
    }
    if [ "$NGINX_RUNNING" != "true" ]; then
        echo "❌ NGINX reverse proxy container is not running (State.Running: $NGINX_RUNNING)!"
        exit 1
    fi
    curl -fsSL http://localhost/api/health >/dev/null || { echo "❌ Ingress check via NGINX port 80 failed!"; exit 1; }
    echo "✓ Ingress reopened and verified healthy at NGINX reverse proxy boundary."
else
    echo "Reopening public ingress for direct topology..."
    PORT="${PRODUCTION_PORT:-3000}" docker compose ${COMPOSE_FILES} up -d lims
    curl -fsSL "http://localhost:${PRODUCTION_PORT:-3000}/api/health" >/dev/null || { echo "❌ Ingress check via direct port failed!"; exit 1; }
    echo "✓ Ingress reopened and verified healthy on direct application port."
fi
```
- **CRITICAL INVARIANT:** Once new analytical writes have resumed after cutover, **DO NOT execute Route A or Route B database volume restoration**. Restoring an earlier database snapshot rewinds analytical history and permanently destroys newly ingested samples and client results.

If an issue arises *after* writes have resumed, follow the permitted post-commit recovery paths:
1. **Code/Image Rollback (No Volume Rewind):** Revert the container image tag back to `BASELINE_IMAGE_ID` without restoring old volume archives (`LIMS_IMAGE_TAG=rollback-${TIMESTAMP} docker compose ${COMPOSE_FILES} up -d`). Because database schema migrations in SoilFER LIMS are strictly additive and backward-compatible, the baseline application safely runs against the current database schema without rewinding data.
2. **Forward Fix:** Deploy an urgent hotfix patch containing the targeted resolution.
3. **Reconciled Restore (Disaster Only):** If volume restoration is unavoidable due to catastrophic volume corruption, all analytical writes ingested since cutover must be manually exported, the volume restored, and writes manually reconciled.

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
When restoring complete volume tarballs, stage and validate both database and assets archives in `/backup/staging` **before** modifying target volumes, preserve full pre-restore safety copies (including hidden `.jwt_secret` and WAL/SHM sidecars), and fail closed on any error without swallowing failures:

```bash
set -e

RESTORE_TS="<timestamp-of-target-backup>"

# 1. Stage and Verify Paired Archives in Staging Directory First (Fail-Closed)
docker run --rm \
  -v "$(pwd)/backups:/backup" \
  "${BASELINE_IMAGE_ID}" \
  sh -c "
    set -e
    if [ ! -f \"/backup/db_snapshot_${RESTORE_TS}.tar.gz\" ] || [ ! -f \"/backup/assets_snapshot_${RESTORE_TS}.tar.gz\" ]; then
      echo '❌ Missing required backup archive pair (db and assets). Aborting.'
      exit 1
    fi
    rm -rf /backup/staging
    mkdir -p /backup/staging/db /backup/staging/assets
    tar -xzf \"/backup/db_snapshot_${RESTORE_TS}.tar.gz\" -C /backup/staging/db
    tar -xzf \"/backup/assets_snapshot_${RESTORE_TS}.tar.gz\" -C /backup/staging/assets
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

# 3. Sequentially Replace Target Volume Contents from Verified Staging (Writers Quiesced)
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "${ASSETS_VOLUME}:/assets" \
  -v "$(pwd)/backups:/backup" \
  alpine sh -c "
    set -e
    # Fail-closed cleanup of target data volume (clears dotfiles safely without erroring on . or ..)
    find /data -mindepth 1 -delete
    cp -a /backup/staging/db/. /data/

    # Fail-closed cleanup of target assets volume; copies staged assets (properly restores empty state if archive was empty)
    find /assets -mindepth 1 -delete
    cp -a /backup/staging/assets/. /assets/

    rm -rf /backup/staging
    echo '✓ Staged volume contents sequentially copied to target volumes.'
  "

# 4. Verify Restored Volume and Rotate Exchange Epoch
docker run --rm \
  -v "${DATA_VOLUME}:/app/server/prisma" \
  "${BASELINE_IMAGE_ID}" \
  node -e "
    const Database = require('better-sqlite3');
    const exchange = require('./services/exchangeStateService');
    const { rotateEpoch, ensureTriggers } = exchange;
    const db = typeof exchange.getDb === 'function' ? exchange.getDb() : new Database('prisma/dev.db');
    const integrity = db.pragma('integrity_check');
    const fk = db.pragma('foreign_key_check');
    if (integrity[0]?.integrity_check !== 'ok' || fk.length > 0) {
      console.error('Restored volume database integrity check failed:', integrity, fk);
      process.exit(1);
    }
    if (typeof exchange.initTables === 'function') exchange.initTables(db);
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
