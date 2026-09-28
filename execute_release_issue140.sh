#!/bin/bash
set -euo pipefail

# ============================================================
#   SOILFER-LIMS PRODUCTION RELEASE EXECUTION: ISSUE #140
#   Target: Safe LIMS-NSIS Data Exchange Gateway (PR #149)
#   Standard: Phase-Aware Stopped-Writer Backup, Additive Migration,
#             Preserved Container Config, Immutable Image Cutover,
#             Fail-Closed Recovery, Dedicated Hashed Postflight
# ============================================================

if [ $# -lt 1 ] || [ -z "$1" ]; then
    echo "FATAL: Must provide reviewed immutable image tag or digest as first argument!"
    echo "Usage: $0 <reviewed-image-tag-or-digest>"
    exit 1
fi

REVIEWED_IMAGE="$1"
APP_CONTAINER_NAME=${APP_CONTAINER_NAME:-"soilfer-lims"}
MIGRATION_CONTAINER_NAME=${MIGRATION_CONTAINER_NAME:-"soilfer-lims-migration"}
DATA_VOLUME=${DOCKER_VOLUME_NAME:-"lims_lims-data"}
ASSETS_VOLUME=${DOCKER_ASSETS_VOLUME:-"lims_lims-assets"}
LIMS_OPT_DIR=${LIMS_OPT_DIR:-"/opt/lims"}
APACHE_CONF_DIR=${APACHE_CONF_DIR:-"/etc/httpd/conf/extra"}
SYSTEMCTL_CMD=${SYSTEMCTL_CMD:-"systemctl"}
APACHECTL_CMD=${APACHECTL_CMD:-"apachectl"}
CURL_CMD=${CURL_CMD:-"curl"}
SQLITE3_CMD=${SQLITE3_CMD:-"sqlite3"}
DOCKER_CMD=${DOCKER_CMD:-"docker"}

DB_PATH="/var/lib/docker/volumes/${DATA_VOLUME}/_data/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${LIMS_OPT_DIR}/backups"
LOG_DIR="${LIMS_OPT_DIR}/logs"
BACKUP_FILE="${BACKUP_DIR}/dev_pre_issue140_${TIMESTAMP}.db"
LOG_FILE="${LOG_DIR}/release_issue140_${TIMESTAMP}.log"

mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

# Tee entire execution transcript to LOG_FILE
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "=== SOILFER-LIMS PRODUCTION RELEASE EXECUTION: ISSUE #140 ==="
echo "Execution Timestamp: ${TIMESTAMP}"
echo "Target Image:        ${REVIEWED_IMAGE}"
echo "Log File:            ${LOG_FILE}"

# --- Exclusive Host Locking (Fail-Closed) ---
LOCK_FILE="${LIMS_OPT_DIR}/release_issue140.lock"
GLOBAL_LOCK_FILE="${LIMS_OPT_DIR}/apply.lock"
PID_FILE="${LIMS_OPT_DIR}/release_issue140.pid"

if ! command -v flock >/dev/null 2>&1; then
    echo "FATAL: flock command is required for safe host mutual exclusion. Aborting."
    exit 1
fi

exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
    echo "FATAL: Another release or migration holds ${LOCK_FILE}! Aborting."
    exit 1
fi
exec 201>"${GLOBAL_LOCK_FILE}"
if ! flock -n 201; then
    echo "FATAL: Another operation holds global lock ${GLOBAL_LOCK_FILE}! Aborting."
    exit 1
fi
echo "$$" > "${PID_FILE}"

# Phase tracking for recovery decisions
PHASE="INIT"
BASELINE_TAG="soilfer-lims:rollback-baseline"
BASELINE_IMAGE_ID=""
TARGET_IMAGE_ID=""
BACKUP_SHA=""
STOPPED_SAMPLES=0
STOPPED_RESULTS=0

# Helper to assert no writers are running
assert_writers_stopped() {
    local running
    local containers_to_check=("${APP_CONTAINER_NAME}" "${MIGRATION_CONTAINER_NAME}")

    for c in "${containers_to_check[@]}"; do
        if [ -z "${c}" ]; then continue; fi
        running=$("${DOCKER_CMD}" inspect "${c}" --format '{{.State.Running}}' 2>/dev/null || echo "false")
        if [ "${running}" = "true" ]; then
            echo "Stopping active container '${c}'..."
            if ! "${DOCKER_CMD}" stop -t 10 "${c}"; then
                echo "ERROR: Docker stop failed on '${c}'"
                return 1
            fi
        fi
        running=$("${DOCKER_CMD}" inspect "${c}" --format '{{.State.Running}}' 2>/dev/null || echo "false")
        if [ "${running}" = "true" ]; then
            echo "ERROR: Container '${c}' is still running after stop!"
            return 1
        fi
    done
    return 0
}

# Function to run container with preserved configuration
start_app_container() {
    local image_to_run="$1"
    echo "Starting container '${APP_CONTAINER_NAME}' with image '${image_to_run}'..."
    "${DOCKER_CMD}" rm -f "${APP_CONTAINER_NAME}" 2>/dev/null || true
    "${DOCKER_CMD}" run -d \
        --name "${APP_CONTAINER_NAME}" \
        --restart unless-stopped \
        -p 127.0.0.1:3000:3000 \
        --env-file "${LIMS_OPT_DIR}/.env" \
        -v "${DATA_VOLUME}:/app/server/prisma" \
        -v "${ASSETS_VOLUME}:/app/server/uploads" \
        --health-cmd "wget -q --spider http://localhost:3000/api/health" \
        --health-interval 30s \
        --health-timeout 10s \
        --health-retries 3 \
        --health-start-period 30s \
        "${image_to_run}"
}

# Phase-aware fail-closed recovery routine
cleanup_recovery() {
    local exit_code=$?
    local signal=${1:-"EXIT"}

    trap - SIGHUP SIGINT SIGTERM EXIT

    if [ "${signal}" != "EXIT" ] && [ ${exit_code} -eq 0 ]; then
        exit_code=1
    fi

    if [ ${exit_code} -ne 0 ] || [ "${signal}" != "EXIT" ]; then
        echo ""
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "  FAILURE DETECTED (Exit code: ${exit_code}, Signal: ${signal}, Phase: ${PHASE})"
        echo "  Executing phase-aware fail-closed recovery...             "
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"

        case "${PHASE}" in
            INIT)
                echo "Failed in INIT phase. No system changes made."
                ;;
            PREFLIGHT)
                echo "Preflight check failed. Live application remains untouched."
                ;;
            QUIESCE)
                echo "Quiescence active without DB modification. Restoring live Apache ingress routing..."
                if [ -f "${APACHE_CONF_DIR}/httpd-lims.conf.live" ]; then
                    cp "${APACHE_CONF_DIR}/httpd-lims.conf.live" "${APACHE_CONF_DIR}/httpd-lims.conf"
                    "${APACHECTL_CMD}" configtest && "${SYSTEMCTL_CMD}" reload httpd || true
                fi
                ;;
            STOPPED_WRITER|BACKUP)
                echo "Container stopped before database mutation. Restarting baseline container..."
                local restart_ok=false
                if [ -n "${BASELINE_IMAGE_ID}" ] && start_app_container "${BASELINE_IMAGE_ID}"; then
                    restart_ok=true
                elif start_app_container "${BASELINE_TAG}"; then
                    restart_ok=true
                fi

                local base_healthy=false
                if [ "${restart_ok}" = "true" ]; then
                    for i in $(seq 1 30); do
                        if "${CURL_CMD}" -s -f http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
                            base_healthy=true
                            break
                        fi
                        sleep 1
                    done
                fi

                if [ "${base_healthy}" = "true" ]; then
                    echo "Baseline healthy. Restoring live Apache ingress routing..."
                    if [ -f "${APACHE_CONF_DIR}/httpd-lims.conf.live" ]; then
                        cp "${APACHE_CONF_DIR}/httpd-lims.conf.live" "${APACHE_CONF_DIR}/httpd-lims.conf"
                        "${APACHECTL_CMD}" configtest && "${SYSTEMCTL_CMD}" reload httpd || true
                    fi
                else
                    echo "FATAL RECOVERY ERROR: Baseline container unhealthy. Ingress remains QUIESCED (503)."
                fi
                ;;
            MIGRATION|CONTAINER_START|PRE_EXPOSURE_VERIFICATION)
                echo "Failure occurred before exposure. Performing fail-closed rollback to pre-release backup..."
                if ! assert_writers_stopped; then
                    echo "FATAL RECOVERY ERROR: Could not verify all writers stopped. ABORTING database restore to prevent data corruption."
                    echo "Ingress remains QUIESCED (503). Manual operator intervention required."
                    exit 1
                fi

                # Preserve failed database and WAL/SHM before restore for forensic inspection
                if [ -f "${DB_PATH}" ]; then
                    echo "Preserving failed database state to ${BACKUP_DIR}/failed_db_${TIMESTAMP}.db..."
                    cp "${DB_PATH}" "${BACKUP_DIR}/failed_db_${TIMESTAMP}.db" || true
                    if [ -f "${DB_PATH}-wal" ]; then
                        cp "${DB_PATH}-wal" "${BACKUP_DIR}/failed_db_${TIMESTAMP}.db-wal" || true
                    fi
                    if [ -f "${DB_PATH}-shm" ]; then
                        cp "${DB_PATH}-shm" "${BACKUP_DIR}/failed_db_${TIMESTAMP}.db-shm" || true
                    fi
                fi

                if [ -f "${BACKUP_FILE}" ]; then
                    if [ -n "${BACKUP_SHA}" ]; then
                        local cur_backup_sha
                        cur_backup_sha=$(sha256sum "${BACKUP_FILE}" 2>/dev/null | awk '{print $1}')
                        if [ "${cur_backup_sha}" != "${BACKUP_SHA}" ]; then
                            echo "FATAL RECOVERY ERROR: Backup SHA mismatch! Expected ${BACKUP_SHA}, got ${cur_backup_sha}. Aborting restore."
                            exit 1
                        fi
                    fi

                    local b_integ
                    b_integ=$("${SQLITE3_CMD}" "${BACKUP_FILE}" "PRAGMA integrity_check;" 2>/dev/null || echo "failed")
                    if [ "${b_integ}" != "ok" ]; then
                        echo "FATAL RECOVERY ERROR: Backup integrity check failed: ${b_integ}. Aborting restore."
                        exit 1
                    fi

                    echo "Removing stale WAL and SHM files..."
                    rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"

                    echo "Restoring database from ${BACKUP_FILE}..."
                    cp "${BACKUP_FILE}" "${DB_PATH}"

                    local r_integ
                    r_integ=$("${SQLITE3_CMD}" "${DB_PATH}" "PRAGMA integrity_check;" 2>/dev/null || echo "failed")
                    if [ "${r_integ}" != "ok" ]; then
                        echo "FATAL RECOVERY ERROR: Restored database integrity check failed: ${r_integ}!"
                        exit 1
                    fi

                    # Rotate exchange epoch in restored database per runbook
                    local has_meta
                    has_meta=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='_exchange_meta';" 2>/dev/null || echo "0")
                    if [ "${has_meta}" = "1" ]; then
                        local restore_nonce
                        restore_nonce=$(head -c 6 /dev/urandom 2>/dev/null | xxd -p 2>/dev/null || date +%s%N)
                        local restore_epoch="epoch-$(date +%s)-${restore_nonce}"
                        local restore_now
                        restore_now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
                        "${SQLITE3_CMD}" "${DB_PATH}" "INSERT INTO _exchange_meta (key, value, updated_at) VALUES ('epoch', '${restore_epoch}', '${restore_now}') ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;" 2>/dev/null || true
                        "${SQLITE3_CMD}" "${DB_PATH}" "INSERT INTO _exchange_meta (key, value, updated_at) VALUES ('last_epoch_rotation_reason', 'STOPPED_WRITER_RESTORE', '${restore_now}') ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;" 2>/dev/null || true
                        echo "Restored database exchange epoch rotated to: ${restore_epoch}"
                    fi
                fi

                echo "Recreating container with rollback baseline image: ${BASELINE_IMAGE_ID:-${BASELINE_TAG}}..."
                local rollback_recreated=false
                if [ -n "${BASELINE_IMAGE_ID}" ] && start_app_container "${BASELINE_IMAGE_ID}"; then
                    rollback_recreated=true
                elif start_app_container "${BASELINE_TAG}"; then
                    rollback_recreated=true
                fi

                local rollback_healthy=false
                if [ "${rollback_recreated}" = "true" ]; then
                    echo "Awaiting baseline container health..."
                    for i in $(seq 1 30); do
                        if "${CURL_CMD}" -s -f http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
                            echo "Rollback container is healthy."
                            rollback_healthy=true
                            break
                        fi
                        sleep 1
                    done
                fi

                if [ "${rollback_healthy}" = "true" ]; then
                    echo "Restoring live Apache ingress routing..."
                    if [ -f "${APACHE_CONF_DIR}/httpd-lims.conf.live" ]; then
                        cp "${APACHE_CONF_DIR}/httpd-lims.conf.live" "${APACHE_CONF_DIR}/httpd-lims.conf"
                        "${APACHECTL_CMD}" configtest && "${SYSTEMCTL_CMD}" reload httpd || true
                    fi
                else
                    echo "FATAL RECOVERY ERROR: Baseline container failed health check! Ingress remains QUIESCED (503) to prevent traffic to unhealthy service."
                fi
                ;;
            COMMITTED)
                echo "CRITICAL: Failure occurred after live writes were reopened (COMMITTED phase)."
                echo "Automatic database restore is STRICTLY FORBIDDEN to prevent overwriting legitimate client mutations."
                echo "Ingress remains open or can be manually quiesced. Logs preserved at ${LOG_FILE} for operator reconciliation."
                ;;
            COMPLETE)
                echo "Release already marked COMPLETE. No recovery required."
                ;;
        esac

        rm -f "${PID_FILE}" 2>/dev/null || true
        echo "Safe recovery routine finished. Please review log: ${LOG_FILE}"
        exit ${exit_code}
    fi

    rm -f "${PID_FILE}" 2>/dev/null || true
}

trap 'cleanup_recovery SIGHUP' SIGHUP
trap 'cleanup_recovery SIGINT' SIGINT
trap 'cleanup_recovery SIGTERM' SIGTERM
trap 'cleanup_recovery EXIT' EXIT

# --- Step 1: Preflight & Baseline Image Preservation ---
PHASE="PREFLIGHT"
echo "--- Step 1: Preflight & Baseline Image Preservation ---"

# Verify active container running
ACTIVE_RUNNING=$("${DOCKER_CMD}" inspect "${APP_CONTAINER_NAME}" --format '{{.State.Running}}' 2>/dev/null || echo "false")
if [ "${ACTIVE_RUNNING}" != "true" ]; then
    echo "FATAL: Application container '${APP_CONTAINER_NAME}' is not currently running!"
    exit 1
fi

# Pin immutable baseline image ID (sha256 digest, not mutable tag)
BASELINE_IMAGE_ID=$("${DOCKER_CMD}" inspect "${APP_CONTAINER_NAME}" --format '{{.Image}}' 2>/dev/null || true)
if [ -z "${BASELINE_IMAGE_ID}" ]; then
    echo "FATAL: Could not inspect active container '${APP_CONTAINER_NAME}' to determine baseline image ID!"
    exit 1
fi
echo "Active container baseline immutable Image ID: ${BASELINE_IMAGE_ID}"

"${DOCKER_CMD}" tag "${BASELINE_IMAGE_ID}" "${BASELINE_TAG}"
echo "Rollback baseline tagged: ${BASELINE_TAG}"

# Inspect target reviewed image ID
TARGET_IMAGE_ID=$("${DOCKER_CMD}" inspect "${REVIEWED_IMAGE}" --format '{{.Id}}' 2>/dev/null || true)
if [ -z "${TARGET_IMAGE_ID}" ]; then
    echo "FATAL: Reviewed image '${REVIEWED_IMAGE}' not found locally in Docker!"
    exit 1
fi
echo "Target reviewed image verified: ${REVIEWED_IMAGE} (Image ID: ${TARGET_IMAGE_ID})"

# Check production environment file & volumes
if [ ! -f "${LIMS_OPT_DIR}/.env" ]; then
    echo "FATAL: Production environment file not found at ${LIMS_OPT_DIR}/.env!"
    exit 1
fi

if [ ! -f "${DB_PATH}" ]; then
    echo "FATAL: Production SQLite database not found at ${DB_PATH}!"
    exit 1
fi

INITIAL_INTEGRITY=$("${SQLITE3_CMD}" "${DB_PATH}" "PRAGMA integrity_check;")
if [ "${INITIAL_INTEGRITY}" != "ok" ]; then
    echo "FATAL: Preflight DB integrity check failed: ${INITIAL_INTEGRITY}"
    exit 1
fi

INITIAL_FK=$("${SQLITE3_CMD}" "${DB_PATH}" "PRAGMA foreign_key_check;")
if [ -n "${INITIAL_FK}" ]; then
    echo "FATAL: Preflight foreign key check failed: ${INITIAL_FK}"
    exit 1
fi

# Preserve recent container logs before any action
"${DOCKER_CMD}" logs --tail 200 "${APP_CONTAINER_NAME}" > "${LOG_DIR}/pre_release_${TIMESTAMP}.log" 2>&1 || true

# --- Step 2: Enforce Ingress Write Quiescence (Apache 503 Rewrite) ---
PHASE="QUIESCE"
echo "--- Step 2: Enforce Ingress Write Quiescence (Apache 503 Rewrite) ---"
cp "${APACHE_CONF_DIR}/httpd-lims.conf" "${APACHE_CONF_DIR}/httpd-lims.conf.live"

cat << 'APACHE_QUIESCE_EOF' > "${APACHE_CONF_DIR}/httpd-lims.conf.quiesce"
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
APACHE_QUIESCE_EOF

cp "${APACHE_CONF_DIR}/httpd-lims.conf.quiesce" "${APACHE_CONF_DIR}/httpd-lims.conf"
"${APACHECTL_CMD}" configtest
"${SYSTEMCTL_CMD}" reload httpd

# Verify write quiescence (POST rejected with 503, GET permitted)
QUIESCE_POST_CODE=$("${CURL_CMD}" -s -o /dev/null -w "%{http_code}" -X POST https://lims.yigini.net/api/v2/data-exchange/receipts || true)
echo "Ingress quiescence check: POST -> ${QUIESCE_POST_CODE} (expected 503)"
if [ "${QUIESCE_POST_CODE}" != "503" ]; then
    echo "FATAL: Ingress write quiescence is not active! POST returned ${QUIESCE_POST_CODE} instead of 503."
    exit 1
fi

# --- Step 3: Stop Active Container (Zero Writers) ---
PHASE="STOPPED_WRITER"
echo "--- Step 3: Stop Active Container (Zero Writers) ---"
if ! assert_writers_stopped; then
    echo "FATAL: Failed to stop writer containers cleanly!"
    exit 1
fi
echo "All writer containers stopped cleanly."

# --- Step 4: Checkpoint WAL, Consistent Backup & Stopped-Writer Baseline Counts ---
PHASE="BACKUP"
echo "--- Step 4: Checkpoint WAL, Consistent Backup & Integrity Verification ---"
"${SQLITE3_CMD}" "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"

STOPPED_SAMPLES=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM Sample;")
STOPPED_RESULTS=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM Result;")
echo "Zero-writer baseline counts: Samples=${STOPPED_SAMPLES}, Results=${STOPPED_RESULTS}"

"${SQLITE3_CMD}" "${DB_PATH}" ".backup '${BACKUP_FILE}'"

BACKUP_INTEGRITY=$("${SQLITE3_CMD}" "${BACKUP_FILE}" "PRAGMA integrity_check;")
BACKUP_FK=$("${SQLITE3_CMD}" "${BACKUP_FILE}" "PRAGMA foreign_key_check;")
BACKUP_SAMPLES=$("${SQLITE3_CMD}" "${BACKUP_FILE}" "SELECT count(*) FROM Sample;")
BACKUP_RESULTS=$("${SQLITE3_CMD}" "${BACKUP_FILE}" "SELECT count(*) FROM Result;")
BACKUP_SHA=$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')

echo "Consistent backup created: ${BACKUP_FILE}"
echo "Backup SHA256:             ${BACKUP_SHA}"
echo "Backup Integrity Check:    ${BACKUP_INTEGRITY}"
echo "Foreign Key Check:         ${BACKUP_FK:-OK (0 errors)}"
echo "Backup Sample Count:       ${BACKUP_SAMPLES}"
echo "Backup Result Count:       ${BACKUP_RESULTS}"

if [ "${BACKUP_INTEGRITY}" != "ok" ] || [ -n "${BACKUP_FK}" ]; then
    echo "FATAL: Pre-migration database integrity or foreign key check failed!"
    exit 1
fi
if [ "${BACKUP_SAMPLES}" -ne "${STOPPED_SAMPLES}" ] || [ "${BACKUP_RESULTS}" -ne "${STOPPED_RESULTS}" ]; then
    echo "FATAL: Pre-migration count mismatch: stopped=${STOPPED_SAMPLES}/${STOPPED_RESULTS}, backup=${BACKUP_SAMPLES}/${BACKUP_RESULTS}!"
    exit 1
fi

# --- Step 5: Execute Additive Database Migration with Pinned Target Image ID ---
PHASE="MIGRATION"
echo "--- Step 5: Execute Additive Database Migration ---"
"${DOCKER_CMD}" rm -f "${MIGRATION_CONTAINER_NAME}" 2>/dev/null || true
"${DOCKER_CMD}" run --rm \
    --name "${MIGRATION_CONTAINER_NAME}" \
    --env-file "${LIMS_OPT_DIR}/.env" \
    -v "${DATA_VOLUME}:/app/server/prisma" \
    -e DATABASE_PATH="/app/server/prisma/dev.db" \
    "${TARGET_IMAGE_ID}" \
    node /app/server/scripts/migrate_exchange_journal_tables.cjs "/app/server/prisma/dev.db"

POST_MIG_INTEGRITY=$("${SQLITE3_CMD}" "${DB_PATH}" "PRAGMA integrity_check;")
POST_MIG_FK=$("${SQLITE3_CMD}" "${DB_PATH}" "PRAGMA foreign_key_check;")
POST_MIG_SAMPLES=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM Sample;")
POST_MIG_RESULTS=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM Result;")

echo "Post-migration Integrity:  ${POST_MIG_INTEGRITY}"
echo "Post-migration FK Check:   ${POST_MIG_FK:-OK (0 errors)}"
echo "Post-migration Samples:    ${POST_MIG_SAMPLES}"
echo "Post-migration Results:    ${POST_MIG_RESULTS}"

if [ "${POST_MIG_INTEGRITY}" != "ok" ] || [ -n "${POST_MIG_FK}" ]; then
    echo "FATAL: Post-migration database integrity or foreign key check failed!"
    exit 1
fi
if [ "${POST_MIG_SAMPLES}" -ne "${STOPPED_SAMPLES}" ] || [ "${POST_MIG_RESULTS}" -ne "${STOPPED_RESULTS}" ]; then
    echo "FATAL: Post-migration counts altered! Samples: ${POST_MIG_SAMPLES} vs ${STOPPED_SAMPLES}, Results: ${POST_MIG_RESULTS} vs ${STOPPED_RESULTS}"
    exit 1
fi
echo "Additive database migration verified OK."

# --- Step 6: Start Container with Reviewed Immutable Image ID ---
PHASE="CONTAINER_START"
echo "--- Step 6: Start Container with Reviewed Immutable Image ID ---"
start_app_container "${TARGET_IMAGE_ID}"

echo "Waiting for container service readiness..."
for i in $(seq 1 30); do
    if "${CURL_CMD}" -s -f http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
        echo "Service is healthy and responding on loopback at second $i."
        break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
        echo "FATAL: Container failed to respond to /api/health within 30 seconds!"
        exit 1
    fi
done

# Verify running container image matches verified immutable TARGET_IMAGE_ID
RUNTIME_IMAGE_ID=$("${DOCKER_CMD}" inspect "${APP_CONTAINER_NAME}" --format '{{.Image}}')
if [ "${RUNTIME_IMAGE_ID}" != "${TARGET_IMAGE_ID}" ]; then
    echo "FATAL: Runtime image ID mismatch! Expected ${TARGET_IMAGE_ID}, got ${RUNTIME_IMAGE_ID}."
    exit 1
fi
echo "Runtime container verified running target image ID: ${RUNTIME_IMAGE_ID}"

# --- Step 7: Pre-Exposure Postflight & Verification (Under Quiescence) ---
PHASE="PRE_EXPOSURE_VERIFICATION"
echo "--- Step 7: Pre-Exposure Verification Under Quiescence ---"

# Loopback capabilities discovery
LOOP_CAPS=$("${CURL_CMD}" -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/v2/data-exchange/capabilities)
if [ "${LOOP_CAPS}" != "200" ]; then
    echo "FATAL: Loopback /api/v2/data-exchange/capabilities returned HTTP ${LOOP_CAPS} (expected 200)!"
    exit 1
fi
echo "PASS: Loopback /api/v2/data-exchange/capabilities -> 200"

# Dedicated, hashed read-only postflight verification inside target container
echo "Executing dedicated read-only Issue #140 postflight suite..."
"${DOCKER_CMD}" exec "${APP_CONTAINER_NAME}" node /app/server/scripts/postflight_issue140.cjs

# Verify data counts strictly unchanged before live exposure
PRE_EXP_SAMPLES=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM Sample;")
PRE_EXP_RESULTS=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM Result;")
if [ "${PRE_EXP_SAMPLES}" -ne "${STOPPED_SAMPLES}" ] || [ "${PRE_EXP_RESULTS}" -ne "${STOPPED_RESULTS}" ]; then
    echo "FATAL: Data corruption detected prior to exposure! Samples: ${PRE_EXP_SAMPLES} vs ${STOPPED_SAMPLES}"
    exit 1
fi
echo "Pre-exposure checks passed. System ready for live exposure."

# --- Step 8: Restore Live Ingress Configuration (COMMITTED Phase) ---
PHASE="COMMITTED"
echo "--- Step 8: Restore Live Ingress Configuration (COMMITTED) ---"
cp "${APACHE_CONF_DIR}/httpd-lims.conf.live" "${APACHE_CONF_DIR}/httpd-lims.conf"
"${APACHECTL_CMD}" configtest
"${SYSTEMCTL_CMD}" reload httpd
echo "Apache live routing restored; write operations re-enabled."

# Verify write resumption (Unauthenticated POST to /receipts must return HTTP 401, not 503 or 200)
RESUME_POST_CODE=$("${CURL_CMD}" -s -o /dev/null -w "%{http_code}" -X POST https://lims.yigini.net/api/v2/data-exchange/receipts || true)
echo "Write resumption test: POST -> ${RESUME_POST_CODE} (expected 401 Unauthorized from API, not 503)"
if [ "${RESUME_POST_CODE}" != "401" ]; then
    echo "FATAL: Ingress write resumption failed! Expected HTTP 401, received ${RESUME_POST_CODE}."
    exit 1
fi
echo "PASS: Ingress live write resumption verified (HTTP 401)."

# --- Step 9: Post-Exposure Public Smoke Verification ---
echo "--- Step 9: Post-Exposure Public Smoke Verification ---"

HEALTH_STATUS=$("${CURL_CMD}" -s -o /dev/null -w "%{http_code}" https://lims.yigini.net/api/health)
if [ "${HEALTH_STATUS}" != "200" ]; then
    echo "FATAL: Public /api/health returned HTTP ${HEALTH_STATUS} (expected 200)!"
    exit 1
fi
echo "PASS: Public /api/health -> 200"

CAPS_STATUS=$("${CURL_CMD}" -s -o /dev/null -w "%{http_code}" https://lims.yigini.net/api/v2/data-exchange/capabilities)
if [ "${CAPS_STATUS}" != "200" ]; then
    echo "FATAL: Public /api/v2/data-exchange/capabilities returned HTTP ${CAPS_STATUS} (expected 200)!"
    exit 1
fi
echo "PASS: Public /api/v2/data-exchange/capabilities -> 200"

DIR_STATUS=$("${CURL_CMD}" -s -o /dev/null -w "%{http_code}" https://lims.yigini.net/api/labs/directory)
if [ "${DIR_STATUS}" != "401" ]; then
    echo "FATAL: Anonymous /api/labs/directory returned HTTP ${DIR_STATUS} (expected 401 Unauthorized)!"
    exit 1
fi
echo "PASS: Anonymous /api/labs/directory -> 401 Unauthorized (protected)"

EXCH_STATS_STATUS=$("${CURL_CMD}" -s -o /dev/null -w "%{http_code}" https://lims.yigini.net/api/v2/data-exchange/stats)
if [ "${EXCH_STATS_STATUS}" != "401" ]; then
    echo "FATAL: Anonymous /api/v2/data-exchange/stats returned HTTP ${EXCH_STATS_STATUS} (expected 401 Unauthorized)!"
    exit 1
fi
echo "PASS: Anonymous /api/v2/data-exchange/stats -> 401 Unauthorized (protected)"

GEOJSON_STATUS=$("${CURL_CMD}" -s -o /dev/null -w "%{http_code}" https://lims.yigini.net/api/v2/data-exchange/geojson)
if [ "${GEOJSON_STATUS}" != "401" ]; then
    echo "FATAL: Anonymous /api/v2/data-exchange/geojson returned HTTP ${GEOJSON_STATUS} (expected 401 Unauthorized)!"
    exit 1
fi
echo "PASS: Anonymous /api/v2/data-exchange/geojson -> 401 Unauthorized (protected)"

PHASE="COMPLETE"
echo "============================================================"
echo "  RELEASE EXECUTION SUCCESSFUL: ISSUE #140                   "
echo "  Target Image:         ${REVIEWED_IMAGE}                    "
echo "  Target Image ID:      ${TARGET_IMAGE_ID}                   "
echo "  Rollback Baseline:    ${BASELINE_TAG} (${BASELINE_IMAGE_ID})"
echo "  Consistent Backup:    ${BACKUP_FILE}                       "
echo "  Backup SHA256:        ${BACKUP_SHA}                        "
echo "  Stopped-Writer Count: Samples=${STOPPED_SAMPLES}, Results=${STOPPED_RESULTS}"
echo "  Release Transcript:   ${LOG_FILE}                          "
echo "============================================================"
