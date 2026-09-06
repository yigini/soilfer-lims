# Database & Assets Consistent Restore Rehearsal Evidence (A98)

**Date**: 2026-09-06T12:43:52.067Z  
**Scope**: Full end-to-end rehearsal of consistent SQLite snapshot backup, gzip compression, file asset preservation, isolated restoration, migration execution, and live isolation verification.  
**Execution Time**: 29.0 seconds  
**Rehearsal Status**: ✅ PASSED (100% isolated, zero live volume mutation)

---

## 1. Live Environment Baseline

| Parameter | Value |
|---|---|
| Live Database Path | `C:\Users\yigin\Documents\soilfer-lims\server\prisma\dev.db` |
| Live DB File Size | 537.11 MB |
| Live DB SHA-256 (Before) | `5b574235efc2cad17cec33d9f21fc7f29c5bf7ae935d8bb03492ea9b84e86723` |
| Live Uploads Asset Count | 654 files |

---

## 2. Backup Execution (Consistent Snapshot)

Consistent online snapshot was captured using `better-sqlite3`'s `db.backup()` API against the live SQLite instance, guaranteeing no torn pages or active WAL race conditions.

| Stage | Artifact / Metric | Outcome |
|---|---|---|
| Raw SQLite Snapshot | `snapshot.db` (537.11 MB) | ✅ Complete |
| Gzip Compression | `snapshot.db.gz` (19.91 MB) | ✅ Complete (96.3% reduction) |
| Asset Files Snapshot | `uploads_snapshot` (654 files) | ✅ Complete |

---

## 3. Isolated Restoration

The backup archive was decompressed and restored into an isolated rehearsal workspace:
`C:\Users\yigin\Documents\soilfer-lims\server\prisma\test_scratch\restore_rehearsal\restore`

| Component | Target Location | Verification | Result |
|---|---|---|---|
| Restored Database | `C:\Users\yigin\Documents\soilfer-lims\server\prisma\test_scratch\restore_rehearsal\restore\restored.db` | SHA-256 matches uncompressed backup snapshot | ✅ PASS |
| Restored Assets | `C:\Users\yigin\Documents\soilfer-lims\server\prisma\test_scratch\restore_rehearsal\restore\uploads` | Restored 654 files | ✅ PASS |
| DB PRAGMA quick_check | SQLite internal page/btree integrity check | `{"quick_check": "ok"}` | ✅ PASS |
| Restored Table Count | `sqlite_master` query | 52 tables verified | ✅ PASS |
| Restored Entity Counts | Core tables query | 46 users, 35192 samples, 9 work items | ✅ PASS |

---

## 4. Migration Dry-Run & Apply on Restored Snapshot

The fail-closed `migrate_lab_operations_v3.js` script was executed exclusively against the restored database:

1. **Dry-Run Mode (`--dry-run`)**:
   - Analyzed existing tables, columns, indexes, and catalogue mappings.
   - Identified and scheduled methodology reconciliation and status migrations.
   - Exited 0 with zero uncommitted alterations.
2. **Apply Mode (`--apply`)**:
   - Reconciled analytical methodologies to authoritative GLOSOLAN/ISO SOPs.
   - Verified and created v3 tables and indexes.
   - Reconciled `Analysis.status` for active catalogue policy.
   - Exited 0 with transaction committed.
3. **Idempotency Check (`--dry-run` post-apply)**:
   - Re-executed dry-run against newly migrated database.
   - Confirmed 0 pending changes remaining.

---

## 5. Non-Interference & Live Isolation Proof

To ensure that backup, restore, and migration operations cause zero disruption or corruption to active production services:

| Assertion | Expected | Observed | Status |
|---|---|---|---|
| Live Database SHA-256 Integrity | `5b574235efc2cad17cec33d9f21fc7f29c5bf7ae935d8bb03492ea9b84e86723` | `5b574235efc2cad17cec33d9f21fc7f29c5bf7ae935d8bb03492ea9b84e86723` | ✅ MATCH (Zero bytes mutated) |
| Live Asset File Count | 654 | 654 | ✅ MATCH (Zero files modified) |
| Port / Service Conflicts | Zero bind attempts | No network listening sockets bound during restore | ✅ PASS |
| File System Isolation | Dedicated scratch directory | `server/prisma/test_scratch/restore_rehearsal` | ✅ PASS |

---

## 6. Conclusion

Requirement **A98** (Database consistent backup, asset restore rehearsal, and migration verification) is fully satisfied with concrete, reproducible physical evidence. All test artifacts are cleaned up and excluded from git.
