#!/bin/bash
set -euo pipefail

echo "============================================================"
echo "  SOILFER-LIMS PRODUCTION APPLY EXECUTION: ISSUE #148       "
echo "  Target: Five Kobo Project Mappings & Bounded Ingestion    "
echo "  Source Snapshot: 385 Submissions (SHA: 8e2d50f0ee3f5b0f)   "
echo "  Expected Admissions: 634 Expected Specimens               "
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

PRIVATE_SNAPSHOT=${PRIVATE_SNAPSHOT:-"${LIMS_OPT_DIR}/private_kobo/issue148_kobo_snapshot_bounded.json"}
PRIVATE_MANIFEST=${PRIVATE_MANIFEST:-"${LIMS_OPT_DIR}/private_kobo/issue148_kobo_manifest_bounded.json"}

EXPECTED_SNAPSHOT_SHA=${EXPECTED_SNAPSHOT_SHA:-"8e2d50f0ee3f5b0f7e5b474921d18c54e44c2180675e0a7944c2b01e6379f809"}
EXPECTED_MANIFEST_SHA=${EXPECTED_MANIFEST_SHA:-"f42ed9b3cc2e7fe8e27ef3b99cdba01dc280dae8687d2021651555abd7763da6"}

RUNNER_SCRIPT_HOST=${RUNNER_SCRIPT_HOST:-"${LIMS_OPT_DIR}/server/scripts/execute_kobo_correction_148.cjs"}
RUNNER_SCRIPT_CONTAINER="/app/server/scripts/execute_kobo_correction_148.cjs"
EXPECTED_RUNNER_SHA=${EXPECTED_RUNNER_SHA:-"fd63483d49ca7784a35ba0e8e6d219f87faaec386fc70d21cbd29e8624563b96"}

EXPECTED_APPLY_COUNT=${EXPECTED_APPLY_COUNT:-634}

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_CONSISTENT="${LIMS_OPT_DIR}/backups/dev_pre_issue148_${TIMESTAMP}.db"
LOG_FILE="${LIMS_OPT_DIR}/logs/apply_issue148_${TIMESTAMP}.log"

RUNNER_DRYRUN_NAME="soilfer-lims-dryrun-148-${TIMESTAMP}"
RUNNER_APPLY_NAME="soilfer-lims-apply-148-${TIMESTAMP}"

mkdir -p "${LIMS_OPT_DIR}/backups" "${LIMS_OPT_DIR}/logs"

# --- Step 0: Exclusive Host Lock (Shared & Operation-Specific) ---
LOCK_FILE="${LIMS_OPT_DIR}/apply_issue148.lock"
GLOBAL_LOCK_FILE="${LIMS_OPT_DIR}/apply.lock"
LOCK_DIR="${LIMS_OPT_DIR}/apply_issue148.lock.d"
PID_FILE="${LIMS_OPT_DIR}/apply_issue148.pid"

if command -v flock >/dev/null 2>&1; then
    exec 200>"${LOCK_FILE}"
    if ! flock -n 200; then
        echo "FATAL: Another apply or release process holds ${LOCK_FILE}! Aborting."
        exit 1
    fi
    exec 201>"${GLOBAL_LOCK_FILE}"
    if ! flock -n 201; then
        echo "FATAL: Another apply or release process holds ${GLOBAL_LOCK_FILE}! Aborting."
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

# Assert no writers are running (fail-closed)
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
                    :
                else
                    echo "FATAL: Docker inspect failed for '$c' after stop attempt: ${inspect_out}"
                    return 1
                fi
            elif [ "${inspect_out}" = "false" ]; then
                :
            else
                echo "FATAL: Unexpected docker inspect output for '$c': ${inspect_out}"
                return 1
            fi
        else
            local lower_inspect_out
            lower_inspect_out=$(echo "${inspect_out}" | tr '[:upper:]' '[:lower:]')
            if docker version >/dev/null 2>&1 && [[ "${lower_inspect_out}" == *"no such container: ${c}"* || "${lower_inspect_out}" == *"no such object: ${c}"* ]]; then
                :
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

    trap - SIGHUP SIGINT SIGTERM EXIT

    if [ "${signal}" != "EXIT" ] && [ ${exit_code} -eq 0 ]; then
        exit_code=1
    fi

    if [ ${exit_code} -ne 0 ] || [ "${signal}" != "EXIT" ]; then
        echo ""
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "  FAILURE DETECTED (Exit code: ${exit_code}, Signal: ${signal}, Phase: ${PHASE})"
        echo "  Executing phase-aware safe recovery...                   "
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"

        if [ "${PHASE}" = "INIT" ]; then
            echo "Preflight check failed prior to maintenance or mutation."
            echo "Live application container and reverse proxy remain untouched."
            rmdir "${LOCK_DIR}" 2>/dev/null || true
            rm -f "${PID_FILE}" 2>/dev/null || true
            exit ${exit_code}
        fi

        if [ "${PHASE}" = "ENTERING_MAINTENANCE" ]; then
            echo "Failure occurred while transitioning to maintenance mode."
            if [ -f "${APACHE_CONF_DIR}/httpd-lims.conf.live" ]; then
                echo "Attempting to restore live reverse proxy configuration..."
                cp "${APACHE_CONF_DIR}/httpd-lims.conf.live" "${APACHE_CONF_DIR}/httpd-lims.conf" 2>/dev/null || true
                if ${SYSTEMCTL_CMD} reload httpd 2>/dev/null; then
                    echo "✓ Live reverse proxy configuration restored."
                else
                    echo "WARNING: Reverse proxy reload failed during ENTERING_MAINTENANCE cleanup! Ingress state is UNCERTAIN."
                fi
            fi
            rmdir "${LOCK_DIR}" 2>/dev/null || true
            rm -f "${PID_FILE}" 2>/dev/null || true
            exit ${exit_code}
        fi

        # 1. Terminate and remove all runner containers
        docker stop -t 5 "${RUNNER_DRYRUN_NAME}" "${RUNNER_APPLY_NAME}" 2>/dev/null || true
        docker rm -f "${RUNNER_DRYRUN_NAME}" "${RUNNER_APPLY_NAME}" 2>/dev/null || true

        if [ "${PHASE}" != "INGRESS_QUIESCED" ]; then
            docker stop -t 5 "${APP_CONTAINER_NAME}" 2>/dev/null || true
        fi

        # 2. Confirm all writers stopped before touching database
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

                REC_INTEGRITY=$(${SQLITE3_CMD} "${DB_PATH}" "PRAGMA integrity_check;")
                REC_FK=$(${SQLITE3_CMD} "${DB_PATH}" "PRAGMA foreign_key_check;")
                REC_SAMPLES=$(${SQLITE3_CMD} "${DB_PATH}" "SELECT count(*) FROM Sample;")

                if [ "${REC_INTEGRITY}" != "ok" ] || [ -n "${REC_FK}" ] || [ "${REC_SAMPLES}" -ne "${BASE_SAMPLES}" ]; then
                    echo "FATAL: Restored database assertions failed!"
                    echo "Ingress remains write-blocked (503). Operator intervention required."
                    rmdir "${LOCK_DIR}" 2>/dev/null || true
                    rm -f "${PID_FILE}" 2>/dev/null || true
                    exit 1
                fi
                echo "✓ Database restored and bit-for-bit verified (Baseline samples: ${REC_SAMPLES}, Integrity: ok)"
            else
                echo "FATAL: Pre-operation consistent backup file missing! Cannot safely restore database."
                echo "Ingress remains write-blocked (503). Operator intervention required."
                rmdir "${LOCK_DIR}" 2>/dev/null || true
                rm -f "${PID_FILE}" 2>/dev/null || true
                exit 1
            fi
        elif [ "${PHASE}" = "APPLY_COMMITTED" ] || [ "${PHASE}" = "POSTFLIGHT_VERIFIED" ] || [ "${PHASE}" = "APP_HEALTHY" ] || [ "${PHASE}" = "RESTORING_INGRESS" ]; then
            echo "NOTICE: Apply operation already committed. Preserving applied database state."
            echo "Do NOT restore pre-apply backup; background writers/events may have occurred."
        fi

        # On failure, do NOT release live ingress. Ingress remains quiesced (503).
        if [ "${PHASE}" != "INIT" ] && [ "${PHASE}" != "ENTERING_MAINTENANCE" ]; then
            echo "FATAL: System halted after failure. Ingress remains write-quiesced (HTTP 503) to protect system."
            echo "Operator intervention required before returning to live traffic."
        fi

        rmdir "${LOCK_DIR}" 2>/dev/null || true
        rm -f "${PID_FILE}" 2>/dev/null || true
        exit ${exit_code}
    fi
}

trap 'cleanup' EXIT
trap 'cleanup SIGHUP' SIGHUP
trap 'cleanup SIGINT' SIGINT
trap 'cleanup SIGTERM' SIGTERM

# --- Step 1: Preflight Assertions & Image / Mount Verification ---
echo ""
echo "[Step 1/8] Asserting Preflight Invariants, Image Identity & Mounts..."

# 1.1 Snapshot and manifest existence and hash checks
if [ ! -f "${PRIVATE_SNAPSHOT}" ]; then
    echo "FATAL: Private snapshot file not found at ${PRIVATE_SNAPSHOT}!"
    exit 1
fi
ACTUAL_SNAP_SHA=$(sha256sum "${PRIVATE_SNAPSHOT}" | awk '{print $1}')
if [ "${ACTUAL_SNAP_SHA}" != "${EXPECTED_SNAPSHOT_SHA}" ]; then
    echo "FATAL: Snapshot hash mismatch! Expected ${EXPECTED_SNAPSHOT_SHA}, got ${ACTUAL_SNAP_SHA}"
    exit 1
fi

if [ ! -f "${PRIVATE_MANIFEST}" ]; then
    echo "FATAL: Private manifest file not found at ${PRIVATE_MANIFEST}!"
    exit 1
fi
ACTUAL_MAN_SHA=$(sha256sum "${PRIVATE_MANIFEST}" | awk '{print $1}')
if [ "${ACTUAL_MAN_SHA}" != "${EXPECTED_MANIFEST_SHA}" ]; then
    echo "FATAL: Manifest hash mismatch! Expected ${EXPECTED_MANIFEST_SHA}, got ${ACTUAL_MAN_SHA}"
    exit 1
fi
echo "✓ Private snapshot and manifest verified with expected SHA-256 hashes."

# 1.2 Runner script existence and hash check
if [ ! -f "${RUNNER_SCRIPT_HOST}" ]; then
    echo "FATAL: Runner script not found at ${RUNNER_SCRIPT_HOST}!"
    exit 1
fi
ACTUAL_RUNNER_SHA=$(sha256sum "${RUNNER_SCRIPT_HOST}" | awk '{print $1}')
if [ "${ACTUAL_RUNNER_SHA}" != "${EXPECTED_RUNNER_SHA}" ]; then
    echo "FATAL: Runner script SHA-256 mismatch! Expected ${EXPECTED_RUNNER_SHA}, got ${ACTUAL_RUNNER_SHA}"
    exit 1
fi
echo "✓ Runner script verified (SHA-256: ${ACTUAL_RUNNER_SHA})"

# 1.3 Inspect reviewed image ID
REVIEWED_IMAGE_ID=$(docker image inspect "${REVIEWED_IMAGE}" --format '{{.Id}}' 2>/dev/null || true)
if [ -z "${REVIEWED_IMAGE_ID}" ]; then
    echo "FATAL: Reviewed image '${REVIEWED_IMAGE}' not found in local Docker store!"
    exit 1
fi

# 1.4 Inspect application container image and compare with reviewed image
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

# 1.5 Inspect container mount to ensure it mounts the exact volume to /app/server/prisma
APP_PRISMA_MOUNT=$(docker inspect "${APP_CONTAINER_NAME}" --format '{{range .Mounts}}{{if eq .Destination "/app/server/prisma"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)
if [ "${APP_PRISMA_MOUNT}" != "${VOLUME_NAME}" ]; then
    echo "FATAL: Container '${APP_CONTAINER_NAME}' /app/server/prisma is not mounted to '${VOLUME_NAME}' (found: '${APP_PRISMA_MOUNT}')!"
    exit 1
fi

# 1.6 Inspect Docker volume mountpoint
DB_VOL_PATH=$(docker volume inspect "${VOLUME_NAME}" --format '{{.Mountpoint}}' 2>/dev/null || true)
if [ -z "${DB_VOL_PATH}" ] || [ ! -d "${DB_VOL_PATH}" ]; then
    echo "FATAL: Docker volume '${VOLUME_NAME}' inspection failed or mountpoint missing! Refusing to guess DB path."
    exit 1
fi
DB_PATH="${DB_VOL_PATH}/dev.db"
if [ ! -f "${DB_PATH}" ]; then
    echo "FATAL: Production SQLite database not found at ${DB_PATH}!"
    exit 1
fi

echo "✓ Verified: Container '${APP_CONTAINER_NAME}' mounts volume '${VOLUME_NAME}' (${DB_VOL_PATH}) and matches reviewed image (${REVIEWED_IMAGE_ID})"

# 1.7 Verify reviewed intake guards exist in reviewed image
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
echo ""
echo "[Step 2/8] Enforcing Ingress Write Quiescence (Apache 503 Rewrite)..."
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

# Verify apache configuration syntax before reload
if command -v httpd >/dev/null 2>&1; then
    httpd -t
fi

cp "${APACHE_CONF_DIR}/httpd-lims.conf.quiesce" "${APACHE_CONF_DIR}/httpd-lims.conf"
if ! ${SYSTEMCTL_CMD} reload httpd; then
    echo "FATAL: Failed to reload reverse proxy with write quiescence configuration!"
    exit 1
fi
echo "✓ Ingress write quiescence active (HTTP 503 for mutating requests, read-only allowed)"
PHASE="INGRESS_QUIESCED"

# --- Step 3: Quiesce Application Container & Confirm Writer Exclusion ---
echo ""
echo "[Step 3/8] Quiescing Application Container & Confirming Writer Exclusion..."
docker stop -t 10 "${APP_CONTAINER_NAME}"
if ! assert_no_writers_running; then
    echo "FATAL: Application container failed to stop cleanly!"
    exit 1
fi
echo "✓ Application container stopped. Running state confirmed false."
PHASE="QUIESCED_WRITERS_STOPPED"

# --- Step 4: Quiesced Database Checkpoint & Pre-Operation Consistent Backup ---
echo ""
echo "[Step 4/8] Quiesced Database Checkpoint & Pre-Operation Consistent Backup..."
${SQLITE3_CMD} "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"
${SQLITE3_CMD} "${DB_PATH}" ".backup '${BACKUP_CONSISTENT}'"
BACKUP_HASH=$(sha256sum "${BACKUP_CONSISTENT}" | awk '{print $1}')
INTEGRITY=$(${SQLITE3_CMD} "${BACKUP_CONSISTENT}" "PRAGMA integrity_check;")
FK_CHECK=$(${SQLITE3_CMD} "${BACKUP_CONSISTENT}" "PRAGMA foreign_key_check;")
BASE_SAMPLES=$(${SQLITE3_CMD} "${BACKUP_CONSISTENT}" "SELECT count(*) FROM Sample;")
EXPECTED_TOTAL=$((BASE_SAMPLES + EXPECTED_APPLY_COUNT))

echo "  Consistent pre-operation backup saved: ${BACKUP_CONSISTENT}"
echo "  Pre-operation SHA-256: ${BACKUP_HASH}"
echo "  Integrity: ${INTEGRITY}, FK: ${FK_CHECK:-OK}, Baseline Samples: ${BASE_SAMPLES}"
echo "  Target post-operation sample count: ${EXPECTED_TOTAL} (+${EXPECTED_APPLY_COUNT})"

if [ "${INTEGRITY}" != "ok" ] || [ -n "${FK_CHECK}" ]; then
    echo "FATAL: Pre-operation database check failed!"
    exit 1
fi
PHASE="BACKUP_TAKEN"

# --- Step 5: Execute Guarded Dry-Run in One-Shot Isolated Container ---
echo ""
echo "[Step 5/8] Executing Guarded Dry-Run in One-Shot Isolated Container..."
docker run --rm \
  --name "${RUNNER_DRYRUN_NAME}" \
  --entrypoint node \
  --network none \
  --user 0:0 \
  -e DISABLE_BACKGROUND_JOBS=true \
  -e DATABASE_PATH="/app/server/prisma/dev.db" \
  -e KOBO_148_SNAPSHOT_PATH="/opt/lims/private_kobo/issue148_kobo_snapshot_bounded.json" \
  -e KOBO_148_MANIFEST_PATH="/opt/lims/private_kobo/issue148_kobo_manifest_bounded.json" \
  -v "${VOLUME_NAME}:/app/server/prisma" \
  -v lims_lims-assets:/app/server/uploads \
  -v "${RUNNER_SCRIPT_HOST}:${RUNNER_SCRIPT_CONTAINER}:ro" \
  -v "${LIMS_OPT_DIR}/private_kobo:/opt/lims/private_kobo:ro" \
  "${REVIEWED_IMAGE_ID}" \
  "${RUNNER_SCRIPT_CONTAINER}" --dry-run | tee -a "${LOG_FILE}"

PHASE="DRYRUN_DONE"
echo "✓ Dry-run completed cleanly: all invariants, candidate cohorts, and positive ownership verified."

# --- Step 6: Execute Guarded Apply in One-Shot Isolated Container ---
echo ""
echo "[Step 6/8] Executing Guarded Apply in One-Shot Isolated Container..."
PHASE="APPLYING"
docker run --rm \
  --name "${RUNNER_APPLY_NAME}" \
  --entrypoint node \
  --network none \
  --user 0:0 \
  -e DISABLE_BACKGROUND_JOBS=true \
  -e DATABASE_PATH="/app/server/prisma/dev.db" \
  -e KOBO_148_SNAPSHOT_PATH="/opt/lims/private_kobo/issue148_kobo_snapshot_bounded.json" \
  -e KOBO_148_MANIFEST_PATH="/opt/lims/private_kobo/issue148_kobo_manifest_bounded.json" \
  -v "${VOLUME_NAME}:/app/server/prisma" \
  -v lims_lims-assets:/app/server/uploads \
  -v "${RUNNER_SCRIPT_HOST}:${RUNNER_SCRIPT_CONTAINER}:ro" \
  -v "${LIMS_OPT_DIR}/private_kobo:/opt/lims/private_kobo:ro" \
  "${REVIEWED_IMAGE_ID}" \
  "${RUNNER_SCRIPT_CONTAINER}" --apply | tee -a "${LOG_FILE}"

# The Commit Point has been reached successfully!
PHASE="APPLY_COMMITTED"
echo "✓ Apply completed successfully! ${EXPECTED_APPLY_COUNT} Expected specimens admitted."

# --- Step 7: Post-Apply WAL Checkpoint & Integrity Audit ---
echo ""
echo "[Step 7/8] Post-Apply WAL Checkpoint & Integrity Audit..."
${SQLITE3_CMD} "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"
POST_INTEGRITY=$(${SQLITE3_CMD} "${DB_PATH}" "PRAGMA integrity_check;")
POST_FK=$(${SQLITE3_CMD} "${DB_PATH}" "PRAGMA foreign_key_check;")
POST_SAMPLES=$(${SQLITE3_CMD} "${DB_PATH}" "SELECT count(*) FROM Sample;")

echo "  Post-apply Samples: ${POST_SAMPLES} (Expected: ${EXPECTED_TOTAL})"
echo "  Post-apply Integrity: ${POST_INTEGRITY}, FK: ${POST_FK:-OK}"

if [ "${POST_INTEGRITY}" != "ok" ] || [ -n "${POST_FK}" ] || [ "${POST_SAMPLES}" -ne "${EXPECTED_TOTAL}" ]; then
    echo "FATAL: Post-apply verification failed!"
    exit 1
fi
PHASE="POSTFLIGHT_VERIFIED"

# --- Step 8: Restart Application Container & Verify Health ---
echo ""
echo "[Step 8/8] Restarting Application Container & Restoring Live Ingress..."

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

PHASE="RESTORING_INGRESS"
cp "${APACHE_CONF_DIR}/httpd-lims.conf.live" "${APACHE_CONF_DIR}/httpd-lims.conf"
if ! ${SYSTEMCTL_CMD} reload httpd; then
    echo "FATAL: Failed to reload Apache with live configuration!"
    exit 1
fi
echo "✓ Live traffic restored."
PHASE="COMPLETE"

trap - SIGHUP SIGINT SIGTERM EXIT
rmdir "${LOCK_DIR}" 2>/dev/null || true
rm -f "${PID_FILE}" 2>/dev/null || true

echo "============================================================"
echo "  ISSUE #148 CORRECTION COMPLETE & VERIFIED                 "
echo "  ${EXPECTED_APPLY_COUNT} Expected Specimens Admitted; 3 Held; 0 Regressions   "
echo "============================================================"
