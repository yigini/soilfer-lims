#!/bin/bash
set -e

echo "============================================================"
echo "  SOILFER-LIMS RELEASE EXECUTION: 2032617 (PR 130 + PR 131) "
echo "  Commit: 2032617d30282acc7337dc86ceda87ae5eb65f5b         "
echo "  Image:  soilfer-lims:v3.5.18-2032617                      "
echo "============================================================"

DB_PATH="/var/lib/docker/volumes/lims_lims-data/_data/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_CONSISTENT="/opt/lims/backups/dev_release_2032617_consistent_${TIMESTAMP}.db"

echo "--- Step 1: Preserve Rollback Baseline (Currently Serving 7516f0e) ---"
docker tag soilfer-lims:v3.5.17-7516f0e soilfer-lims:rollback-baseline
BASELINE_ID=$(docker inspect soilfer-lims:rollback-baseline --format '{{.Id}}' | cut -c 8-19)
echo "Rollback baseline preserved: soilfer-lims:rollback-baseline (Image ID: ${BASELINE_ID})"

echo "--- Step 2: Enforce Ingress Write Quiescence (Apache 503 Rewrite) ---"
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
apachectl configtest
systemctl reload httpd

POST_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://lims.yigini.net/api/test-mutation || true)
GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://lims.yigini.net/api/health || true)
echo "Ingress quiescence check: POST -> ${POST_CODE} (expected 503), GET -> ${GET_CODE} (expected 200)"

if [ "${POST_CODE}" != "503" ]; then
    echo "ABORT: Ingress write quiescence not active!"
    exit 1
fi

echo "--- Step 3: Stop Active Container and Quiesce Background Writers ---"
docker stop soilfer-lims
echo "Active container stopped. All background sync and escalation writers terminated."

echo "--- Step 4: Flush WAL and Take Final Consistent Backup (Zero Writers) ---"
sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"
sqlite3 "${DB_PATH}" ".backup ${BACKUP_CONSISTENT}"

INTEGRITY=$(sqlite3 "${BACKUP_CONSISTENT}" "PRAGMA integrity_check;")
FK_CHECK=$(sqlite3 "${BACKUP_CONSISTENT}" "PRAGMA foreign_key_check;")
SAMPLES_COUNT=$(sqlite3 "${BACKUP_CONSISTENT}" "SELECT count(*) FROM Sample;")
PROJECTS_COUNT=$(sqlite3 "${BACKUP_CONSISTENT}" "SELECT count(*) FROM Project;")
WORKITEMS_COUNT=$(sqlite3 "${BACKUP_CONSISTENT}" "SELECT count(*) FROM WorkItem;")
RESULTS_COUNT=$(sqlite3 "${BACKUP_CONSISTENT}" "SELECT count(*) FROM Result;")
REPORTS_COUNT=$(sqlite3 "${BACKUP_CONSISTENT}" "SELECT count(*) FROM Report;")
BACKUP_SHA=$(sha256sum "${BACKUP_CONSISTENT}" | awk '{print $1}')

echo "Consistent backup file: ${BACKUP_CONSISTENT}"
echo "Backup SHA256:         ${BACKUP_SHA}"
echo "Integrity check:       ${INTEGRITY}"
echo "Foreign key check:     ${FK_CHECK:-OK (0 errors)}"
echo "Row Counts: Samples=${SAMPLES_COUNT}, Projects=${PROJECTS_COUNT}, WorkItems=${WORKITEMS_COUNT}, Results=${RESULTS_COUNT}, Reports=${REPORTS_COUNT}"

if [ "${INTEGRITY}" != "ok" ] || [ -n "${FK_CHECK}" ] || [ "${SAMPLES_COUNT}" -ne 36878 ] || [ "${PROJECTS_COUNT}" -ne 5 ]; then
    echo "ABORT: Consistent backup verification failed!"
    exit 1
fi

echo "--- Step 5: Start Container with Background Schedulers Suppressed ---"
docker rm soilfer-lims || true

docker run -d \
  --name soilfer-lims \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/lims/.env \
  -e DISABLE_BACKGROUND_JOBS=true \
  -v lims_lims-data:/app/server/prisma \
  -v lims_lims-assets:/app/server/uploads \
  --health-cmd "wget -q --spider http://localhost:3000/api/health" \
  --health-interval 30s \
  --health-timeout 10s \
  --health-retries 3 \
  --health-start-period 30s \
  soilfer-lims:v3.5.18-2032617

echo "Waiting for container healthy..."
for i in $(seq 1 30); do
    HEALTH=$(curl -s http://localhost:3000/api/health | grep -o '"status":"ok"' || true)
    if [ -n "$HEALTH" ]; then
        echo "Postflight container healthy at second $i!"
        break
    fi
    sleep 1
done

ENV_FLAG=$(docker inspect soilfer-lims --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^DISABLE_BACKGROUND_JOBS=')
echo "Container env flag: ${ENV_FLAG}"

sleep 2
KOBO_LOGS=$(docker logs soilfer-lims 2>&1 | grep "KOBO_SCHEDULER" || true)
if [ -n "${KOBO_LOGS}" ]; then
    echo "WARNING: Kobo scheduler was not suppressed! Logs: ${KOBO_LOGS}"
    exit 1
else
    echo "CONFIRMED: Background sync writers suppressed (zero scheduler logs)."
fi

echo "--- Step 6: Execute Read-Only Role/Route Postflight Checklist ---"
docker cp /opt/lims/postflight_check.cjs soilfer-lims:/app/server/postflight_check.cjs
docker exec soilfer-lims node /app/server/postflight_check.cjs

echo "--- Step 7: Verify Database Counts Remain Intact Post-Checklist ---"
MID_SAMPLES=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM Sample;")
MID_PROJECTS=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM Project;")
echo "Database counts post-check: Samples=${MID_SAMPLES}, Projects=${MID_PROJECTS}"
if [ "${MID_SAMPLES}" -ne 36878 ] || [ "${MID_PROJECTS}" -ne 5 ]; then
    echo "FATAL: Database count mutation detected during postflight!"
    exit 1
fi

echo "--- Step 8: Restart Container in Full Production Mode ---"
docker stop soilfer-lims
docker rm soilfer-lims

docker run -d \
  --name soilfer-lims \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/lims/.env \
  -v lims_lims-data:/app/server/prisma \
  -v lims_lims-assets:/app/server/uploads \
  --health-cmd "wget -q --spider http://localhost:3000/api/health" \
  --health-interval 30s \
  --health-timeout 10s \
  --health-retries 3 \
  --health-start-period 30s \
  soilfer-lims:v3.5.18-2032617

for i in $(seq 1 30); do
    HEALTH=$(curl -s http://localhost:3000/api/health | grep -o '"status":"ok"' || true)
    if [ -n "$HEALTH" ]; then
        echo "Production container healthy at second $i!"
        break
    fi
    sleep 1
done

echo "--- Step 9: Restore Apache Proxy and Resume Ingress Writes ---"
cp /etc/httpd/conf/extra/httpd-lims.conf.live /etc/httpd/conf/extra/httpd-lims.conf
apachectl configtest
systemctl reload httpd
echo "Apache proxy restored to full service."

echo "--- Step 10: Public Health and Verification ---"
PUBLIC_HEALTH=$(curl -s https://lims.yigini.net/api/health)
echo "Public health response: ${PUBLIC_HEALTH}"

FINAL_SAMPLES=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM Sample;")
FINAL_PROJECTS=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM Project;")
FINAL_WORKITEMS=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM WorkItem;")
FINAL_RESULTS=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM Result;")
FINAL_REPORTS=$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM Report;")

echo "============================================================"
echo "  FINAL RELEASE VERIFICATION COMPLETE: 2032617             "
echo "  Rollback Baseline: ${BASELINE_ID}                         "
echo "  Consistent Backup: ${BACKUP_CONSISTENT}"
echo "  Backup SHA256:     ${BACKUP_SHA}"
echo "  Samples:           ${FINAL_SAMPLES}"
echo "  Projects:          ${FINAL_PROJECTS}"
echo "  WorkItems:         ${FINAL_WORKITEMS}"
echo "  Results:           ${FINAL_RESULTS}"
echo "  Reports:           ${FINAL_REPORTS}"
echo "============================================================"
