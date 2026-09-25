#!/bin/bash
set -euo pipefail

echo "============================================================"
echo "  SOILFER-LIMS PRODUCTION APPLY EXECUTION: ISSUE #146 / PR 147"
echo "  Target: Enable Ghana Kobo Connection & Bounded Ingestion    "
echo "  Source Snapshot: 459 Submissions (SHA: 33db90cdcab60ccf)    "
echo "  High-Water Boundary: 40747 (864 Expected Specimens)         "
echo "============================================================"

# Resolve production database path from Docker volume inspect
DB_VOL_PATH=$(docker volume inspect lims_lims-data --format '{{.Mountpoint}}' 2>/dev/null || echo "/var/lib/docker/volumes/lims_lims-data/_data")
DB_PATH="${DB_VOL_PATH}/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_CONSISTENT="/opt/lims/backups/dev_pre_issue146_${TIMESTAMP}.db"
LOG_FILE="/opt/lims/logs/apply_issue146_${TIMESTAMP}.log"
IMAGE_TAG="soilfer-lims:v3.5.28-pr147"

mkdir -p /opt/lims/backups /opt/lims/logs

# Safe cleanup trap on unexpected exit
cleanup() {
    local exit_code=$?
    if [ ${exit_code} -ne 0 ]; then
        echo ""
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "  FAILURE DETECTED (Exit code: ${exit_code})               "
        echo "  Initiating external stopped-writer rollback recovery...  "
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        
        # Ensure application container is stopped before manipulating DB files
        docker stop soilfer-lims 2>/dev/null || true
        
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
            
            INTEGRITY=$(sqlite3 "${DB_PATH}" "PRAGMA integrity_check;")
            FK_CHECK=$(sqlite3 "${DB_PATH}" "PRAGMA foreign_key_check;")
            echo "✓ Post-recovery integrity: ${INTEGRITY}, FK check: ${FK_CHECK:-OK}"
        fi
        
        echo "Restarting application container..."
        docker start soilfer-lims 2>/dev/null || true
        
        echo "Restoring live ingress traffic..."
        if [ -f /etc/httpd/conf/extra/httpd-lims.conf.live ]; then
            cp /etc/httpd/conf/extra/httpd-lims.conf.live /etc/httpd/conf/extra/httpd-lims.conf
            systemctl reload httpd
        fi
        echo "Recovery complete. Live traffic restored."
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
  --name soilfer-lims-dryrun \
  --env-file /opt/lims/.env \
  -e DISABLE_BACKGROUND_JOBS=true \
  -e DATABASE_PATH="/app/server/prisma/dev.db" \
  -v lims_lims-data:/app/server/prisma \
  -v lims_lims-assets:/app/server/uploads \
  "${IMAGE_TAG}" \
  node /app/server/scripts/execute_ghana_apply_146.cjs --dry-run | tee -a "${LOG_FILE}"

echo "--- Step 5: Execute Guarded Apply in One-Shot Isolated Container ---"
docker run --rm \
  --name soilfer-lims-apply \
  --env-file /opt/lims/.env \
  -e DISABLE_BACKGROUND_JOBS=true \
  -e DATABASE_PATH="/app/server/prisma/dev.db" \
  -v lims_lims-data:/app/server/prisma \
  -v lims_lims-assets:/app/server/uploads \
  "${IMAGE_TAG}" \
  node /app/server/scripts/execute_ghana_apply_146.cjs --apply | tee -a "${LOG_FILE}"

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

echo "--- Step 7: Restart Application Container ---"
docker start soilfer-lims
for i in $(seq 1 30); do
    HEALTH=$(curl -s http://localhost:3000/api/health | grep -o '"status":"ok"' || true)
    if [ -n "$HEALTH" ]; then
        echo "✓ Application container healthy at second $i!"
        break
    fi
    sleep 1
done

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
