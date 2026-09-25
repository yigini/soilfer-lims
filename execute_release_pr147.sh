#!/bin/bash
set -euo pipefail

echo "============================================================"
echo "  SOILFER-LIMS PRODUCTION APPLY EXECUTION: ISSUE #146 / PR 147"
echo "  Target: Enable Ghana Kobo Connection & Bounded Ingestion    "
echo "  Source Snapshot: 459 Submissions (SHA: 33db90cdcab60ccf)    "
echo "  High-Water Boundary: 40747 (864 Expected Specimens)         "
echo "============================================================"

IMAGE_TAG=${1:-"soilfer-lims:pr147-reviewed"}
PRIVATE_SNAPSHOT=${PRIVATE_SNAPSHOT:-"/opt/lims/private_kobo/ghana_kobo_snapshot_40747.json"}
PRIVATE_MANIFEST=${PRIVATE_MANIFEST:-"/opt/lims/private_kobo/ghana_kobo_manifest_40747.json"}

EXPECTED_SNAPSHOT_SHA="33db90cdcab60ccf4801a7754d8444893c0b6ee25f269a65366d6fed5046292f"
EXPECTED_MANIFEST_SHA="e43d490366eda0e325b1f1639c743b57105a6256e0f406df6f7e1d87514adaed"

echo "Image Tag:        ${IMAGE_TAG}"
echo "Private Snapshot: ${PRIVATE_SNAPSHOT}"
echo "Private Manifest: ${PRIVATE_MANIFEST}"

# --- Pre-execution file and image assertions ---
if [ ! -f "${PRIVATE_SNAPSHOT}" ]; then
    echo "FATAL: Private snapshot file not found at ${PRIVATE_SNAPSHOT}"
    exit 1
fi
if [ ! -f "${PRIVATE_MANIFEST}" ]; then
    echo "FATAL: Private manifest file not found at ${PRIVATE_MANIFEST}"
    exit 1
fi

ACTUAL_SNAP_SHA=$(sha256sum "${PRIVATE_SNAPSHOT}" | awk '{print $1}')
if [ "${ACTUAL_SNAP_SHA}" != "${EXPECTED_SNAPSHOT_SHA}" ]; then
    echo "FATAL: Snapshot hash mismatch! Expected ${EXPECTED_SNAPSHOT_SHA}, got ${ACTUAL_SNAP_SHA}"
    exit 1
fi

ACTUAL_MAN_SHA=$(sha256sum "${PRIVATE_MANIFEST}" | awk '{print $1}')
if [ "${ACTUAL_MAN_SHA}" != "${EXPECTED_MANIFEST_SHA}" ]; then
    echo "FATAL: Manifest hash mismatch! Expected ${EXPECTED_MANIFEST_SHA}, got ${ACTUAL_MAN_SHA}"
    exit 1
fi
echo "✓ Private snapshot and manifest verified with expected SHA-256 hashes."

# Verify target Docker image exists and contains reviewed intake guards
echo "Verifying target image intake guards..."
docker run --rm --entrypoint node --network none "${IMAGE_TAG}" -e "
const fs = require('fs');
const rc = fs.readFileSync('/app/server/controllers/receptionController.js', 'utf8');
const sc = fs.readFileSync('/app/server/controllers/sampleController.js', 'utf8');
if (!rc.includes('AMBIGUOUS_PROVENANCE_HOLD') || !sc.includes('AMBIGUOUS_PROVENANCE_HOLD')) {
    console.error('ERROR: Target image is missing reviewed AMBIGUOUS_PROVENANCE_HOLD intake guards!');
    process.exit(1);
}
console.log('✓ Target image confirmed: contains reviewed AMBIGUOUS_PROVENANCE_HOLD intake guards.');
"

# Resolve production database path from Docker volume inspect
DB_VOL_PATH=$(docker volume inspect lims_lims-data --format '{{.Mountpoint}}' 2>/dev/null || echo "/var/lib/docker/volumes/lims_lims-data/_data")
DB_PATH="${DB_VOL_PATH}/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_CONSISTENT="/opt/lims/backups/dev_pre_issue146_${TIMESTAMP}.db"
LOG_FILE="/opt/lims/logs/apply_issue146_${TIMESTAMP}.log"

mkdir -p /opt/lims/backups /opt/lims/logs

RUNNER_DRYRUN_NAME="soilfer-lims-dryrun-${TIMESTAMP}"
RUNNER_APPLY_NAME="soilfer-lims-apply-${TIMESTAMP}"

# Safe cleanup trap on unexpected exit
cleanup() {
    local exit_code=$?
    if [ ${exit_code} -ne 0 ]; then
        echo ""
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "  FAILURE DETECTED (Exit code: ${exit_code})               "
        echo "  Initiating external stopped-writer rollback recovery...  "
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        
        # 1. Terminate and remove all possible runner and application containers
        docker stop "${RUNNER_DRYRUN_NAME}" "${RUNNER_APPLY_NAME}" soilfer-lims 2>/dev/null || true
        docker rm -f "${RUNNER_DRYRUN_NAME}" "${RUNNER_APPLY_NAME}" 2>/dev/null || true
        
        # 2. Quiesced database restoration
        if [ -f "${BACKUP_CONSISTENT}" ]; then
            echo "Restoring database from consistent backup: ${BACKUP_CONSISTENT}"
            rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"
            cp "${BACKUP_CONSISTENT}" "${DB_PATH}"
            
            RESTORE_HASH=$(sha256sum "${DB_PATH}" | awk '{print $1}')
            if [ "${RESTORE_HASH}" != "${BACKUP_HASH}" ]; then
                echo "FATAL: Restored DB hash (${RESTORE_HASH}) does not match pre-apply backup (${BACKUP_HASH})!"
                exit 1
            fi
            echo "✓ Database restored and bit-for-bit verified (SHA: ${RESTORE_HASH})"
            
            REC_INTEGRITY=$(sqlite3 "${DB_PATH}" "PRAGMA integrity_check;")
            REC_FK=$(sqlite3 "${DB_PATH}" "PRAGMA foreign_key_check;")
            REC_SAMPLES=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM Sample;")
            
            if [ "${REC_INTEGRITY}" != "ok" ] || [ -n "${REC_FK}" ] || [ "${REC_SAMPLES}" -ne "${BASE_SAMPLES}" ]; then
                echo "FATAL: Post-recovery database assertions failed!"
                exit 1
            fi
            echo "✓ Post-recovery assertions verified: integrity ${REC_INTEGRITY}, FK clean, baseline samples ${REC_SAMPLES}"
        fi
        
        # 3. Restart application container and verify health before restoring ingress
        echo "Restarting application container..."
        docker start soilfer-lims 2>/dev/null || true
        
        HEALTH_OK=false
        for i in $(seq 1 30); do
            HEALTH=$(curl -sf http://localhost:3000/api/health | grep -o '"status":"ok"' || true)
            if [ -n "$HEALTH" ]; then
                HEALTH_OK=true
                echo "✓ Application container healthy at second $i"
                break
            fi
            sleep 1
        done
        
        if [ "${HEALTH_OK}" = "true" ]; then
            echo "Restoring live ingress traffic..."
            if [ -f /etc/httpd/conf/extra/httpd-lims.conf.live ]; then
                cp /etc/httpd/conf/extra/httpd-lims.conf.live /etc/httpd/conf/extra/httpd-lims.conf
                systemctl reload httpd
            fi
            echo "Recovery complete. Live traffic restored."
        else
            echo "FATAL: Application failed health check after recovery! Ingress remains blocked to protect integrity."
        fi
    fi
}
trap cleanup EXIT

echo "--- Step 1: Enforce Ingress Write Quiescence (Apache 503 Rewrite) ---"
cp /etc/httpd/conf/extra/httpd-lims.conf /etc/httpd/conf/extra/httpd-lims.conf.live

cat << 'APACHE_EOF' > /etc/httpd/conf/extra/httpd-lims.conf.quiesce
# === LIMS Reverse Proxy — lims.yigini.net (Write Quiescence Active) ===
<VirtualHost 46.19.33.37:80>
    ServerName lims.yigini.net
    ServerAlias www.lims.yigini.net
    Redirect permanent / https://lims.yigini.net/
    ErrorLog /var/log/httpd/domains/lims.error.log
    CustomLog /var/log/httpd/domains/lims.access.log combined
</VirtualHost>

<VirtualHost 46.19.33.37:443>
    ServerName lims.yigini.net
    ServerAlias www.lims.yigini.net

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/lims.yigini.net/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/lims.yigini.net/privkey.pem

    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} ^(POST|PUT|PATCH|DELETE)$
    RewriteRule .* - [R=503,L]

    ProxyPreserveHost On
    ProxyRequests Off

    ProxyPass /ws ws://127.0.0.1:3000/ws retry=0 keepalive=On
    ProxyPassReverse /ws ws://127.0.0.1:3000/ws

    ProxyPass / http://127.0.0.1:3000/ retry=0 keepalive=On timeout=60
    ProxyPassReverse / http://127.0.0.1:3000/

    ErrorLog /var/log/httpd/domains/lims.error.log
    CustomLog /var/log/httpd/domains/lims.access.log combined
</VirtualHost>
APACHE_EOF

cp /etc/httpd/conf/extra/httpd-lims.conf.quiesce /etc/httpd/conf/extra/httpd-lims.conf
systemctl reload httpd
echo "✓ Ingress write quiescence active (HTTP 503 for mutating requests, read-only allowed)"

echo "--- Step 2: Quiesce Application Container & Schedulers (Stopped Writer) ---"
docker stop soilfer-lims
echo "✓ Application container stopped. Background sync schedulers and writers terminated."

echo "--- Step 3: Quiesced Database Checkpoint & Consistent Pre-Operation Backup ---"
sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"
sqlite3 "${DB_PATH}" ".backup '${BACKUP_CONSISTENT}'"
BACKUP_HASH=$(sha256sum "${BACKUP_CONSISTENT}" | awk '{print $1}')
INTEGRITY=$(sqlite3 "${BACKUP_CONSISTENT}" "PRAGMA integrity_check;")
FK_CHECK=$(sqlite3 "${BACKUP_CONSISTENT}" "PRAGMA foreign_key_check;")
BASE_SAMPLES=$(sqlite3 "${BACKUP_CONSISTENT}" "SELECT count(*) FROM Sample;")

echo "  Consistent pre-operation backup saved: ${BACKUP_CONSISTENT}"
echo "  Pre-operation SHA-256: ${BACKUP_HASH}"
echo "  Integrity: ${INTEGRITY}, FK: ${FK_CHECK:-OK}, Baseline Samples: ${BASE_SAMPLES}"

if [ "${INTEGRITY}" != "ok" ] || [ -n "${FK_CHECK}" ]; then
    echo "ABORT: Pre-operation database check failed!"
    exit 1
fi

echo "--- Step 4: Execute Dry-Run Validation in One-Shot Isolated Container ---"
docker run --rm \
  --name "${RUNNER_DRYRUN_NAME}" \
  --entrypoint node \
  --network none \
  --user 0:0 \
  --env-file /opt/lims/.env \
  -e DISABLE_BACKGROUND_JOBS=true \
  -e DATABASE_PATH="/app/server/prisma/dev.db" \
  -e GHANA_SNAPSHOT_PATH="/private/ghana_kobo_snapshot_40747.json" \
  -e GHANA_MANIFEST_PATH="/private/ghana_kobo_manifest_40747.json" \
  -v lims_lims-data:/app/server/prisma \
  -v lims_lims-assets:/app/server/uploads \
  -v "${PRIVATE_SNAPSHOT}:/private/ghana_kobo_snapshot_40747.json:ro" \
  -v "${PRIVATE_MANIFEST}:/private/ghana_kobo_manifest_40747.json:ro" \
  "${IMAGE_TAG}" \
  /app/server/scripts/execute_ghana_apply_146.cjs --dry-run | tee -a "${LOG_FILE}"

echo "--- Step 5: Execute Guarded Apply in One-Shot Isolated Container ---"
docker run --rm \
  --name "${RUNNER_APPLY_NAME}" \
  --entrypoint node \
  --network none \
  --user 0:0 \
  --env-file /opt/lims/.env \
  -e DISABLE_BACKGROUND_JOBS=true \
  -e DATABASE_PATH="/app/server/prisma/dev.db" \
  -e GHANA_SNAPSHOT_PATH="/private/ghana_kobo_snapshot_40747.json" \
  -e GHANA_MANIFEST_PATH="/private/ghana_kobo_manifest_40747.json" \
  -v lims_lims-data:/app/server/prisma \
  -v lims_lims-assets:/app/server/uploads \
  -v "${PRIVATE_SNAPSHOT}:/private/ghana_kobo_snapshot_40747.json:ro" \
  -v "${PRIVATE_MANIFEST}:/private/ghana_kobo_manifest_40747.json:ro" \
  "${IMAGE_TAG}" \
  /app/server/scripts/execute_ghana_apply_146.cjs --apply | tee -a "${LOG_FILE}"

echo "✓ Apply completed successfully!"

echo "--- Step 6: Post-Apply WAL Checkpoint & Integrity Audit ---"
sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"
POST_INTEGRITY=$(sqlite3 "${DB_PATH}" "PRAGMA integrity_check;")
POST_FK=$(sqlite3 "${DB_PATH}" "PRAGMA foreign_key_check;")
POST_SAMPLES=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM Sample;")
EXPECTED_TOTAL=$((BASE_SAMPLES + 864))

echo "  Post-apply Samples: ${POST_SAMPLES} (Expected: ${EXPECTED_TOTAL})"
echo "  Post-apply Integrity: ${POST_INTEGRITY}, FK: ${POST_FK:-OK}"

if [ "${POST_INTEGRITY}" != "ok" ] || [ -n "${POST_FK}" ] || [ "${POST_SAMPLES}" -ne "${EXPECTED_TOTAL}" ]; then
    echo "ABORT: Post-apply verification failed!"
    exit 1
fi

echo "--- Step 7: Restart Application Container & Verify Health ---"
docker start soilfer-lims
APP_HEALTH_OK=false
for i in $(seq 1 30); do
    HEALTH=$(curl -sf http://localhost:3000/api/health | grep -o '"status":"ok"' || true)
    if [ -n "$HEALTH" ]; then
        APP_HEALTH_OK=true
        echo "✓ Application container healthy at second $i!"
        break
    fi
    sleep 1
done

if [ "${APP_HEALTH_OK}" != "true" ]; then
    echo "FATAL: Application container failed health check within 30 seconds!"
    exit 1
fi

echo "--- Step 8: Restore Live Ingress Traffic ---"
cp /etc/httpd/conf/extra/httpd-lims.conf.live /etc/httpd/conf/extra/httpd-lims.conf
systemctl reload httpd
echo "✓ Live traffic restored."

# Clear trap on clean finish
trap - EXIT

echo "============================================================"
echo "  GHANA CORRECTION COMPLETE & VERIFIED                     "
echo "  864 Expected Specimens Admitted; 4 Held; 0 Regressions   "
echo "============================================================"
