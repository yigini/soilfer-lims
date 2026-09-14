# Production Database Reconciliation Read-Only Dry-Run Report (Issue #103)

**Date**: 14 September 2026  
**Auditor / Implementer**: Antigravity Pair-Programming Assistant  
**Target Environment**: Production Host VPS `46.19.33.37` (`soilfer-lims:v3.5.7-37521e5`)  
**Execution Command**: `docker exec soilfer-lims node server/scripts/reconcile_projects.js --dry-run`  
**Mode**: Read-Only Dry-Run (Zero database mutations)  
**Tracked Issue**: Issue #103: *DATA: Production database project-lab junction reconciliation dry-run review (A16)*

---

## 1. Executive Summary

In accordance with Acceptance Criterion A16 (`04-acceptance-and-release.md`) and tracked issue #103, a read-only reconciliation dry-run was executed against the production database on VPS `46.19.33.37`. 

The reconciliation policy strictly enforces:
1. **No Grant Expansion**: Never automatically union legacy JSON arrays with junction records where authority is ambiguous.
2. **No Inferred Country Grants**: Never infer laboratory servicing grants from country codes (`Project.countries`).
3. **No Unilateral Owner Resolution**: Missing coordinating owner laboratories (`labId: null`) are flagged for human operational review and kept unresolved rather than guessed.
4. **Zero Mutation Guarantee**: Read-only execution verifies discrepancies without modifying a single row.

---

## 2. Exact Reconciliation Dry-Run Output

```
[PRISMA] Using better-sqlite3 adapter — DB: /app/server/prisma/dev.db
======================================================================
  PROJECT MEMBERSHIP RECONCILIATION TOOL
  Mode: DRY-RUN (Read-only)
======================================================================

Found 4 project(s) to inspect.

[!] Project SOILFER-JPN — 2 issue(s) [10237 sample(s)]
    - MISSING_OWNER_CONFLICT:  -> Project has no coordinating owner laboratory. Flagged for review.
    - UNMIGRATED_LEGACY_SERVICING_LABS: MOZ-LAB1, TUN-LAB1 -> Migrate legacy assignedLabIds to ProjectLab junction records
    --> [ATTENTION] Kept unresolved per governance policy.
[!] Project SOILFER-US — 2 issue(s) [26619 sample(s)]
    - MISSING_OWNER_CONFLICT:  -> Project has no coordinating owner laboratory. Flagged for review.
    - UNMIGRATED_LEGACY_SERVICING_LABS: GTM-LAB1, HND-LAB1, GHA-LAB1, KEN-LAB1, ZMB-LAB1 -> Migrate legacy assignedLabIds to ProjectLab junction records
    --> [ATTENTION] Kept unresolved per governance policy.
[!] Project TEST — 1 issue(s) [10 sample(s)]
    - OWNER_LAB_NOT_IN_JUNCTION: GTM-LAB1 -> Insert owner ProjectLab record with role OWNER

======================================================================
  RECONCILIATION SUMMARY
  Total Projects Scanned: 4
  Projects with Discrepancies: 3
  Unresolved Ambiguities/Country-only: 2
  Action: Dry-run only. No database modifications made.
  To apply unambiguous fixes, rerun with --apply
======================================================================
```

---

## 3. Discrepancy & Ambiguity Details per Project

### 3.1 Project `SOILFER-JPN`
- **Sample Count**: 10,237 samples
- **Current State**:
  - `labId`: `null` (Central multi-national project without a single national owner laboratory)
  - Legacy `assignedLabIds`: `["MOZ-LAB1", "TUN-LAB1"]`
  - `ProjectLab` Junctions: 0 records
- **Identified Issues**:
  1. `MISSING_OWNER_CONFLICT`: The reconciliation tool flagged `labId: null`. Under central multi-lab governance, international programs do not have a single national laboratory owner; administrator creation permits `labId: null`.
  2. `UNMIGRATED_LEGACY_SERVICING_LABS`: Legacy servicing assignments exist in JSON format (`["MOZ-LAB1", "TUN-LAB1"]`).
- **Governance Disposition**: **KEPT UNRESOLVED (ISSUE #103 REMAINS OPEN)**. No owner is guessed or assigned. The business decision of whether central multi-lab projects should have servicing-only junction records without an `OWNER` role, or whether a global coordination entity is introduced, requires administrative governance alignment.

### 3.2 Project `SOILFER-US`
- **Sample Count**: 26,619 samples
- **Current State**:
  - `labId`: `null` (Central multi-national project without a single national owner laboratory)
  - Legacy `assignedLabIds`: `["GTM-LAB1", "HND-LAB1", "GHA-LAB1", "KEN-LAB1", "ZMB-LAB1"]`
  - `ProjectLab` Junctions: 0 records
- **Identified Issues**:
  1. `MISSING_OWNER_CONFLICT`: Flagged `labId: null`. Central governance allows multi-lab projects without single national lab ownership.
  2. `UNMIGRATED_LEGACY_SERVICING_LABS`: 5 servicing facilities exist in legacy JSON format.
- **Governance Disposition**: **KEPT UNRESOLVED (ISSUE #103 REMAINS OPEN)**. In accordance with strict boundary honesty, no national lab is guessed or prescribed as owner. Servicing lab migration awaits administrative policy definition for central multi-lab projects.

### 3.3 Project `TEST`
- **Sample Count**: 10 samples
- **Current State**:
  - `labId`: `"GTM-LAB1"` (Explicit owner lab assigned on project record)
  - `ProjectLab` Junctions: 0 records
- **Identified Issues**:
  - `OWNER_LAB_NOT_IN_JUNCTION`: Owner lab `GTM-LAB1` is recorded on `Project.labId`, but missing corresponding `ProjectLab` junction row (`role = 'OWNER'`).
- **Governance Disposition**: **UNAMBIGUOUS CANDIDATE**. Can be reconciled by inserting the owner junction record once administrative sign-off is provided.

### 3.4 Project `SoilFER-USA`
- **Sample Count**: 4 samples
- **Current State**:
  - `labId`: `"GTM-LAB1"`
  - `ProjectLab` Junctions: Fully populated (`role = 'OWNER'`, `role = 'SERVICING'`)
- **Identified Issues**: 0 issues. 100% reconciled.

---

## 4. Human Decision Register for Administrative Review (Issue #103)

| Project Code | Affected Samples | Current Architectural Reality | Decision Required from Platform Administration | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`SOILFER-JPN`** | 10,237 | `labId: null`, 2 servicing labs (`MOZ-LAB1`, `TUN-LAB1`). Central international program. | Determine junction policy for central multi-lab projects: allow servicing-only `ProjectLab` records without an `OWNER` row, or retain legacy JSON representation until central entity schema is defined. Do not force an arbitrary national lab as owner. | **OPEN (#103)** |
| **`SOILFER-US`** | 26,619 | `labId: null`, 5 servicing labs (`GTM-LAB1`, `HND-LAB1`, etc.). Central international program. | Determine junction policy for central multi-lab projects: allow servicing-only `ProjectLab` records without an `OWNER` row, or retain legacy JSON representation. | **OPEN (#103)** |
| **`TEST`** | 10 | Explicit owner `GTM-LAB1` present on `Project.labId`. | Approve insertion of single `ProjectLab` record (`role = 'OWNER'`, `labId = 'GTM-LAB1'`). | **PENDING ADMIN WINDOW** |

---

## 5. Database Safety Invariant

- **Pre-Dry-Run Sample Count**: 36,870
- **Post-Dry-Run Sample Count**: 36,870 (100% intact, 0 mutations)
- **PRAGMA quick_check**: `ok`
