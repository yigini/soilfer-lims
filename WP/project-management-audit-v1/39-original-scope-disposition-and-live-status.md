# Original Scope Disposition & Live Deployment Status

**Date**: 14 September 2026  
**Auditor / Implementer**: Antigravity Pair-Programming Assistant  
**Live Release**: `soilfer-lims:v3.5.7-37521e5`  
**Live Host**: VPS `46.19.33.37` (`https://lims.yigini.net`)  
**Git Base**: `37521e5670cd44dc249c8e1367a16b01c142b462`

---

## 1. Production Release Status & Verified Backups

- **Deployed Container**: `soilfer-lims:v3.5.7-37521e5` (Container ID: `97916154e05a`, Status: `healthy`, Uptime: > 2 minutes).
- **Public Endpoints**:
  - `https://lims.yigini.net/api/health` -> `{"status":"ok","uptime":...}` (200 OK).
  - `https://lims.yigini.net/api/public/i18n/bootstrap` -> 200 OK (all 5 languages active).
- **Live Database State**:
  - Sample Count: **36,870 intact** (100% data preservation, 0 records lost).
  - Integrity Check: `PRAGMA quick_check = ok`.
- **Pre-Deploy Backups for Release 37521e5**:
  - Online Backup: `/opt/lims/backups/dev_predeploy_37521e5_online_20260914_065915.db` (`integrity_check = ok`, 36,870 samples).
  - Stopped Snapshot: `/opt/lims/backups/dev_predeploy_37521e5_stopped_20260914_065915.db` (`integrity_check = ok`, 36,870 samples).
- **Rollback Images Retained on VPS**:
  - `soilfer-lims:v3.5.7-a21ba17`
  - `soilfer-lims:v3.5.7-5047673`
  - `soilfer-lims:v3.5.7-5cf1d1b`
- **Local Database Invariant**:
  - `server/prisma/dev.db` SHA-256: `388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B` (100% byte-identical, 0 mutations).

---

## 2. Concrete Disposition of the Original Six Realistic Lab Journeys

| Journey | Focus | Concrete Executed Evidence | Disposition |
| :--- | :--- | :--- | :--- |
| **Journey 1** | Coordinator prepares shipment (40 samples) | `test_file_import_intake.cjs` & `project_governance_retry_preview.test.js`: HMAC preview token signing, conflict detection on existing IDs, leading zero retention (`000124`), manifest commit with idempotency key, and atomic database insertion. | **VERIFIED / AUTOMATED CONTRACT EXECUTION** |
| **Journey 2** | Intake officer receives batch | `workspace_projection_p2.test.js`: `POST /api/samples/:id/orders` applies revision atomically and records intake receipt. | **VERIFIED / CONTRACT EXECUTION** (Browser UI interactive execution tracked as unverified in full browser) |
| **Journey 3** | Technician processes soil samples | Analysis validation and numeric boundary check contracts pass in server suites. | **PARTIAL / UNVERIFIED IN BROWSER UI** (Full interactive walkthrough of `/workbench` drying, pH, texture grouping, and spectral curve upload is unverified in automated browser tests) |
| **Journey 4** | Manager handles exceptions & review | QA approval gating logic tested in contract suites. | **PARTIAL / UNVERIFIED IN BROWSER UI** (Full browser walkthrough of approval queue exceptions remains unverified in automated browser tests) |
| **Journey 5** | Owner removes a servicing lab | `test_lab_access_journey5.cjs` (15/15 steps passed) & `test_actual_app_ui.cjs` + `independent-37521e5-ui-state.cjs` (real Chromium browser tests: role checks, modal DOM, blocker navigation to `/projects/:id?tab=samples`, inactive member toggle, snapshot preservation). | **VERIFIED / FULLY EXECUTED & ACCEPTED** |
| **Journey 6** | Coordinator closes project | `project_governance_retry_preview.test.js` (idempotent pause/archive, receipt lookup, stale revision rejection) & `ProjectActionsModal.jsx` reason preservation. | **VERIFIED / CONTRACT & COMPONENT EXECUTION** |

---

## 3. Performance & Dataset Size Disposition

- **Clarification**: The original requirement specifies performance against a **production-scale dataset size** (36,870 samples across 100 projects), not concurrent load from 36,000 users.
- **Isolated SQLite Query Latency**:
  - Evaluated on an isolated 36,870-row production-scale fixture: p50 = 0.19ms, p95 = 0.21ms, p99 = 0.35ms.
- **Honest Boundary**: Raw SQLite query timing verifies database indexing and query planning at full 36k row scale. It does not measure end-to-end HTTP application endpoint turnaround under production network stack, which remains tracked as an unbenchmarked HTTP layer.

---

## 4. Tracked Open Issues

- **Issue #102**: *QA: Physical device smoke testing on iOS Safari and Android Chrome (PM-22)* — Mobile responsiveness at 390px and 320px verified via Chromium viewport emulation; physical touch devices remain unverified.
- **Issue #103**: *DATA: Production database project-lab junction reconciliation dry-run review (A16)* — Code capability dry-run verified idempotent on fixture; production database reconciliation remains open for administrative operational review.
