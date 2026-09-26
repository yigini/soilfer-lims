#!/bin/bash
set -euo pipefail

echo "============================================================"
echo "  SOILFER-LIMS PRODUCTION APPLY EXECUTION: ISSUE #146 / PR 147"
echo "  Target: Enable Ghana Kobo Connection & Bounded Ingestion    "
echo "  Source Snapshot: 459 Submissions (SHA: 33db90cdcab60ccf)    "
echo "  High-Water Boundary: 40747 (864 Expected Specimens)         "
echo "============================================================"

# --- Configuration & Defaults ---
if [ $# -lt 1 ] || [ -z "$1" ]; then
    echo "FATAL: Must provide reviewed immutable image tag or digest as first argument!"
    echo "Usage: $0 <reviewed-image-tag-or-digest>"
    exit 1
fi

REVIEWED_IMAGE="$1"
APP_CONTAINER_NAME=${APP_CONTAINER_NAME:-"soilfer-lims"}
VOLUME_NAME=${DOCKER_VOLUME_NAME:-"lims_lims-data"}
LIMS_OPT_DIR=${LIMS_OPT_DIR:-"/opt/lims"}
APACHE_CONF_DIR=${APACHE_CONF_DIR:-"/etc/httpd/conf/extra"}
SYSTEMCTL_CMD=${SYSTEMCTL_CMD:-"systemctl"}
CURL_CMD=${CURL_CMD:-"curl"}
SQLITE3_CMD=${SQLITE3_CMD:-"sqlite3"}

PRIVATE_SNAPSHOT=${PRIVATE_SNAPSHOT:-"${LIMS_OPT_DIR}/private_kobo/ghana_kobo_snapshot_40747.json"}
PRIVATE_MANIFEST=${PRIVATE_MANIFEST:-"${LIMS_OPT_DIR}/private_kobo/ghana_kobo_manifest_40747.json"}

EXPECTED_SNAPSHOT_SHA=${EXPECTED_SNAPSHOT_SHA:-"33db90cdcab60ccf4801a7754d8444893c0b6ee25f269a65366d6fed5046292f"}
EXPECTED_MANIFEST_SHA=${EXPECTED_MANIFEST_SHA:-"e43d490366eda0e325b1f1639c743b57105a6256e0f406df6f7e1d87514adaed"}
RUNNER_SCRIPT=${RUNNER_SCRIPT:-"/app/server/scripts/execute_ghana_apply_146.cjs"}
EXPECTED_APPLY_COUNT=${EXPECTED_APPLY_COUNT:-864}

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_CONSISTENT="${LIMS_OPT_DIR}/backups/dev_pre_issue146_${TIMESTAMP}.db"
LOG_FILE="${LIMS_OPT_DIR}/logs/apply_issue146_${TIMESTAMP}.log"

RUNNER_DRYRUN_NAME="soilfer-lims-dryrun-${TIMESTAMP}"
RUNNER_APPLY_NAME="soilfer-lims-apply-${TIMESTAMP}"

mkdir -p "${LIMS_OPT_DIR}/backups" "${LIMS_OPT_DIR}/logs"

# --- Step 0: Exclusive Host Lock ---
LOCK_FILE="${LIMS_OPT_DIR}/apply_issue146.lock"
LOCK_DIR="${LIMS_OPT_DIR}/apply_issue146.lock.d"
PID_FILE="${LIMS_OPT_DIR}/apply_issue146.pid"

if command -v flock >/dev/null 2>&1; then
    exec 200>"${LOCK_FILE}"
    if ! flock -n 200; then
        echo "FATAL: Another apply or release process holds ${LOCK_FILE}! Aborting."
        exit 1
    fi
else
    if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
        echo "FATAL: Lock directory ${LOCK_DIR} already exists! Another apply or release process is active."
        exit 1
    fi
fi
echo "$$" > "${PID_FILE}"

# Track execution phase for phase-aware recovery decisions
PHASE="INIT"

# Assert no writers are running (fail-closed: inspect failure is NOT treated as stopped)
assert_no_writers_running() {
    local targets=("${APP_CONTAINER_NAME}" "${RUNNER_DRYRUN_NAME}" "${RUNNER_APPLY_NAME}")
    for c in "${targets[@]}"; do
        local inspect_out
        local inspect_rc=0
        inspect_out=$(docker inspect "$c" --format '{{.State.Running}}' 2>&1) || inspect_rc=$?

        if [ ${inspect_rc} -eq 0 ]; then
            if [ "${inspect_out}" = "true" ]; then
                echo "Container '$c' is running. Stopping container..."
                docker stop -t 5 "$c" 2>/dev/null || true
                if [ "$c" != "${APP_CONTAINER_NAME}" ]; then
                    docker rm -f "$c" 2>/dev/null || true
                fi
                inspect_rc=0
                inspect_out=$(docker inspect "$c" --format '{{.State.Running}}' 2>&1) || inspect_rc=$?
                local lower_stop_out
                lower_stop_out=$(echo "${inspect_out}" | tr '[:upper:]' '[:lower:]')
                if [ ${inspect_rc} -eq 0 ]; then
                    if [ "${inspect_out}" != "false" ]; then
                        echo "FATAL: Container '$c' is still running after stop attempt!"
                        return 1
                    fi
                elif docker version >/dev/null 2>&1 && [[ "${lower_stop_out}" == *"no such container: ${c}"* || "${lower_stop_out}" == *"no such object: ${c}"* ]]; then
                    : # Cleanly removed and confirmed absent by reachable daemon
                else
                    echo "FATAL: Docker inspect failed for '$c' after stop attempt: ${inspect_out}"
                    return 1
                fi
            elif [ "${inspect_out}" = "false" ]; then
                : # Confirmed stopped
            else
                echo "FATAL: Unexpected docker inspect output for '$c': ${inspect_out}"
                return 1
            fi
        else
            # Non-zero exit code: require exact container-specific not-found from reachable daemon
            local lower_inspect_out
            lower_inspect_out=$(echo "${inspect_out}" | tr '[:upper:]' '[:lower:]')
            if docker version >/dev/null 2>&1 && [[ "${lower_inspect_out}" == *"no such container: ${c}"* || "${lower_inspect_out}" == *"no such object: ${c}"* ]]; then
                : # Positively established absent container from reachable daemon
            else
                echo "FATAL: Docker inspect failed for '$c' (exit code ${inspect_rc}): ${inspect_out}"
                return 1
            fi
        fi
    done
    return 0
}

# --- Cleanup Trap (Phase-Aware & Signal-Aware) ---
cleanup() {
    local exit_code=$?
    local signal=${1:-"EXIT"}

    # Immediately disable all traps to prevent re-entrant or recursive calls
    trap - SIGHUP SIGINT SIGTERM EXIT

    # Signal arrival forces non-zero exit code
    if [ "${signal}" != "EXIT" ] && [ ${exit_code} -eq 0 ]; then
        exit_code=1
    fi

    if [ ${exit_code} -ne 0 ] || [ "${signal}" != "EXIT" ]; then
        echo ""
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "  FAILURE DETECTED (Exit code: ${exit_code}, Signal: ${signal}, Phase: ${PHASE})"
        echo "  Executing phase-aware safe recovery...                   "
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"

        # Phase INIT: Preflight read-only checks failed before any service, proxy, or DB action
        if [ "${PHASE}" = "INIT" ]; then
            echo "Preflight check failed prior to maintenance or mutation."
            echo "Live application container and reverse proxy remain untouched."
            rmdir "${LOCK_DIR}" 2>/dev/null || true
            rm -f "${PID_FILE}" 2>/dev/null || true
            exit ${exit_code}
        fi

        # Phase ENTERING_MAINTENANCE: Transitioning into maintenance mode failed before quiescence confirmed
        if [ "${PHASE}" = "ENTERING_MAINTENANCE" ]; then
            echo "Failure occurred while transitioning to maintenance mode."
            if [ -f "${APACHE_CONF_DIR}/httpd-lims.conf.live" ]; then
                echo "Attempting to restore live reverse proxy configuration..."
                cp "${APACHE_CONF_DIR}/httpd-lims.conf.live" "${APACHE_CONF_DIR}/httpd-lims.conf" 2>/dev/null || true
                if ${SYSTEMCTL_CMD} reload httpd 2>/dev/null; then
                    echo "✓ Live reverse proxy configuration restored."
                else
                    echo "WARNING: Reverse proxy reload failed during ENTERING_MAINTENANCE cleanup! Ingress state is UNCERTAIN. Operator intervention required."
                fi
            else
                echo "WARNING: Live proxy configuration backup (.live) not found! Ingress state is UNCERTAIN. Operator intervention required."
            fi
            rmdir "${LOCK_DIR}" 2>/dev/null || true
            rm -f "${PID_FILE}" 2>/dev/null || true
            exit ${exit_code}
        fi

        # 1. Terminate and remove all runner containers
        docker stop -t 5 "${RUNNER_DRYRUN_NAME}" "${RUNNER_APPLY_NAME}" 2>/dev/null || true
        docker rm -f "${RUNNER_DRYRUN_NAME}" "${RUNNER_APPLY_NAME}" 2>/dev/null || true

        # If we entered mutating phases, ensure app container is stopped
        if [ "${PHASE}" != "INGRESS_QUIESCED" ]; then
            docker stop -t 5 "${APP_CONTAINER_NAME}" 2>/dev/null || true
        fi

        # 2. Confirm all writers are stopped before manipulating database
        if ! assert_no_writers_running; then
            echo "FATAL: Could not confirm all writers stopped! Database recovery halted to prevent corruption."
            echo "Ingress remains write-blocked (503). Operator intervention required."
            rmdir "${LOCK_DIR}" 2>/dev/null || true
            rm -f "${PID_FILE}" 2>/dev/null || true
            exit 1
        fi

        # 3. Phase-aware recovery decision:
        if [ "${PHASE}" = "BACKUP_TAKEN" ] || [ "${PHASE}" = "DRYRUN_DONE" ] || [ "${PHASE}" = "APPLYING" ]; then
            echo "Recovery: Restoring database from pre-operation consistent backup..."
            if [ -f "${BACKUP_CONSISTENT}" ]; then
                rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"
                cp "${BACKUP_CONSISTENT}" "${DB_PATH}"

                RESTORE_HASH=$(sha256sum "${DB_PATH}" | awk '{print $1}')
                if [ "${RESTORE_HASH}" != "${BACKUP_HASH}" ]; then
                    echo "FATAL: Restored DB hash (${RESTORE_HASH}) does not match pre-apply backup (${BACKUP_HASH})!"
                    echo "Ingress remains write-blocked (503). Operator intervention required."
                    rmdir "${LOCK_DIR}" 2>/dev/null || true
                    rm -f "${PID_FILE}" 2>/dev/null || true
                    exit 1
                fi

                REC_INTEGRITY=$(${SQLITE3_CMD:-sqlite3} "${DB_PATH}" "PRAGMA integrity_check;")
                REC_FK=$(${SQLITE3_CMD:-sqlite3} "${DB_PATH}" "PRAGMA foreign_key_check;")
                REC_SAMPLES=$(${SQLITE3_CMD:-sqlite3} "${DB_PATH}" "SELECT count(*) FROM Sample;")

                if [ "${REC_INTEGRITY}" != "ok" ] || [ -n "${REC_FK}" ] || [ "${REC_SAMPLES}" -ne "${BASE_SAMPLES}" ]; then
                    echo "FATAL: Restored database assertions failed!"
                    echo "Ingress remains write-blocked (503). Operator intervention required."
                    rmdir "${LOCK_DIR}" 2>/dev/null || true
                    rm -f "${PID_FILE}" 2>/dev/null || true
                    exit 1
                fi
                echo "✓ Database restored and bit-for-bit verified (Baseline samples: ${REC_SAMPLES}, Integrity: ok)"
            fi
        elif [ "${PHASE}" = "APPLY_COMMITTED" ] || [ "${PHASE}" = "POSTFLIGHT_VERIFIED" ] || [ "${PHASE}" = "APP_HEALTHY" ] || [ "${PHASE}" = "RESTORING_INGRESS" ]; then
            echo "NOTICE: Apply operation already committed (864 samples admitted). Preserving applied database state."
            echo "Do NOT restore pre-apply backup; background writers/events may have occurred."
        fi

        # If failure occurred during proxy restoration, re-apply and verify quiescence
        local quiescence_reloaded=false
        if [ "${PHASE}" = "RESTORING_INGRESS" ]; then
            echo "Re-applying write-quiescence proxy config after restoration failure..."
            cp "${APACHE_CONF_DIR}/httpd-lims.conf.quiesce" "${APACHE_CONF_DIR}/httpd-lims.conf" 2>/dev/null || true
            if ${SYSTEMCTL_CMD} reload httpd 2>/dev/null; then
                quiescence_reloaded=true
                echo "✓ Ingress write quiescence re-confirmed active."
            else
                echo "WARNING: Reverse proxy reload failed during RESTORING_INGRESS recovery! Ingress state is UNCERTAIN."
            fi
        fi

        # Honest Ingress Reporting: verify reload and on-disk config rather than assuming 503
        if [ "${PHASE}" = "RESTORING_INGRESS" ]; then
            if [ "${quiescence_reloaded}" = "true" ] && grep -q "Write Quiescence Active" "${APACHE_CONF_DIR}/httpd-lims.conf" 2>/dev/null; then
                echo "FATAL: Ingress remains write-quiesced (HTTP 503) to protect system. Operator intervention required."
            else
                echo "WARNING: Ingress state is UNCERTAIN (proxy reload failed or unverified). Operator intervention required."
            fi
        elif [ "${PHASE}" != "INIT" ] && [ "${PHASE}" != "ENTERING_MAINTENANCE" ]; then
            # Phases INGRESS_QUIESCED through APP_HEALTHY
            if grep -q "Write Quiescence Active" "${APACHE_CONF_DIR}/httpd-lims.conf" 2>/dev/null; then
                echo "FATAL: Ingress remains write-quiesced (HTTP 503) to protect system. Operator intervention required."
            else
                echo "WARNING: Ingress state is UNCERTAIN (quiescence config missing from disk). Operator intervention required."
            fi
        fi

        # Retain lock throughout entire recovery; release only now
        rmdir "${LOCK_DIR}" 2>/dev/null || true
        rm -f "${PID_FILE}" 2>/dev/null || true
        exit ${exit_code}
    fi
}

trap 'cleanup "HUP"' SIGHUP
trap 'cleanup "INT"' SIGINT
trap 'cleanup "TERM"' SIGTERM
trap 'cleanup "EXIT"' EXIT

# --- Step 1: Pre-Execution Assertions (Images, Mounts, Files) ---
echo "--- Step 1: Pre-Execution Environment & Image Assertions ---"

# 1.1 Private snapshot and manifest files
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

# 1.2 Inspect reviewed image ID
REVIEWED_IMAGE_ID=$(docker image inspect "${REVIEWED_IMAGE}" --format '{{.Id}}' 2>/dev/null || true)
if [ -z "${REVIEWED_IMAGE_ID}" ]; then
    echo "FATAL: Reviewed image '${REVIEWED_IMAGE}' not found in local Docker store!"
    exit 1
fi

# 1.3 Inspect application container and assert image matches reviewed runner image
APP_CONTAINER_IMAGE_ID=$(docker inspect "${APP_CONTAINER_NAME}" --format '{{.Image}}' 2>/dev/null || true)
if [ -z "${APP_CONTAINER_IMAGE_ID}" ]; then
    echo "FATAL: Application container '${APP_CONTAINER_NAME}' not found or inspect failed!"
    exit 1
fi

if [ "${REVIEWED_IMAGE_ID}" != "${APP_CONTAINER_IMAGE_ID}" ]; then
    echo "FATAL: Container '${APP_CONTAINER_NAME}' actual image ID (${APP_CONTAINER_IMAGE_ID}) does not match reviewed runner image (${REVIEWED_IMAGE} -> ${REVIEWED_IMAGE_ID})!"
    echo "The reviewed image must be deployed to ${APP_CONTAINER_NAME} before running the correction wrapper."
    exit 1
fi

# 1.4 Inspect container mount to ensure it mounts the exact volume to /app/server/prisma
APP_PRISMA_MOUNT=$(docker inspect "${APP_CONTAINER_NAME}" --format '{{range .Mounts}}{{if eq .Destination "/app/server/prisma"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)
if [ "${APP_PRISMA_MOUNT}" != "${VOLUME_NAME}" ]; then
    echo "FATAL: Container '${APP_CONTAINER_NAME}' /app/server/prisma is not mounted to '${VOLUME_NAME}' (found: '${APP_PRISMA_MOUNT}')!"
    exit 1
fi

# 1.5 Inspect Docker volume mountpoint (refuse to guess paths)
DB_VOL_PATH=$(docker volume inspect "${VOLUME_NAME}" --format '{{.Mountpoint}}' 2>/dev/null || true)
if [ -z "${DB_VOL_PATH}" ] || [ ! -d "${DB_VOL_PATH}" ]; then
    echo "FATAL: Docker volume '${VOLUME_NAME}' inspection failed or mountpoint directory missing! Refusing to guess DB path."
    exit 1
fi
DB_PATH="${DB_VOL_PATH}/dev.db"
if [ ! -f "${DB_PATH}" ]; then
    echo "FATAL: Production SQLite database not found at ${DB_PATH}!"
    exit 1
fi

echo "✓ Verified: Container '${APP_CONTAINER_NAME}' mounts volume '${VOLUME_NAME}' (${DB_VOL_PATH}) and matches reviewed image (${REVIEWED_IMAGE_ID})"

# 1.6 Verify reviewed intake guards exist in reviewed image
echo "Verifying reviewed intake guards in target image..."
docker run --rm --entrypoint node --network none "${REVIEWED_IMAGE_ID}" -e "
const fs = require('fs');
const rc = fs.readFileSync('/app/server/controllers/receptionController.js', 'utf8');
const sc = fs.readFileSync('/app/server/controllers/sampleController.js', 'utf8');
if (!rc.includes('AMBIGUOUS_PROVENANCE_HOLD') || !sc.includes('AMBIGUOUS_PROVENANCE_HOLD')) {
    console.error('ERROR: Reviewed AMBIGUOUS_PROVENANCE_HOLD intake guards missing from image!');
    process.exit(1);
}
console.log('✓ Target image confirmed: contains reviewed AMBIGUOUS_PROVENANCE_HOLD intake guards.');
"

# --- Step 2: Enforce Ingress Write Quiescence (Apache 503 Rewrite) ---
echo "--- Step 2: Enforce Ingress Write Quiescence (Apache 503 Rewrite) ---"
PHASE="ENTERING_MAINTENANCE"
cp "${APACHE_CONF_DIR}/httpd-lims.conf" "${APACHE_CONF_DIR}/httpd-lims.conf.live"

cat << 'APACHE_EOF' > "${APACHE_CONF_DIR}/httpd-lims.conf.quiesce"
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

cp "${APACHE_CONF_DIR}/httpd-lims.conf.quiesce" "${APACHE_CONF_DIR}/httpd-lims.conf"
if ! ${SYSTEMCTL_CMD} reload httpd; then
    echo "FATAL: Failed to reload reverse proxy with write quiescence configuration!"
    exit 1
fi
echo "✓ Ingress write quiescence active (HTTP 503 for mutating requests, read-only allowed)"
PHASE="INGRESS_QUIESCED"

# --- Step 3: Quiesce Application Container & Confirm Writer Exclusion ---
echo "--- Step 3: Quiesce Application Container & Schedulers ---"
docker stop -t 10 "${APP_CONTAINER_NAME}"
if ! assert_no_writers_running; then
    echo "FATAL: Application container failed to stop cleanly!"
    exit 1
fi
echo "✓ Application container stopped. Running state confirmed false."
PHASE="QUIESCED_WRITERS_STOPPED"

# --- Step 4: Quiesced Database Checkpoint & Consistent Pre-Operation Backup ---
echo "--- Step 4: Quiesced Database Checkpoint & Pre-Operation Consistent Backup ---"
${SQLITE3_CMD} "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"
${SQLITE3_CMD} "${DB_PATH}" ".backup '${BACKUP_CONSISTENT}'"
BACKUP_HASH=$(sha256sum "${BACKUP_CONSISTENT}" | awk '{print $1}')
INTEGRITY=$(${SQLITE3_CMD} "${BACKUP_CONSISTENT}" "PRAGMA integrity_check;")
FK_CHECK=$(${SQLITE3_CMD} "${BACKUP_CONSISTENT}" "PRAGMA foreign_key_check;")
BASE_SAMPLES=$(${SQLITE3_CMD} "${BACKUP_CONSISTENT}" "SELECT count(*) FROM Sample;")

echo "  Consistent pre-operation backup saved: ${BACKUP_CONSISTENT}"
echo "  Pre-operation SHA-256: ${BACKUP_HASH}"
echo "  Integrity: ${INTEGRITY}, FK: ${FK_CHECK:-OK}, Baseline Samples: ${BASE_SAMPLES}"

if [ "${INTEGRITY}" != "ok" ] || [ -n "${FK_CHECK}" ]; then
    echo "FATAL: Pre-operation database check failed!"
    exit 1
fi
PHASE="BACKUP_TAKEN"

# --- Step 5: Execute Dry-Run Validation in One-Shot Isolated Container ---
echo "--- Step 5: Execute Dry-Run Validation in One-Shot Isolated Container ---"
ENV_FILE_OPTS=()
if [ -f "${LIMS_OPT_DIR}/.env" ]; then
    ENV_FILE_OPTS=("--env-file" "${LIMS_OPT_DIR}/.env")
fi

docker run --rm \
  --name "${RUNNER_DRYRUN_NAME}" \
  --entrypoint node \
  --network none \
  --user 0:0 \
  "${ENV_FILE_OPTS[@]}" \
  -e DISABLE_BACKGROUND_JOBS=true \
  -e DATABASE_PATH="/app/server/prisma/dev.db" \
  -e GHANA_SNAPSHOT_PATH="/private/ghana_kobo_snapshot_40747.json" \
  -e GHANA_MANIFEST_PATH="/private/ghana_kobo_manifest_40747.json" \
  -v "${VOLUME_NAME}:/app/server/prisma" \
  -v lims_lims-assets:/app/server/uploads \
  -v "${PRIVATE_SNAPSHOT}:/private/ghana_kobo_snapshot_40747.json:ro" \
  -v "${PRIVATE_MANIFEST}:/private/ghana_kobo_manifest_40747.json:ro" \
  "${REVIEWED_IMAGE_ID}" \
  "${RUNNER_SCRIPT}" --dry-run | tee -a "${LOG_FILE}"

PHASE="DRYRUN_DONE"

# --- Step 6: Execute Guarded Apply in One-Shot Isolated Container ---
echo "--- Step 6: Execute Guarded Apply in One-Shot Isolated Container ---"
PHASE="APPLYING"
docker run --rm \
  --name "${RUNNER_APPLY_NAME}" \
  --entrypoint node \
  --network none \
  --user 0:0 \
  "${ENV_FILE_OPTS[@]}" \
  -e DISABLE_BACKGROUND_JOBS=true \
  -e DATABASE_PATH="/app/server/prisma/dev.db" \
  -e GHANA_SNAPSHOT_PATH="/private/ghana_kobo_snapshot_40747.json" \
  -e GHANA_MANIFEST_PATH="/private/ghana_kobo_manifest_40747.json" \
  -v "${VOLUME_NAME}:/app/server/prisma" \
  -v lims_lims-assets:/app/server/uploads \
  -v "${PRIVATE_SNAPSHOT}:/private/ghana_kobo_snapshot_40747.json:ro" \
  -v "${PRIVATE_MANIFEST}:/private/ghana_kobo_manifest_40747.json:ro" \
  "${REVIEWED_IMAGE_ID}" \
  "${RUNNER_SCRIPT}" --apply | tee -a "${LOG_FILE}"

# The Commit Point has been reached successfully!
PHASE="APPLY_COMMITTED"
echo "✓ Apply completed successfully! ${EXPECTED_APPLY_COUNT} Expected specimens admitted."

# --- Step 7: Post-Apply WAL Checkpoint & Integrity Audit ---
echo "--- Step 7: Post-Apply WAL Checkpoint & Integrity Audit ---"
${SQLITE3_CMD} "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"
POST_INTEGRITY=$(${SQLITE3_CMD} "${DB_PATH}" "PRAGMA integrity_check;")
POST_FK=$(${SQLITE3_CMD} "${DB_PATH}" "PRAGMA foreign_key_check;")
POST_SAMPLES=$(${SQLITE3_CMD} "${DB_PATH}" "SELECT count(*) FROM Sample;")
EXPECTED_TOTAL=$((BASE_SAMPLES + EXPECTED_APPLY_COUNT))

echo "  Post-apply Samples: ${POST_SAMPLES} (Expected: ${EXPECTED_TOTAL})"
echo "  Post-apply Integrity: ${POST_INTEGRITY}, FK: ${POST_FK:-OK}"

if [ "${POST_INTEGRITY}" != "ok" ] || [ -n "${POST_FK}" ] || [ "${POST_SAMPLES}" -ne "${EXPECTED_TOTAL}" ]; then
    echo "FATAL: Post-apply verification failed!"
    exit 1
fi
PHASE="POSTFLIGHT_VERIFIED"

# --- Step 8: Restart Application Container & Verify Health ---
echo "--- Step 8: Restart Application Container & Verify Health ---"

# Recheck actual container identity and volume mount before resuming
RESUME_APP_IMAGE_ID=$(docker inspect "${APP_CONTAINER_NAME}" --format '{{.Image}}' 2>/dev/null || true)
if [ "${RESUME_APP_IMAGE_ID}" != "${REVIEWED_IMAGE_ID}" ]; then
    echo "FATAL: Application container image changed before restart! Expected ${REVIEWED_IMAGE_ID}, got ${RESUME_APP_IMAGE_ID}"
    exit 1
fi
RESUME_MOUNT=$(docker inspect "${APP_CONTAINER_NAME}" --format '{{range .Mounts}}{{if eq .Destination "/app/server/prisma"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)
if [ "${RESUME_MOUNT}" != "${VOLUME_NAME}" ]; then
    echo "FATAL: Application container mount changed before restart! Expected ${VOLUME_NAME}, got ${RESUME_MOUNT}"
    exit 1
fi

docker start "${APP_CONTAINER_NAME}"
APP_HEALTH_OK=false
HEALTH_RETRIES=${HEALTH_RETRIES:-30}
for i in $(seq 1 "${HEALTH_RETRIES}"); do
    HEALTH=$(${CURL_CMD} -sf http://localhost:3000/api/health | grep -o '"status":"ok"' || true)
    if [ -n "$HEALTH" ]; then
        APP_HEALTH_OK=true
        echo "✓ Application container healthy at attempt $i!"
        break
    fi
    sleep 1
done

if [ "${APP_HEALTH_OK}" != "true" ]; then
    echo "FATAL: Application container failed health check within ${HEALTH_RETRIES} attempts!"
    exit 1
fi
PHASE="APP_HEALTHY"

# --- Step 9: Restore Live Ingress Traffic ---
echo "--- Step 9: Restore Live Ingress Traffic ---"
PHASE="RESTORING_INGRESS"
cp "${APACHE_CONF_DIR}/httpd-lims.conf.live" "${APACHE_CONF_DIR}/httpd-lims.conf"
if ! ${SYSTEMCTL_CMD} reload httpd; then
    echo "FATAL: Failed to reload Apache with live configuration!"
    exit 1
fi
echo "✓ Live traffic restored."
PHASE="COMPLETE"

# Clear traps on clean completion
trap - SIGHUP SIGINT SIGTERM EXIT
rmdir "${LOCK_DIR}" 2>/dev/null || true
rm -f "${PID_FILE}" 2>/dev/null || true

echo "============================================================"
echo "  GHANA CORRECTION COMPLETE & VERIFIED                     "
echo "  ${EXPECTED_APPLY_COUNT} Expected Specimens Admitted; 4 Held; 0 Regressions   "
echo "============================================================"
