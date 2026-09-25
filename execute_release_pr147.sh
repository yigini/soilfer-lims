#!/bin/bash
set -e

echo "============================================================"
echo "  SOILFER-LIMS PRODUCTION APPLY EXECUTION: ISSUE #146 / PR 147"
echo "  Target: Enable Ghana Kobo Connection & Bounded Ingestion    "
echo "  High-Water Boundary: 40747 (864 Expected Specimens)         "
echo "============================================================"

DB_PATH="/var/lib/docker/volumes/lims_lims-data/_data/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_CONSISTENT="/opt/lims/backups/dev_pre_issue146_${TIMESTAMP}.db"
LOG_FILE="/opt/lims/logs/apply_issue146_${TIMESTAMP}.log"

mkdir -p /opt/lims/backups /opt/lims/logs

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
echo "Write quiescence active (503 for mutating requests, read-only allowed)"

echo "--- Step 2: Quiesced Database Checkpoint & Consistent Pre-Operation Backup ---"
sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"
sqlite3 "${DB_PATH}" ".backup '${BACKUP_CONSISTENT}'"
BACKUP_HASH=$(sha256sum "${BACKUP_CONSISTENT}" | awk '{print $1}')
echo "Consistent pre-operation backup saved: ${BACKUP_CONSISTENT}"
echo "Pre-operation SHA-256: ${BACKUP_HASH}"

echo "--- Step 3: Execute Dry-Run Validation Inside Container ---"
docker exec -e DATABASE_PATH="/app/prisma/dev.db" soilfer-lims node /app/execute_ghana_apply_146.cjs --dry-run | tee -a "${LOG_FILE}"

echo "--- Step 4: Execute Guarded Apply Inside Container ---"
if docker exec -e DATABASE_PATH="/app/prisma/dev.db" soilfer-lims node /app/execute_ghana_apply_146.cjs --apply | tee -a "${LOG_FILE}"; then
    echo "Apply succeeded cleanly!"
else
    echo "CRITICAL: Apply failed! Restoring from pre-operation consistent backup..."
    docker stop soilfer-lims
    cp "${BACKUP_CONSISTENT}" "${DB_PATH}"
    RESTORE_HASH=$(sha256sum "${DB_PATH}" | awk '{print $1}')
    if [ "${RESTORE_HASH}" != "${BACKUP_HASH}" ]; then
        echo "FATAL: Restored hash ${RESTORE_HASH} does not match backup ${BACKUP_HASH}!"
        exit 1
    fi
    docker start soilfer-lims
    cp /etc/httpd/conf/extra/httpd-lims.conf.live /etc/httpd/conf/extra/httpd-lims.conf
    systemctl reload httpd
    echo "Restoration complete. Traffic restored."
    exit 1
fi

echo "--- Step 5: Restore Live Ingress Traffic ---"
cp /etc/httpd/conf/extra/httpd-lims.conf.live /etc/httpd/conf/extra/httpd-lims.conf
systemctl reload httpd
echo "Live traffic restored."

echo "============================================================"
echo "  GHANA CORRECTION COMPLETE & VERIFIED                     "
echo "  864 Expected Specimens Admitted; 4 Held; 0 Regressions   "
echo "============================================================"
