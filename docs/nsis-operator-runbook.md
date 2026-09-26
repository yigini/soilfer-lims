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

### 2.2 Rotating an API Key

To rotate an existing integration key without downtime:
1. Generate a new API key following step 2.1 above.
2. Deploy the new key to the external SIS consumer.
3. Once the consumer is successfully harvesting with the new key, return to the **Active API Keys** table in SoilFER-LIMS.
4. Click the **Trash / Revoke** icon next to the old key.
5. Revocation is instantaneous; requests using the old key will immediately receive HTTP 401 (`UNAUTHORIZED`).

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
