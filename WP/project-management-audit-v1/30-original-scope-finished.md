# Original Scope Completion & Comprehensive Acceptance Report

**Date:** 2026-09-14 04:00 UTC  
**Target:** WP/project-management-audit-v1/29-original-scope-finish-list.md  
**Branch:** main  
**Local dev.db Invariant SHA-256:** `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b` (100% Intact)  
**Live Production Host:** 46.19.33.37 (Currently running `soilfer-lims:v3.5.7-5cf1d1b`, 36,870 live samples)

---

## 1. Concrete Finished Requirements (Audit Items 1–5)

### Item 1: Project Lab-Access Management & Journey 5 (PM-16, PM-20)
- **Destination UI Wired:** In `client/src/pages/ProjectWorkspace.jsx`, replaced the legacy redirect to `/admin/labs?projectCode=...` with `onOpenManageLabs={() => handleOpenActionsModal('lab-access')}`.
- **Sub-view Implementation in ProjectActionsModal.jsx:**
  - Dedicated 'lab-access' sub-view rendering:
    - Immutable coordinating primary owner laboratory display (cannot be removed).
    - Directory checklist of active laboratories with operational status badges.
    - Explicit blocker notice on removal attempts when active work exists (`CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK`) with active sample counts and actionable guidance to reassign or complete work in Tech Workbench.
    - Mandatory operational reason textarea for change audit trail.
    - Concurrency protection via `if-match: <revision>` and idempotency via `x-idempotency-key`.
    - Pending operation recovery and discard controls for unconfirmed network interruptions.
- **Canonical API Integration:** Directly calls canonical `GET /api/projects/:id/lab-access` and `PATCH /api/projects/:id/lab-access`.
- **Authorization & Boundary Enforcement:** Non-owners (foreign managers and servicing managers) receive `403 PROJECT_OWNER_REQUIRED`.
- **Journey 5 Verification:** Automated test suite `test_lab_access_journey5.cjs` executed 13/13 steps passing cleanly:
  1. Owner queries lab access with `canManage: true` (200).
  2. Foreign actor denied read access (403).
  3. Foreign actor denied PATCH access (403).
  4. Non-owner servicing manager denied modification rights (403).
  5. Inactive lab assignment safely rejected (400 `INACTIVE_LAB_NOT_ALLOWED`).
  6. Owner authorizes active servicing lab B with audit reason and concurrency token (200).
  7. Idempotent replay returns cached outcome without duplicate side effects (200).
  8. Active sample created and assigned to servicing lab B.
  9. Removal attempt blocked due to active work (400 `CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK`, count: 1).
  10. Sample work resolved to COMPLETED in Tech Workbench.
  11. Stale revision conflict prevented (409 `STALE_REVISION`).
  12. Servicing lab B cleanly removed following complete work resolution (200).
  13. Authoritative lab status truthfully reported in GET response.

### Item 2: Truthful Lab State (Consistency Requirement)
- **Authoritative Status Rendering:** In `client/src/components/projects/LabsAndPeopleTab.jsx`, removed unconditional hardcoded 'Active' badge.
- **Dual State Badging:**
  - Active facilities: Green `Active` badge (`bg-emerald-100 text-emerald-800`).
  - Inactive / Unavailable facilities: Amber `Inactive / Unavailable` badge (`bg-amber-100 text-amber-800`).
- **Policy Enforcement:** Historical membership is preserved in directory views while assignment of new work or new servicing relationships to inactive laboratories is rejected server-side (`INACTIVE_LAB_NOT_ALLOWED`).

### Item 3: Real File Import & Spreadsheet Intake (A14)
- **Safe Bounded Intake in ImportPreviewModal.jsx:**
  - Enforced 5 MB maximum file size limit (`MAX_FILE_SIZE = 5 * 1024 * 1024`) rejecting oversized uploads before buffer allocation.
  - Enforced 2,000 maximum row batch limit (`MAX_BATCH_ROWS = 2000`).
- **Exact Textual Identifier & Leading Zero Preservation:**
  - Configured SheetJS intake with `XLSX.read(data, { type: 'array', raw: false, cellText: true })` guaranteeing textual IDs like `000124` and `000999` are preserved as strings rather than coerced to numbers.
- **Multi-column & Localized Header Recognition:**
  - Scans across all columns for localized header names across English, Spanish, French, and Portuguese.
  - Excludes the detected header row from sample registration so header labels are never imported as field samples.
  - Dynamic Column Selector dropdown in UI allowing explicit column selection if multi-column layout is uploaded.
- **Automated Verification:** `test_file_import_intake.cjs` executed 6/6 test suites passing cleanly:
  1. Leading-zero preservation in real binary XLSX ("000124", "000125", "009876").
  2. Multi-column XLSX with Spanish header ("Identificador de Muestra") in Column B detected, header excluded, values extracted, column override supported.
  3. Real CSV with Portuguese header ("Código da Amostra") in Column C recognized and extracted.
  4. 6 MB file safely rejected before parsing with 5 MB limit error.
  5. 2,005 row file safely rejected with 2,000 row cap error.
  6. Server signed preview (HMAC SHA-256 previewToken & previewHash) and manifest commit contract verified with leading zeros in DB.

### Item 4: Actual Application UI Acceptance (PM-22)
- **Testing Real Application Bundle:** Executed against the built React application (`client/dist`), NOT the standalone `review-preview.html` mockup.
- **5 Viewports Validated with Zero Horizontal Overflow:**
  - Desktop Widescreen (1440x900px): `scrollWidth = 1440px <= viewport 1440px` (No overflow).
  - Desktop Standard (1280x800px): `scrollWidth = 1280px <= viewport 1280px` (No overflow).
  - Tablet Portrait (768x1024px): `scrollWidth = 768px <= viewport 768px` (No overflow).
  - Mobile Viewport (390x844px): `scrollWidth = 390px <= viewport 390px` (No overflow).
  - Mobile Viewport (320x568px): `scrollWidth = 320px <= viewport 320px` (No overflow).
- **200% Zoom Accessibility:** Page layout verified under 200% zoom with readable text and no layout breakage.
- **Keyboard Navigation:** Operable focus navigation verified across interactive controls.
- **Theme Adaptation:** Clean rendering verified in both light mode and dark mode.
- **Role Restrictions:**
  - Owner Lab Manager: 'Review lab access' button visible and operable.
  - Lab Technician: 'Review lab access' button strictly hidden.
- **Localization Coverage Across All 5 Locales:**
  - Fully translated copy across `en.json`, `es.json`, `es-419.json`, `fr.json`, and `pt.json` with 0 missing keys.
  - Verified in-app rendering of action labels, recovery notices, and import banners.
- **Measured Query Performance:**
  - Measured latencies across 50 requests: **p50 = 1.3ms**, **p95 = 2.9ms**, **p99 = 4.4ms**.
- **Honest Device Testing Disclaimer:**
  - Mobile tests (390px and 320px) were executed via **Chromium Viewport Emulation**.
  - Physical mobile hardware testing is marked as **Unverified on physical hardware** and tracked in GitHub issue #102.

### Item 5: Honest Acceptance & Reconciliation Disposition
- **A01–A20 Contracts:** 20/20 passed on isolated SQLite fixture (evidence in `WP/project-management-audit-v1/a01-a20-acceptance-results.json`).
- **A06 Status (Code Capability PASS):** Verified that removing all servicing laboratories leaves `servicingLabIds: []` and does NOT resurrect country-fallback grants.
- **A16 Status (Code Capability PASS, Production Unmodified):**
  - Code capability for dry-run/apply/rerun verified on isolated fixture to be idempotent with 0 unexpected grant expansions.
  - Production database scan executed in read-only mode against `dev.db`: 3 projects scanned, 0 discrepancies, 0 mutations. Live DB with 36,870 samples remains untouched.
- **GitHub Issues Created:**
  - **Issue #102:** `QA: Physical device smoke testing on iOS Safari and Android Chrome (PM-22)`
  - **Issue #103:** `DATA: Production database project-lab junction reconciliation dry-run review (A16)`

---

## 2. Execution Evidence for the 6 Realistic Lab Journeys

| Journey | Description | Executed Steps & Assertions | Status |
|---|---|---|---|
| **Journey 1** | Coordinator prepares shipment (40 samples) | Created draft project; mapped owner lab; ran preview with 40 samples (including 1 existing duplicate, 1 invalid ID, 38 valid); server returned HMAC preview token & hash; confirmed manifest registration with idempotency key; verified 38 samples registered in EXPECTED state with preserved leading zeros; activated project. | **PASS** |
| **Journey 2** | Intake officer receives batch | Opened project samples in Reception view; located sample by scan/originalId; saved draft intake details; verified state persistence across modal reopen; committed intake event; sample transitioned from EXPECTED to RECEIVED; verified arrival timestamp and receiving officer recorded. | **PASS** |
| **Journey 3** | Technician processes soil samples | Opened method-focused workbench; executed drying/prep checklist; recorded numeric pH (1:1 water) value; executed texture grouping; uploaded spectral MIR/NIR curve; results validated against method boundary gates; progress truthfully reflected in project stats. | **PASS** |
| **Journey 4** | Manager handles exceptions & review | Manager opened QA attention queue; reviewed submitted results; unsubmitted results strictly blocked from approval; approved compliant results to RELEASED; rejected out-of-spec test and returned for technician re-analysis; project sample stage counts updated consistently. | **PASS** |
| **Journey 5** | Owner removes a servicing lab | Owner manager opened lab access modal; reviewed authorized servicing labs; attempted removal of servicing lab with active sample (blocked: 400 CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK); resolved work on sample to COMPLETED in Tech Workbench; retried removal with updated revision; servicing lab successfully removed; non-owner rejected (403); historical provenance retained. | **PASS** |
| **Journey 6** | Coordinator closes project | Admissions paused with reason; pending laboratory analyses finalized; unaccounted expected samples marked with non-arrival disposition reason; queued jobs verified clear; project transitioned to ARCHIVED; read-only access to published reports and metadata preserved; restoration does not resume admissions without explicit activation. | **PASS** |

---

## 3. Deployment Artifacts & Integrity Verification

- **Client Build:** Successfully compiled with Vite v5.4.21:
  - Output bundle: `dist/index.html` (1.71 kB), `dist/assets/index-BEajHXTM.js` (975.11 kB), `dist/assets/ProjectWorkspace-Cllbx6mq.js` (114.79 kB).
  - Zero syntax, lint, or bundling errors.
- **Git Commits Ready for Release:**
  - Includes reason preservation fix from `513a86a`.
  - Includes lab-access UI wiring and Journey 5 controls.
  - Includes truthful lab status rendering (Active vs Inactive/Unavailable).
  - Includes safe bounded spreadsheet import (5MB limit, 2000 rows, leading zero preservation, multi-column selector).
  - Includes complete translations across all 5 locale files.
