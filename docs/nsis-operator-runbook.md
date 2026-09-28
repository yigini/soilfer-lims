# SoilFER-LIMS Operator Runbook: NSIS Data Exchange Gateway

**System:** SoilFER Laboratory Information Management System (SoilFER-LIMS)  
**Component:** Data Exchange Gateway (V1 & V2)  
**Authoritative Reference:** GitHub Issue [#140](https://github.com/yigini/soilfer-lims/issues/140)  
**Target Audience:** LIMS Platform Administrators, National Soil Data Managers, DevOps Engineers  

---

## 1. Overview & Operational Responsibilities

The SoilFER-LIMS Data Exchange Gateway provides machine-to-machine integration with National Soil Information Systems (NSIS), FAO OpenNSIS instances, and Global Soil Data Portals.

As an operator, your primary responsibilities are:
1. **Ensuring Fail-Closed Security:** Never issue an integration API key without an explicit, validated list of authorized laboratories.
2. **Preserving Laboratory Autonomy:** Ingestion failures, mapping differences, or synchronization delays in external NSIS instances must **never** block or alter analytical workflows inside the physical testing laboratories.
3. **Monitoring Exchange Health:** Review active keys, delivery receipts, snapshot TTLs, and cursor expirations.

---

## 2. API Key Management & Provisioning

### 2.1 Generating a New Integration Key

1. Log into SoilFER-LIMS as a `SUPER_ADMIN`.
2. Navigate to **Admin Panel** > **Data Exchange Keys** (or access `/admin/api-keys`).
3. Click **"Generate API Key"**.
4. Complete the provisioning form:
   - **Integration Name / Consumer Label:** Enter a descriptive identifier indicating the consumer agency and environment (e.g. `Kenya National Soil Database (Production Node)`).
   - **Access Role:**
     - `NSIS_CONSUMER`: Standard consumer receiving approved specimens, lossless observations, and spectral records.
     - `EXTERNAL_GIS`: Restricted consumer receiving RFC 7946 GeoJSON spatial features.
     - `GLOBAL_HARVESTER`: Global portal harvester (e.g., FAO Global Soil Partnership).
   - **Territorial Country Scope:** Select the permitted ISO countries (e.g., `KEN`, `ZMB`, `GTM`). Default to specific countries rather than wildcard `*` unless provisioning a global harvester.
   - **Authorized Laboratory Scope (CRITICAL):**
     > [!IMPORTANT]
     > Every key **must** have at least one authorized laboratory explicitly checked. If no laboratory is checked, the system enforces a fail-closed policy (`status: 200` with 0 records, or `403 Forbidden`).
     > Check only the laboratories that the national consumer is legally authorized to harvest.
   - **Key Expiration:** Set a prudent expiration period (default: 365 days).
5. Click **"Generate Secret Key"**.
6. **Securely Copy Secret Key:**
   The full plaintext secret key (prefixed with `slims_live_`) is displayed **once**. Provide this key to the external SIS administrator via secure credentials vault.

### 2.2 Rotating an API Key (Operation-Bound Lifecycle & Bounded Overlap)

To rotate an existing integration key without downtime or stranding credentials:
1. Locate the active key in the **Managed Keys** table in SoilFER-LIMS.
2. Click the **Rotate API Key** (refresh) icon in the actions column (or call `POST /api/v1/data-exchange/keys/:id/rotate` with an optional `Idempotency-Key` header).
3. Securely copy the one-time replacement secret and deliver it to the external SIS consumer.
4. **Bounded Overlap Window:**
   - The prior key transitions to `ROTATING` status and remains functional for a bounded grace window (nominal 24 hours), preventing outages if rotation response delivery is interrupted.
   - The UI displays an amber `Rotating (Grace Period)` badge.
5. **Automatic Retirement on Verification:**
   - As soon as the external SIS consumer sends its first authenticated request using the replacement key, SoilFER-LIMS automatically and atomically retires the bound old key (`RETIRED`, `isActive: false`).
   - Sibling keys on the same connection remain completely unaffected.
6. **Manual Operator Controls (Confirm / Abort):**
   - **Confirm Rotation (`POST /api/v1/data-exchange/keys/:id/confirm-rotation`):** Click the green checkmark icon to immediately retire the prior rotating key and finalize the replacement credential.
   - **Abort Rotation (`POST /api/v1/data-exchange/keys/:id/abort-rotation`):** Click the rollback counter-clockwise arrow icon to abort an unconfirmed rotation. The prior key is restored to `ACTIVE` and the unconfirmed replacement key is revoked (`REVOKED`). Pre-existing independent sibling keys are never affected.
7. **Authoritative Revocation & Monotonic Preconditions:**
   - **Explicit Revocation is Authoritative & Irreversible:** Explicit revocation immediately denies consumer access (HTTP 401). Subsequent calls to `confirm-rotation` or `abort-rotation` cannot resurrect revoked credentials.
   - **Atomic Confirm Preconditions:** Confirming a rotation strictly requires that the replacement key is currently active (`isActive = 1`, `key_status = 'ACTIVE'`) and unexpired. If the replacement key was explicitly revoked, the server rejects confirmation with HTTP 409 (`code: KEY_REVOKED`). If expired, it returns HTTP 409 (`code: KEY_EXPIRED`).
   - **Atomic Abort Preconditions:** Aborting a rotation strictly requires that the original key is still in rotating state (`isActive = 1`, `key_status = 'ROTATING'`), unexpired, and within the 24-hour overlap grace window. If the original key was revoked, the server rejects abortion with HTTP 409 (`code: KEY_REVOKED`). If expired or outside grace period, it returns HTTP 409 (`code: KEY_EXPIRED` or `code: ROTATION_EXPIRED`).
   - **Operation Boundary Enforcement:** If no active rotation operation is found for the specified key, requests fail with HTTP 404 (`ROTATION_NOT_FOUND`) rather than silently mutating unrotated keys.

---

## 3. Verifying Gateway Health & Capabilities

### 3.1 Verifying Live Capabilities
From any machine with network access to the LIMS server, run:
```bash
curl -s -X GET "https://<lims-domain>/api/v2/data-exchange/capabilities" | jq .
```

Verify that the response returns:
- `contractVersion: "2.0.0"`
- `schemaVersion: "2026-09-issue140-v2"`
- `supportedProfiles: ["opennsis", "glosis", "default"]`

### 3.2 Running the Standalone Reference Client Verification
SoilFER-LIMS includes an automated reference client that tests all 10 exchange contracts:
```bash
cd server
node scripts/data_exchange_reference_client.cjs --verify
```
A clean run outputs:
```
[PASS] Capabilities (unauthenticated): status=200, schema=2026-09-issue140-v2
[PASS] Capabilities (authenticated): schema=2026-09-issue140-v2, contract=2.0.0
[PASS] Stats: totalSamples=...
[PASS] Samples: count=...
[PASS] Observations: count=...
[PASS] Spatial GeoJSON: features=..., RFC 7946 compliant
[PASS] Snapshots created: id=snap_...
[PASS] Snapshot Pages: items=...
[PASS] Change Feed: events=...
[PASS] Delivery Receipts: id=rec_..., status=ACKNOWLEDGED
All 10 Reference Client verification checks passed successfully against in-process app.
```

---

## 4. Troubleshooting Common Operator Issues

### Issue 1: External Consumer Receives Empty Array (`data: []`)
- **Cause A: Scoping Mismatch (IR-14)**: Check if the key's authorized laboratory scope matches the assigned laboratories of the samples. If the key was created without selecting any laboratory, fail-closed policy returns zero records.
- **Cause B: Publication Lifecycle Invariant**: External consumers strictly receive samples in `APPROVED` or `RELEASED` status. If samples are in `RECEIVED`, `PROCESSING`, or `REVIEW`, they are excluded by design until final laboratory approval.
- **Resolution**: In **Active API Keys**, inspect the key's `labs` scope. If empty, revoke the key and re-issue with explicit laboratory scopes.

### Issue 2: Consumer Receives HTTP 410 `CURSOR_EXPIRED`
- **Cause**: The consumer's continuous synchronization cursor is malformed, from an incompatible schema version, or points to records that have been pruned.
- **Resolution**:
  1. The consumer should create a fresh snapshot via `POST /api/v2/data-exchange/snapshots`.
  2. Harvest the snapshot pages to re-baseline.
  3. Resume continuous sync from the snapshot's final boundary cursor.

### Issue 3: OpenNSIS Ingestion Rejects Samples Without Laboratory Identifiers
- **Cause**: OpenNSIS requires genuine laboratory accession identifiers (`labSampleId`) to map records into national accession registers.
- **Resolution**:
  Ensure the OpenNSIS harvester queries with `?profile=opennsis`. This profile automatically filters out specimens that lack a formal laboratory accession number (`labId IS NOT NULL`), preventing foreign key violations in the downstream OpenNSIS relational model.

---

## 5. Emergency Procedures

### Immediate Access Cut-Off
If an external consumer credential is leaked or compromised:
1. Open **Admin Panel** > **Active API Keys**.
2. Locate the compromised key and click **Revoke**.
3. All requests using that key are rejected immediately at the TLS gateway layer (HTTP 401).

### Database Storage Pruning
Durable exchange tables (`_exchange_snapshots`, `_exchange_receipts`, `_exchange_journal`) are stored in `server/prisma/dev.db`.
Snapshots automatically expire after 24 hours (TTL). To inspect snapshot storage:
```bash
sqlite3 server/prisma/dev.db "SELECT id, connection_id, total_items, created_at, expires_at FROM _exchange_snapshots;"
```
Expired snapshots can be cleaned up without affecting laboratory sample records:
```bash
sqlite3 server/prisma/dev.db "DELETE FROM _exchange_snapshots WHERE expires_at < datetime('now');"
```

---

## 6. Stopped-Writer Database Restore & Epoch Invalidation Procedure (R5, R10)

When restoring the SoilFER-LIMS database from a backup (e.g. disaster recovery, hardware migration, or test environment initialization), you **must** execute the stopped-writer epoch rotation before re-enabling external traffic. This ensures that a restored database incrementing an epoch can **never** reuse an already-issued generation, preventing replay of previously issued cursors or duplicate event processing.

### 6.1 Step-by-Step Recovery Protocol

1. **Stop Application Writers & Background Jobs:**
   Quiesce all incoming traffic by stopping the LIMS server process and background synchronization tasks:
   ```bash
   # Systemd / PM2 / Docker stop
   docker stop soilfer-lims-backend || systemctl stop soilfer-lims
   ```

2. **Restore Database File from Backup:**
   Restore the SQLite database file to its target path (e.g. `server/prisma/dev.db`):
   ```bash
   cp /path/to/backup/dev_backup_YYYYMMDD.db server/prisma/dev.db
   ```

3. **Execute Stopped-Writer Epoch Rotation:**
   Run the dedicated rotation utility while writers are stopped:
   ```bash
   node server/scripts/rotate_exchange_epoch.cjs --database server/prisma/dev.db --reason "DISASTER_RECOVERY_RESTORE"
   ```
   This generates an unrepeatable cryptographic nonce generation (e.g. `epoch-1790456789-a1b2c3`), updates `_exchange_meta`, and verifies trigger installation.

4. **Verify Database Integrity & High-Water Journal Sequence:**
   Run SQLite integrity checks to ensure the restored file is consistent:
   ```bash
   sqlite3 server/prisma/dev.db "PRAGMA integrity_check;"
   sqlite3 server/prisma/dev.db "SELECT MAX(sequence) FROM _exchange_journal;"
   ```

5. **Re-enable External Traffic & Start Server:**
   Restart the LIMS application server:
   ```bash
   docker start soilfer-lims-backend || systemctl start soilfer-lims
   ```

### 6.2 External Consumer Reconciliation Guidance

Following an epoch rotation:
- All cursors issued prior to the restore event carry the old epoch and will fail closed with HTTP 410 `CURSOR_EXPIRED` (`reason: 'EPOCH_MISMATCH'`).
- External consumers (OpenNSIS / harvesters) encountering HTTP 410 must execute their re-baseline protocol:
  1. Call `POST /api/v2/data-exchange/snapshots` to generate a fresh frozen snapshot.
  2. Ingest snapshot items to re-establish current state.
  3. Resume continuous sync from the snapshot's handoff cursor (`highWaterSequence`).
  4. Submit an authenticated delivery receipt via `POST /api/v2/data-exchange/receipts`.

