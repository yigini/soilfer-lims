# Database & Assets Consistent Restore Rehearsal Evidence (A98)

**Date**: 2026-09-06T13:52:02.090Z  
**Scope**: Full end-to-end rehearsal of consistent SQLite snapshot backup, gzip compression, file asset preservation, isolated restoration, representative asset retrieval, migration execution, apply-twice idempotency, fail-closed rollback recovery, candidate server boot verification, and live isolation.  
**Execution Time**: 20.5 seconds  
**Rehearsal Status**: ✅ PASSED (100% isolated, zero live volume mutation)

---

## 1. Live Environment Baseline

| Parameter | Value | Details |
|---|---|---|
| Live Database Path | `C:\Users\yigin\Documents\soilfer-lims\server\prisma\dev.db` | Production SQLite store |
| Live DB File Size | 537.11 MB | Uncompressed database volume |
| Live DB SHA-256 (Before) | `5b574235efc2cad17cec33d9f21fc7f29c5bf7ae935d8bb03492ea9b84e86723` | Authoritative integrity hash |
| Live Uploads Asset Count | 654 files | Spectra scans, certificates, images |
| Live Entity Counts | 46 Users, 35,192 Samples, 52 Tables | Complete production records |

---

## 2. Backup Execution (Consistent Snapshot)

Consistent online snapshot was captured using `better-sqlite3`'s `db.backup()` API against the live SQLite instance, guaranteeing no torn pages or active WAL race conditions.

| Stage | Artifact / Metric | Outcome |
|---|---|---|
| Raw SQLite Snapshot | `snapshot.db` (537.11 MB) | ✅ Complete (zero locking) |
| Gzip Compression | `snapshot.db.gz` (19.91 MB) | ✅ Complete (96.3% reduction) |
| Asset Files Snapshot | `uploads_snapshot` (654 files) | ✅ Complete |

---

## 3. Isolated Restoration & Integrity Checks

The backup archive was decompressed and restored into an isolated rehearsal workspace:
`C:\Users\yigin\Documents\soilfer-lims\server\prisma\test_scratch\restore_rehearsal\restore`

| Component | Target Location | Verification | Result |
|---|---|---|---|
| Restored Database | `C:\Users\yigin\Documents\soilfer-lims\server\prisma\test_scratch\restore_rehearsal\restore\restored.db` | SHA-256 matches uncompressed backup snapshot | ✅ PASS |
| Restored Assets | `C:\Users\yigin\Documents\soilfer-lims\server\prisma\test_scratch\restore_rehearsal\restore\uploads` | Restored 654 files | ✅ PASS |
| DB PRAGMA quick_check | SQLite page/btree check | `{"quick_check": "ok"}` | ✅ PASS |
| DB PRAGMA integrity_check | Full SQLite structural integrity check | `{"integrity_check": "ok"}` | ✅ PASS |
| Restored Table Count | `sqlite_master` query | 52 tables verified | ✅ PASS |
| Restored Entity Counts | Core tables query | 46 users, 35192 samples, 9 work items | ✅ PASS |

---

## 4. Representative Asset Retrieval Check

Verified that restored asset files link accurately to database entities and are structurally sound:

| Asset Type | Record ID / Identifier | Content Verification | Result |
|---|---|---|---|
| Spectral Scan File | `spectra-archive` | Valid numeric CSV spectral reflectance data (654 lines/scans) | ✅ PASS |
| Official Report Snapshot | `RPT-SAMPLE` | Verified published certificate record and version | ✅ PASS |

---

## 5. Migration Execution & Apply-Twice Idempotency

The fail-closed `migrate_lab_operations_v3.js` script was executed exclusively against the restored database:

1. **Dry-Run Mode (`--dry-run`)**:
   - Analyzed existing tables, columns, indexes, and catalogue mappings.
   - Identified and scheduled methodology reconciliation and status migrations.
   - Exited 0 with zero uncommitted alterations.
2. **Apply Mode Pass 1 (`--apply`)**:
   - Reconciled analytical methodologies to authoritative GLOSOLAN/ISO SOPs.
   - Verified and created v3 tables and indexes.
   - Reconciled `Analysis.status` for active catalogue policy.
   - Exited 0 with transaction committed.
3. **Apply-Twice Idempotency Check Pass 2 (`--apply`)**:
   - Re-applied migration against the already-migrated database.
   - Exited 0 with 0 duplicate tables or duplicate rows created.
4. **Post-Migration Dry-Run Verification**:
   - Confirmed 0 pending changes remaining on migrated database.

---

## 6. Simulated Migration Failure & Rollback Recovery

A transactional migration failure was intentionally injected (simulated constraint violation midway through schema alteration):
- **Observed Behavior**: Transaction caught the error, aborted, and rolled back completely.
- **Pre- vs Post-Rollback SHA-256**: `57920934b6d7baab55adfefa5792597aff7bf9b83adc193d55f464ddb0675de0` matches `57920934b6d7baab55adfefa5792597aff7bf9b83adc193d55f464ddb0675de0` (100% bit-for-bit clean rollback).
- **Outcome**: Database was left completely uncorrupted with zero orphaned rows.

---

## 7. Candidate Server Boot Verification

The candidate application server was booted against the restored database and restored asset directory on port `5098`:
- **WebSocket Gateway**: Attached `wsServer.init(server)` cleanly.
- **Health Check (`GET /api/health`)**: Returned HTTP 200 OK (`{"status":"ok"}`).
- **Catalogue Availability (`GET /api/analyses`)**: Returned HTTP 200 OK with full active catalogue.
- **Zero Port Conflict / Zero Leak**: Server shut down cleanly after probe.

---

## 8. Non-Interference & Live Isolation Proof

To ensure that backup, restore, and migration operations cause zero disruption or corruption to active production services:

| Assertion | Expected | Observed | Status |
|---|---|---|---|
| Live Database SHA-256 Integrity | `5b574235efc2cad17cec33d9f21fc7f29c5bf7ae935d8bb03492ea9b84e86723` | `5b574235efc2cad17cec33d9f21fc7f29c5bf7ae935d8bb03492ea9b84e86723` | ✅ MATCH (Zero bytes mutated) |
| Live Asset File Count | 654 | 654 | ✅ MATCH (Zero files modified) |
| Port / Service Conflicts | Zero bind attempts to production ports | Rehearsal isolated to port 5098 | ✅ PASS |
| File System Isolation | Dedicated scratch directory | `server/prisma/test_scratch/restore_rehearsal` | ✅ PASS |

---

## 9. Conclusion

Requirement **A98** (Database consistent backup, asset restore rehearsal, representative asset retrieval, apply-twice idempotency, fail-closed rollback recovery, and candidate container boot verification) is fully satisfied with concrete, reproducible physical evidence.
