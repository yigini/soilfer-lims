# Laboratory Operations Redesign v3 — Final Verification & Acceptance Walkthrough

## Overview

This walkthrough documents the full verification, regression hardening, database restore rehearsal, and 40-sample browser acceptance testing for Laboratory Operations Redesign v3, fulfilling all criteria of [RELEASE-AND-GITHUB-INSTRUCTIONS.md](file:///C:/Users/yigin/Documents/soilfer-lims/WP/lab-operations-redesign-v3/RELEASE-AND-GITHUB-INSTRUCTIONS.md).

---

## 1. Summary of Changes & Problem Resolution

### 1.1. QC State Machine & Mutation Hardening (Reviews 4 & 5)
- **Problem (R4 & R5)**: 
  1. A technician could bypass QC by sending `{ "status": "QC_PASS" }` without evaluated QC measurements.
  2. Blank QC entries with `null` values converted to `0` and persisted as `QC_PASS`.
  3. Dedicated evaluation endpoint `POST /api/qc/batches/:id/evaluate` allowed mutating `CLOSED` batches.
  4. Emptying QC arrays retained `QC_PASS` status on the batch.
- **Resolution**:
  - `qcService.js`: Replaced permissive fallback with strict non-null, finite numeric validation for blanks, controls, and duplicates. Mandated all required QC components according to the applicable run profile.
  - `qcController.js`: Sealed batches in `CLOSED` status with HTTP 400 rejection across all evaluation and update routes. Reverted empty QC arrays to `OPEN` status. Restricted manual status overrides to managers with explicit disposition evidence.
  - `sampleController.js`: Enforced mandatory non-empty amendment reason strings across report amendment routes.
- **Evidence**:
  - `scratch/codex-qc-review-r5.cjs` passes with exit code 0.
  - `scratch/codex-release-review-r4.cjs` passes with exit code 0.
  - `server/tests/contracts/qc_batch_evaluation.test.js` (14/14 passed).

### 1.2. Catalogue Versioning & Tolerance Governance
- **Prisma Schema**: Added `version Int? @default(1)` to `Analysis` and `Methodology` in `server/prisma/schema.prisma`.
- **Analysis Controller**: Increments version monotonically on updates with before/after audit tracking.
- **Texture Validation**: Strictly requires named fraction objects `{ sand, silt, clay }` and unconfigured closure policy produces explicit `UNRESOLVED_CLOSURE_POLICY` rather than implicit scalar fallbacks.

---

## 2. Requirement A98: Database & Assets Restore Rehearsal

- **Evidence Document**: [WP/lab-operations-redesign-v3/restore-rehearsal-evidence.md](file:///C:/Users/yigin/Documents/soilfer-lims/WP/lab-operations-redesign-v3/restore-rehearsal-evidence.md)
- **Execution Script**: `tools/rehearsal/rehearse_restore_v3.cjs`
- **Rehearsal Scope & Results**:
  1. **Consistent Backup Snapshot**: Executed online SQLite backup API (`better-sqlite3` `db.backup()`) creating `snapshot.db` (537.11 MB uncompressed database volume), compressed with Gzip to `snapshot.db.gz` (19.91 MB, 96.3% reduction), plus 654 asset files.
  2. **Isolated Restoration**: Restored database and assets into an isolated scratch directory with zero live volume interaction.
  3. **Database Integrity**: Verified `PRAGMA quick_check` and `PRAGMA integrity_check` returned `ok`. Verified 52 tables, 46 users, 35,192 samples, 654 asset files intact.
  4. **Representative Asset Retrieval**: Verified spectral scans directory (654 scans) and report snapshots linking accurately to restored database records.
  5. **Migration Verification & Apply-Twice Idempotency**: Executed `migrate_lab_operations_v3.js` in dry-run mode (0 uncommitted alterations), applied migration (Pass 1), and re-applied migration (Pass 2, 0 duplicate records created; post-migration dry run confirmed 0 pending changes).
  6. **Simulated Failure & Rollback Recovery**: Injected simulated constraint violation midway through transactional execution; verified clean abort and 100% bit-for-bit pre- and post-rollback SHA-256 match.
  7. **Candidate Server Boot Verification**: Booted candidate server against restored database and assets on port 5098; verified WebSocket gateway attachment, `/api/health` HTTP 200, and 216 active catalogue analyses.
  8. **Live Volume Immutability**: Verified live database SHA-256 hash (`5b574235efc2cad17cec33d9f21fc7f29c5bf7ae935d8bb03492ea9b84e86723`) and 654 asset files were completely untouched before, during, and after rehearsal.

---

## 3. Requirement A99: 40-Sample Real On-Screen Browser UAT

- **Evidence Document**: [WP/lab-operations-redesign-v3/browser-uat-40-samples.md](file:///C:/Users/yigin/Documents/soilfer-lims/WP/lab-operations-redesign-v3/browser-uat-40-samples.md)
- **Structured JSON Evidence**: [WP/lab-operations-redesign-v3/browser-uat-40-samples.json](file:///C:/Users/yigin/Documents/soilfer-lims/WP/lab-operations-redesign-v3/browser-uat-40-samples.json)
- **Execution Engine**: Headless Chrome via Puppeteer Core on port 5059 against isolated scratch database.
- **Physical Capacity Model**: Dual-run allocation respecting `RACK_40` profile (max 36 samples, 4 reserved QC slots):
  - Run 1 (`batch-uat-run-01`): 36 samples (`UAT-SMP-001` through `036`).
  - Run 2 (`batch-uat-run-02`): 4 samples (`UAT-SMP-037` through `040`).

### Acceptance Gates Verification Summary (16/16 Passed)

| Gate | Name | Result | Scope & Observed Outcome |
|---|---|---|---|
| **1** | Profile Capacity Boundary Rejection | ✅ PASS | Attempting to allocate 37 samples to `RACK_40` rejected with HTTP 400 (`No available non-QC rack positions remaining`). |
| **2** | Multi-Run 40-Sample Allocation | ✅ PASS | Run 1 (36 samples) and Run 2 (4 samples) allocated cleanly with slot 1 reserved for `BLANK`. |
| **3** | Desktop Layout (1440x900) | ✅ PASS | Full desktop viewport rendered without tabular or header clipping. |
| **4** | Responsive Viewport (375x667) | ✅ PASS | Narrow mobile layout rendered cleanly without horizontal overflow or uncaught exceptions. |
| **5** | Method Switching via UI Controls | ✅ PASS | Switched `PH_H2O` from GLOSOLAN to `ISO_10390_H2O` on `/admin/methods` via select dropdown and Save Defaults button; persisted to DB. |
| **6** | Worksheet Decimal Data Entry | ✅ PASS | Typed 6.45 into `UAT-SMP-001` determination input with Enter key navigation to next row. |
| **7** | Batch Paste Modal Preview & Apply | ✅ PASS | Pasted tab-separated data for 34 samples, flagged 3 exclusions (2 duplicates, 1 unassigned), and applied 34 matched drafts. |
| **8** | Out-of-Bounds Range Validation | ✅ PASS | pH 99.0 flagged with `OUT_OF_RANGE` and blocked from completion. |
| **9** | Saved Draft Reload Persistence | ✅ PASS | Browser reloaded; all 40 draft determinations intact in DOM inputs. |
| **10** | Texture USDA Classification in UI | ✅ PASS | Sand 45 / Silt 35 / Clay 20 dynamically computed USDA Loam in the DOM. |
| **11** | Texture Closure Warning in UI | ✅ PASS | Sum 115% triggered on-screen closure warning banner. |
| **12** | Two-Step Recording & Submission Flow | ✅ PASS | Preflight review confirmed, determinations recorded atomically, and 40 samples submitted for review via `ReviewSubmissionView`. |
| **13** | QC Batch Evaluation & State Rules | ✅ PASS | Runs 1 and 2 passed QC evaluation to `QC_PASS`; technician attempt to close batch rejected with HTTP 403. |
| **14** | Manager Queue Review & Approval | ✅ PASS | Manager reviewed evidence in SampleDetail Review tab, accepted submitted results, and approved sample to `APPROVED`. |
| **15** | Mandatory Amendment Reason Enforcement | ✅ PASS | Empty amendment reason disabled "Record Amendment" button in modal; valid reason enabled button and persisted to DB. |
| **16** | Spectroscopy Interface Render | ✅ PASS | `/spectral-library` mounted cleanly with zero runtime exceptions. |

---

---

## 4. Requirement A100: Production Deployment & Live Read-Only Verification

- **Deployment Date**: 6 September 2026
- **Release Commit**: [`8a3f41b`](https://github.com/yigini/soilfer-lims/commit/8a3f41b) (merged via PR [#45](https://github.com/yigini/soilfer-lims/pull/45) into `main`)
- **Immutable Container Image**: `soilfer-lims:v3.0.0-8a3f41b` (`sha256:6ded9a94fc41456aad74a47012db10daa506249578b7c4855ffba72901d41725`)
- **Target Host**: Production VPS `root@46.19.33.37`
- **Pre-Cutover Coordinated Snapshot**: `/opt/lims/release_checkpoints/release_v3_8a3f41b_2026_09_06_14_1` (contains online SQLite backup snapshot `dev.db` and asset archive `assets.tar.gz`)
- **Migration Execution**:
  - Schema migration: `v3_lab_operations_20260906` applied at `2026-09-06 14:15:52`
  - Baseline Preservation Invariants (zero unexpected mutations):
    - **Samples**: 35,190 (zero mutation, 100% matched)
    - **Results**: 2 (zero mutation, 100% matched)
    - **Reports**: 0 (zero mutation, 100% matched)
    - **WorkItems**: 40 (3 unstarted fraction tasks consolidated into 1 unified TEXTURE work item)
    - **Active Analyses**: 208 active analyses (109 NULL status populated to 'active')
    - **Default Methodologies**: 181 standard default methodologies (38 synthetic placeholders quarantined to `isDefault = 0`)
  - Schema additions verified in SQLite:
    - `Analysis.version` (`INTEGER DEFAULT 1`)
    - `Methodology.version` (`INTEGER DEFAULT 1`)
    - `WorkItem.rackPosition` (`INTEGER`)
    - `Batch.maxCapacity` (`INTEGER DEFAULT 40`)
    - `Batch.profile` (`TEXT`)

### Live Read-Only Production Verification Receipts

1. **Docker Container Health**:
   - Container `soilfer-lims` running healthy on `0.0.0.0:3000->3000/tcp` with restart policy `unless-stopped`.
   - Healthcheck: `wget -q --spider http://localhost:3000/api/health` passing.
2. **Public / Unauthenticated Endpoints**:
   - `GET /api/health` -> HTTP 200 `{"status":"ok","uptime":88.99}`
   - `GET /api/public/i18n/bootstrap` -> HTTP 200 JSON with branding and supported languages.
   - `GET /` -> HTTP 200 index HTML with strict CSP and security headers.
3. **Multi-Role Scoped API Access Probes**:
   - **SUPER_ADMIN**:
     - `GET /api/config/analyses` -> HTTP 200 (216 analyses returned with version tracking)
     - `GET /api/config/methodologies` -> HTTP 200 (590 methodologies returned with version tracking)
   - **LAB_TECHNICIAN**:
     - `GET /api/workbench/queue` -> HTTP 200
     - `GET /api/qc/batches` -> HTTP 200
     - `GET /api/config/analyses` -> HTTP 200
   - **LAB_MANAGER**:
     - `GET /api/qc/batches` -> HTTP 200
     - `GET /api/samples?limit=3` -> HTTP 200
4. **Representative File & Asset Retrieval**:
   - `GET /uploads/spectra/spec-1788378128060-ume9b_alpha_mir_sample01_rep1.csv` -> HTTP 200 text/csv (70 bytes, ETag verified).

---

## 5. Requirements Ledger Status

All 100 requirements (**A01 through A100**) are now fully **`VERIFIED`** in both `WP/lab-operations-redesign-v3/requirements_ledger.md` and repository artifacts. The v3 release candidate is successfully integrated and operating in production.

