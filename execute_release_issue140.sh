#!/bin/bash
set -euo pipefail

# ============================================================
#   SOILFER-LIMS PRODUCTION RELEASE EXECUTION: ISSUE #140
#   Target: Safe LIMS-NSIS Data Exchange Gateway (PR #149)
#   Standard: Phase-Aware Stopped-Writer Backup, Additive Migration,
#             Preserved Container Config, Immutable Image Cutover,
#             Fail-Closed Recovery, Dedicated Hashed Postflight,
#             Pre-Exposure Background Writer Hold
# ============================================================

if [ $# -lt 1 ] || [ -z "$1" ]; then
    echo "FATAL: Must provide reviewed immutable image tag or digest as first argument!"
    echo "Usage: $0 <reviewed-image-tag-or-digest>"
    exit 1
fi

REVIEWED_IMAGE="$1"
EXPECTED_COMMIT_SHA=${EXPECTED_COMMIT_SHA:-""}
MAIN_CI_RUN_ID=${MAIN_CI_RUN_ID:-""}
POSTFLIGHT_ADMIN_ID=${POSTFLIGHT_ADMIN_ID:-""}
POSTFLIGHT_MANAGER_ID=${POSTFLIGHT_MANAGER_ID:-""}
EXPECTED_POSTFLIGHT_SHA=${EXPECTED_POSTFLIGHT_SHA:-"cb88ca593de1e2af3a0052a7ffb958eeb3933028764718eb624bfdfbc5fea4b5"}
IMAGE_SOURCE_COMMIT=""
APACHE_LIVE_HASH=""
WRAPPER_SCRIPT_HASH=""
if [ -f "$0" ]; then
    WRAPPER_SCRIPT_HASH=$(sha256sum "$0" 2>/dev/null | awk '{print $1}' || echo "unknown")
fi
FINAL_RUNTIME_IMAGE_ID=""

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
echo "Execution Timestamp:    ${TIMESTAMP}"
echo "Target Image Input:     ${REVIEWED_IMAGE}"
echo "Expected Commit SHA:    ${EXPECTED_COMMIT_SHA}"
echo "Expected Postflight SHA: ${EXPECTED_POSTFLIGHT_SHA}"
echo "Log File:               ${LOG_FILE}"

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

# Helper to assert no writers are running (distinguishes absent containers from unknown inspect errors)
assert_writers_stopped() {
    local containers_to_check=("${APP_CONTAINER_NAME}" "${MIGRATION_CONTAINER_NAME}")

    for c in "${containers_to_check[@]}"; do
        if [ -z "${c}" ]; then continue; fi

        local inspect_out
        local inspect_rc=0
        inspect_out=$("${DOCKER_CMD}" inspect "${c}" --format '{{.State.Running}}' 2>&1) || inspect_rc=$?

        if [ ${inspect_rc} -ne 0 ]; then
            # Check if container simply does not exist (valid absent state)
            if echo "${inspect_out}" | grep -qiE "No such (container|object)"; then
                continue
            else
                echo "ERROR: Docker inspect returned unknown error on '${c}': ${inspect_out}"
                return 1
            fi
        fi

        if [ "${inspect_out}" = "true" ]; then
            echo "Stopping active container '${c}'..."
            if ! "${DOCKER_CMD}" stop -t 10 "${c}"; then
                echo "ERROR: Docker stop failed on '${c}'"
                return 1
            fi

            inspect_out=$("${DOCKER_CMD}" inspect "${c}" --format '{{.State.Running}}' 2>&1) || inspect_rc=$?
            if [ ${inspect_rc} -ne 0 ]; then
                if echo "${inspect_out}" | grep -qiE "No such (container|object)"; then
                    continue
                else
                    echo "ERROR: Docker inspect failed after stop on '${c}': ${inspect_out}"
                    return 1
                fi
            fi
            if [ "${inspect_out}" = "true" ]; then
                echo "ERROR: Container '${c}' is still running after stop!"
                return 1
            fi
        elif [ "${inspect_out}" != "false" ]; then
            echo "ERROR: Unknown running status on '${c}': ${inspect_out}"
            return 1
        fi
    done
    return 0
}

# Function to run container with preserved configuration and optional background-job suppression
start_app_container() {
    local image_to_run="$1"
    local run_mode=${2:-"production"}
    local env_extra=()

    if [ "${run_mode}" = "pre_exposure" ]; then
        echo "Starting container '${APP_CONTAINER_NAME}' in pre-exposure verification mode (DISABLE_BACKGROUND_JOBS=true)..."
        env_extra+=("-e" "DISABLE_BACKGROUND_JOBS=true")
    else
        echo "Starting container '${APP_CONTAINER_NAME}' in full production mode..."
    fi

    "${DOCKER_CMD}" rm -f "${APP_CONTAINER_NAME}" 2>/dev/null || true
    "${DOCKER_CMD}" run -d \
        --name "${APP_CONTAINER_NAME}" \
        --restart unless-stopped \
        -p 127.0.0.1:3000:3000 \
        --env-file "${LIMS_OPT_DIR}/.env" \
        "${env_extra[@]}" \
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
            INIT|PREFLIGHT)
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
                if [ -n "${BASELINE_IMAGE_ID:-}" ] && start_app_container "${BASELINE_IMAGE_ID}" "production"; then
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

                # 1. Require backup file to exist; missing backup MUST block restore and fail closed!
                if [ ! -f "${BACKUP_FILE}" ]; then
                    echo "FATAL RECOVERY ERROR: Pre-release backup file '${BACKUP_FILE}' not found! Cannot restore database."
                    echo "Ingress remains QUIESCED (503). Preserving failed state for manual operator recovery."
                    exit 1
                fi

                # 2. Verify backup hash before restore
                if [ -n "${BACKUP_SHA:-}" ]; then
                    local cur_backup_sha
                    cur_backup_sha=$(sha256sum "${BACKUP_FILE}" 2>/dev/null | awk '{print $1}')
                    if [ "${cur_backup_sha}" != "${BACKUP_SHA}" ]; then
                        echo "FATAL RECOVERY ERROR: Backup SHA mismatch! Expected ${BACKUP_SHA}, got ${cur_backup_sha}. Aborting restore."
                        exit 1
                    fi
                fi

                # 3. Verify backup integrity and foreign keys before restore
                local b_integ
                b_integ=$("${SQLITE3_CMD}" "${BACKUP_FILE}" "PRAGMA integrity_check;" 2>/dev/null || echo "failed")
                if [ "${b_integ}" != "ok" ]; then
                    echo "FATAL RECOVERY ERROR: Backup integrity check failed: ${b_integ}. Aborting restore."
                    exit 1
                fi
                local b_fk
                b_fk=$("${SQLITE3_CMD}" "${BACKUP_FILE}" "PRAGMA foreign_key_check;" 2>/dev/null || echo "failed")
                if [ -n "${b_fk}" ] && [ "${b_fk}" != "OK (0 errors)" ]; then
                    echo "FATAL RECOVERY ERROR: Backup foreign key check failed: ${b_fk}. Aborting restore."
                    exit 1
                fi

                # 4. Preserve failed database and WAL/SHM before restore for forensic inspection
                if [ -f "${DB_PATH}" ]; then
                    echo "Preserving failed database state to ${BACKUP_DIR}/failed_db_${TIMESTAMP}.db..."
                    if ! cp "${DB_PATH}" "${BACKUP_DIR}/failed_db_${TIMESTAMP}.db"; then
                        echo "FATAL RECOVERY ERROR: Failed to preserve failed database file before restore! Aborting."
                        exit 1
                    fi
                    if [ -f "${DB_PATH}-wal" ]; then
                        echo "Preserving failed database WAL sidecar..."
                        if ! cp "${DB_PATH}-wal" "${BACKUP_DIR}/failed_db_${TIMESTAMP}.db-wal"; then
                            echo "FATAL RECOVERY ERROR: Failed to preserve failed database WAL sidecar! Aborting recovery to protect state."
                            exit 1
                        fi
                    fi
                    if [ -f "${DB_PATH}-shm" ]; then
                        echo "Preserving failed database SHM sidecar..."
                        if ! cp "${DB_PATH}-shm" "${BACKUP_DIR}/failed_db_${TIMESTAMP}.db-shm"; then
                            echo "FATAL RECOVERY ERROR: Failed to preserve failed database SHM sidecar! Aborting recovery to protect state."
                            exit 1
                        fi
                    fi
                fi

                # 5. Remove stale WAL and SHM files
                echo "Removing stale WAL and SHM files..."
                rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"

                # 6. Restore database from backup
                echo "Restoring database from ${BACKUP_FILE}..."
                if ! cp "${BACKUP_FILE}" "${DB_PATH}"; then
                    echo "FATAL RECOVERY ERROR: Failed to copy backup to ${DB_PATH}!"
                    exit 1
                fi

                # 7. Verify restored database integrity and foreign keys
                local r_integ
                r_integ=$("${SQLITE3_CMD}" "${DB_PATH}" "PRAGMA integrity_check;" 2>/dev/null || echo "failed")
                if [ "${r_integ}" != "ok" ]; then
                    echo "FATAL RECOVERY ERROR: Restored database integrity check failed: ${r_integ}!"
                    exit 1
                fi
                local r_fk
                r_fk=$("${SQLITE3_CMD}" "${DB_PATH}" "PRAGMA foreign_key_check;" 2>/dev/null || echo "failed")
                if [ -n "${r_fk}" ] && [ "${r_fk}" != "OK (0 errors)" ]; then
                    echo "FATAL RECOVERY ERROR: Restored database foreign key check failed: ${r_fk}!"
                    exit 1
                fi

                # 8. Rotate exchange restore epoch in _exchange_meta if table exists
                local has_meta_out
                local has_meta_rc=0
                has_meta_out=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='_exchange_meta';" 2>&1) || has_meta_rc=$?

                if [ ${has_meta_rc} -ne 0 ]; then
                    echo "FATAL RECOVERY ERROR: Failed to inspect sqlite_master for _exchange_meta: ${has_meta_out}"
                    exit 1
                fi
                if [ "${has_meta_out}" != "0" ] && [ "${has_meta_out}" != "1" ]; then
                    echo "FATAL RECOVERY ERROR: Unexpected output inspecting _exchange_meta in sqlite_master: ${has_meta_out}"
                    exit 1
                fi

                if [ "${has_meta_out}" = "1" ]; then
                    local restore_nonce
                    restore_nonce=$(head -c 6 /dev/urandom 2>/dev/null | xxd -p 2>/dev/null || date +%s%N)
                    local restore_epoch="epoch-$(date +%s)-${restore_nonce}"
                    local restore_now
                    restore_now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

                    # Attempt epoch rotation and verify persisted value
                    if ! "${SQLITE3_CMD}" "${DB_PATH}" "INSERT INTO _exchange_meta (key, value, updated_at) VALUES ('epoch', '${restore_epoch}', '${restore_now}') ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;"; then
                        echo "FATAL RECOVERY ERROR: Failed to update restore epoch in _exchange_meta!"
                        exit 1
                    fi
                    if ! "${SQLITE3_CMD}" "${DB_PATH}" "INSERT INTO _exchange_meta (key, value, updated_at) VALUES ('last_epoch_rotation_reason', 'STOPPED_WRITER_RESTORE', '${restore_now}') ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;"; then
                        echo "FATAL RECOVERY ERROR: Failed to record epoch rotation reason in _exchange_meta!"
                        exit 1
                    fi

                    local check_epoch
                    check_epoch=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT value FROM _exchange_meta WHERE key = 'epoch';" 2>/dev/null || echo "")
                    if [ "${check_epoch}" != "${restore_epoch}" ]; then
                        echo "FATAL RECOVERY ERROR: Persisted restore epoch mismatch! Expected ${restore_epoch}, got ${check_epoch}."
                        exit 1
                    fi
                    echo "Restored database exchange epoch rotated to: ${restore_epoch}"
                else
                    echo "Restored database does not contain _exchange_meta (genuine legacy schema). Skipping epoch rotation."
                fi

                # 9. Recreate container with pinned immutable baseline image ID only (no mutable tag fallback)
                if [ -z "${BASELINE_IMAGE_ID:-}" ]; then
                    echo "FATAL RECOVERY ERROR: Immutable BASELINE_IMAGE_ID is not set! Aborting container restart."
                    exit 1
                fi
                echo "Recreating container with rollback baseline image ID: ${BASELINE_IMAGE_ID}..."
                if ! start_app_container "${BASELINE_IMAGE_ID}" "production"; then
                    echo "FATAL RECOVERY ERROR: Failed to recreate baseline container with ${BASELINE_IMAGE_ID}!"
                    exit 1
                fi

                # 10. Await baseline container health
                local rollback_healthy=false
                echo "Awaiting baseline container health..."
                for i in $(seq 1 30); do
                    if "${CURL_CMD}" -s -f http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
                        echo "Rollback container is healthy."
                        rollback_healthy=true
                        break
                    fi
                    sleep 1
                done

                # 11. Only restore live Apache ingress routing if baseline is confirmed healthy!
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

# Verify required release identity and principal parameters
if [ -z "${EXPECTED_COMMIT_SHA:-}" ]; then
    echo "FATAL: EXPECTED_COMMIT_SHA is required to bind release commit provenance!"
    exit 1
fi
if [ -z "${MAIN_CI_RUN_ID:-}" ]; then
    echo "FATAL: MAIN_CI_RUN_ID is required to bind exact-main CI provenance!"
    exit 1
fi
if [ -z "${POSTFLIGHT_ADMIN_ID:-}" ] || [ -z "${POSTFLIGHT_MANAGER_ID:-}" ]; then
    echo "FATAL: POSTFLIGHT_ADMIN_ID and POSTFLIGHT_MANAGER_ID are required to verify reviewed principal access!"
    exit 1
fi

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

# Validate image source commit
if [ -z "${EXPECTED_COMMIT_SHA:-}" ]; then
    echo "FATAL: EXPECTED_COMMIT_SHA is required and must not be empty!"
    exit 1
fi

IMAGE_SOURCE_COMMIT=$("${DOCKER_CMD}" inspect "${TARGET_IMAGE_ID}" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null || true)
if [ -z "${IMAGE_SOURCE_COMMIT}" ]; then
    IMAGE_SOURCE_COMMIT=$("${DOCKER_CMD}" inspect "${TARGET_IMAGE_ID}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^GIT_COMMIT=' | cut -d= -f2 || true)
fi

if [ -z "${IMAGE_SOURCE_COMMIT}" ]; then
    echo "FATAL: Could not extract source commit from target image (${TARGET_IMAGE_ID})!"
    exit 1
fi

echo "Target image source commit: ${IMAGE_SOURCE_COMMIT}"
if [ "${IMAGE_SOURCE_COMMIT}" != "${EXPECTED_COMMIT_SHA}" ]; then
    echo "FATAL: Target image commit (${IMAGE_SOURCE_COMMIT}) does not match expected commit (${EXPECTED_COMMIT_SHA})!"
    exit 1
fi

# Capture live Apache config hash before quiescence
if [ -f "${APACHE_CONF_DIR}/httpd-lims.conf" ]; then
    APACHE_LIVE_HASH=$(sha256sum "${APACHE_CONF_DIR}/httpd-lims.conf" 2>/dev/null | awk '{print $1}' || echo "unknown")
    echo "Live Apache configuration SHA256: ${APACHE_LIVE_HASH}"
fi

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

# --- Step 6: Start Container with Background Writers Held (Pre-Exposure Mode) ---
PHASE="CONTAINER_START"
echo "--- Step 6: Start Container with Background Writers Held (Pre-Exposure Mode) ---"
start_app_container "${TARGET_IMAGE_ID}" "pre_exposure"

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

# Verify background jobs are actively held during pre-exposure phase
ENV_CHECK=$("${DOCKER_CMD}" inspect "${APP_CONTAINER_NAME}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^DISABLE_BACKGROUND_JOBS=' || true)
if [ "${ENV_CHECK}" != "DISABLE_BACKGROUND_JOBS=true" ]; then
    echo "FATAL: Pre-exposure container did not enforce DISABLE_BACKGROUND_JOBS=true!"
    exit 1
fi
KOBO_CHECK=$("${DOCKER_CMD}" logs --tail 50 "${APP_CONTAINER_NAME}" 2>&1 | grep "KOBO_SCHEDULER" || true)
if [ -n "${KOBO_CHECK}" ]; then
    echo "FATAL: Kobo scheduler was active during pre-exposure phase: ${KOBO_CHECK}"
    exit 1
fi
echo "CONFIRMED: Background sync writers suppressed during pre-exposure (zero scheduler activity)."

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

# Verify dedicated postflight script SHA256 inside target container
POSTFLIGHT_FILE="/app/server/scripts/postflight_issue140.cjs"
ACTUAL_POSTFLIGHT_SHA=$("${DOCKER_CMD}" exec "${APP_CONTAINER_NAME}" sha256sum "${POSTFLIGHT_FILE}" | awk '{print $1}')
echo "Postflight script SHA256 inside container: ${ACTUAL_POSTFLIGHT_SHA}"

if [ -n "${EXPECTED_POSTFLIGHT_SHA}" ] && [ "${ACTUAL_POSTFLIGHT_SHA}" != "${EXPECTED_POSTFLIGHT_SHA}" ]; then
    echo "FATAL: Postflight script SHA256 mismatch! Expected ${EXPECTED_POSTFLIGHT_SHA}, got ${ACTUAL_POSTFLIGHT_SHA}."
    exit 1
fi
echo "PASS: Postflight script SHA256 verified against expected hash."

# Execute dedicated read-only Issue #140 postflight suite inside target container
echo "Executing dedicated read-only Issue #140 postflight suite..."
"${DOCKER_CMD}" exec -e POSTFLIGHT_ADMIN_ID="${POSTFLIGHT_ADMIN_ID}" -e POSTFLIGHT_MANAGER_ID="${POSTFLIGHT_MANAGER_ID}" "${APP_CONTAINER_NAME}" node "${POSTFLIGHT_FILE}"

# Verify data counts strictly unchanged before live exposure
PRE_EXP_SAMPLES=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM Sample;")
PRE_EXP_RESULTS=$("${SQLITE3_CMD}" "${DB_PATH}" "SELECT count(*) FROM Result;")
if [ "${PRE_EXP_SAMPLES}" -ne "${STOPPED_SAMPLES}" ] || [ "${PRE_EXP_RESULTS}" -ne "${STOPPED_RESULTS}" ]; then
    echo "FATAL: Data corruption detected prior to exposure! Samples: ${PRE_EXP_SAMPLES} vs ${STOPPED_SAMPLES}"
    exit 1
fi
echo "Pre-exposure checks passed. System ready for live exposure."

# --- Step 8: Production Cutover & Live Ingress Restoration (COMMITTED Phase) ---
echo "--- Step 8: Production Cutover & Live Ingress Restoration (COMMITTED) ---"

# Durable no-automatic-restore boundary: Transition to COMMITTED phase BEFORE writers resume
# Any failure after this point must fail closed with operator recovery to prevent overwriting new client data
PHASE="COMMITTED"
echo "Phase transitioned to COMMITTED. Automatic database restore is strictly disabled."

# Restart container in full production mode (normal background schedulers enabled)
echo "Restarting application container with full production background settings..."
"${DOCKER_CMD}" stop -t 10 "${APP_CONTAINER_NAME}"
start_app_container "${TARGET_IMAGE_ID}" "production"

# Verify final runtime image ID after second container start
FINAL_RUNTIME_IMAGE_ID=$("${DOCKER_CMD}" inspect "${APP_CONTAINER_NAME}" --format '{{.Image}}' 2>/dev/null || true)
if [ "${FINAL_RUNTIME_IMAGE_ID}" != "${TARGET_IMAGE_ID}" ]; then
    echo "FATAL: Final runtime container image (${FINAL_RUNTIME_IMAGE_ID}) does not match target image ID (${TARGET_IMAGE_ID})!"
    exit 1
fi
echo "PASS: Final runtime container verified running target image ID: ${FINAL_RUNTIME_IMAGE_ID}"

# Verify DISABLE_BACKGROUND_JOBS is absent in final production runtime settings
FINAL_ENV_CHECK=""
FINAL_ENV_RC=0
FINAL_ENV_CHECK=$("${DOCKER_CMD}" inspect "${APP_CONTAINER_NAME}" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>&1) || FINAL_ENV_RC=$?

if [ ${FINAL_ENV_RC} -ne 0 ] || [ -z "${FINAL_ENV_CHECK}" ]; then
    echo "FATAL: Failed to inspect final runtime container environment: ${FINAL_ENV_CHECK}"
    exit 1
fi

if printf '%s\n' "${FINAL_ENV_CHECK}" | grep -q '^DISABLE_BACKGROUND_JOBS=true$'; then
    echo "FATAL: Final production container unexpectedly retains DISABLE_BACKGROUND_JOBS setting!"
    exit 1
fi

if printf '%s\n' "${FINAL_ENV_CHECK}" | grep -q '^ENABLE_BACKGROUND_JOBS=false$'; then
    echo "FATAL: Final production container has ENABLE_BACKGROUND_JOBS=false (alternate suppression flag active)!"
    exit 1
fi

echo "CONFIRMED: Background job suppression removed; production writers active."

for i in $(seq 1 30); do
    if "${CURL_CMD}" -s -f --max-time 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
        echo "Production container healthy at second $i."
        break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
        echo "FATAL: Production container failed health check within 30 seconds!"
        exit 1
    fi
done

# Transition to live ingress routing (COMMITTED)
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
LEDGER_FILE="${LOG_DIR}/release_ledger_issue140_${TIMESTAMP}.json"
cat << LEDGER_JSON > "${LEDGER_FILE}"
{
  "releaseId": "issue-140-pr149",
  "executionTimestamp": "${TIMESTAMP}",
  "status": "SUCCESS",
  "targetImageInput": "${REVIEWED_IMAGE}",
  "targetImageId": "${TARGET_IMAGE_ID}",
  "finalRuntimeImageId": "${FINAL_RUNTIME_IMAGE_ID}",
  "imageSourceCommit": "${IMAGE_SOURCE_COMMIT:-unknown}",
  "expectedCommitSha": "${EXPECTED_COMMIT_SHA:-unknown}",
  "mainCiRunId": "${MAIN_CI_RUN_ID:-unknown}",
  "postflightAdminId": "${POSTFLIGHT_ADMIN_ID:-unknown}",
  "postflightManagerId": "${POSTFLIGHT_MANAGER_ID:-unknown}",
  "wrapperScriptSha256": "${WRAPPER_SCRIPT_HASH:-unknown}",
  "apacheConfigSha256": "${APACHE_LIVE_HASH:-unknown}",
  "expectedPostflightSha": "${EXPECTED_POSTFLIGHT_SHA}",
  "actualPostflightSha": "${ACTUAL_POSTFLIGHT_SHA}",
  "baselineTag": "${BASELINE_TAG}",
  "baselineImageId": "${BASELINE_IMAGE_ID}",
  "backupFile": "${BACKUP_FILE}",
  "backupSha256": "${BACKUP_SHA}",
  "stoppedWriterCounts": {
    "samples": ${STOPPED_SAMPLES},
    "results": ${STOPPED_RESULTS}
  },
  "runtimeConfiguration": {
    "appContainerName": "${APP_CONTAINER_NAME}",
    "dataVolume": "${DATA_VOLUME}",
    "assetsVolume": "${ASSETS_VOLUME}",
    "envFile": "${LIMS_OPT_DIR}/.env",
    "preExposureWriterHold": "DISABLE_BACKGROUND_JOBS=true",
    "productionBackgroundJobs": "VERIFIED_ACTIVE",
    "ingressQuiescence": "APACHE_503_REWRITE",
    "ingressResumption": "HTTP_401_VERIFIED"
  },
  "serviceHealth": {
    "publicHealthEndpoint": ${HEALTH_STATUS},
    "capabilitiesEndpoint": ${CAPS_STATUS},
    "anonymousDirectoryPolicy": ${DIR_STATUS},
    "anonymousStatsPolicy": ${EXCH_STATS_STATUS},
    "anonymousGeojsonPolicy": ${GEOJSON_STATUS}
  },
  "transcriptFile": "${LOG_FILE}"
}
LEDGER_JSON

echo "============================================================"
echo "  RELEASE EXECUTION SUCCESSFUL: ISSUE #140                   "
echo "  Target Image Input:   ${REVIEWED_IMAGE}                    "
echo "  Target Image ID:      ${TARGET_IMAGE_ID}                   "
echo "  Expected Commit SHA:  ${EXPECTED_COMMIT_SHA}               "
echo "  Rollback Baseline ID: ${BASELINE_IMAGE_ID} (${BASELINE_TAG})"
echo "  Consistent Backup:    ${BACKUP_FILE}                       "
echo "  Backup SHA256:        ${BACKUP_SHA}                        "
echo "  Stopped-Writer Count: Samples=${STOPPED_SAMPLES}, Results=${STOPPED_RESULTS}"
echo "  Postflight SHA256:    ${ACTUAL_POSTFLIGHT_SHA}             "
echo "  Background Writers:   Held during pre-exposure, Restored in production"
echo "  Ingress Quiescence:   Enforced (503), Resumption verified (401)"
echo "  Release Transcript:   ${LOG_FILE}                          "
echo "  Release Ledger:       ${LEDGER_FILE}                       "
echo "============================================================"
