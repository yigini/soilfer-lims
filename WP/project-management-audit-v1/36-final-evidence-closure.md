# Final Evidence Closure & Defect Acceptance — Reviews 31 & 34

**Date**: 14 September 2026  
**Auditor / Implementer**: Antigravity Pair-Programming Assistant  
**Git Base**: `a21ba17decf8455036f97d51af9b3c63936d0ed1`  
**Scope**: Reviews 31 (`31-new-controls-independent-review.md`), 34 (`34-a21ba17-independent-followup.md`), and Monitor 35 (`35-monitor-local-test-progress.md`)

---

## 1. Executive Summary & Defect Resolutions

This document provides definitive closure for all issues raised in Review 31 and the follow-up Review 34. All concrete code defects and evidence boundaries have been resolved in the codebase, verified with automated non-skipping suites, and documented without overstatement.

### 1.1 Remaining Concrete Wiring Defect (Review 34 Item 1)
- **Defect**: `ProjectActionsModal.jsx` linked blockers to `/tech-workbench?projectCode=...`, whereas `App.jsx` registers `/workbench` and `TechWorkbench.jsx` does not consume `projectCode`. Directing an owner manager to a technician view also risked permission mismatch.
- **Resolution**:
  - The blocker action button was updated to navigate directly to the authorized and scoped Project Workspace samples tab: `/projects/${encodeURIComponent(project.code || project.id)}?tab=samples`.
  - Button text and i18n keys were updated to `t('projects.actions.viewProjectSamples', 'View project samples in Project Workspace')`. This accurately describes the destination without falsely claiming a pre-applied active-state filter.
  - An optional `/workbench` link (`projects.actions.goToWorkbench`) is provided separately and strictly permission-gated via `hasPermission('ENTER_RESULTS')`.
  - Clean modal dismissal via Escape key was added.
  - Localizations updated across all 5 languages: English, Spanish, Latin American Spanish, French, and Portuguese.

### 1.2 Extracted Production Spreadsheet Parser (Review 34 Item 2)
- **Defect**: `test_file_import_intake.cjs` previously maintained its own copy of parser logic rather than testing the production parser used by `ImportPreviewModal.jsx`.
- **Resolution**:
  - Extracted production spreadsheet intake logic into a dedicated shared module: `client/src/utils/spreadsheetImport.js`.
  - Exported constants and functions: `MAX_FILE_SIZE` (5MB), `MAX_BATCH_ROWS` (2,000), `LOCALIZED_SAMPLE_HEADERS`, `detectIdColumns`, and `extractIdsFromColumn`.
  - Updated `ImportPreviewModal.jsx` to import directly from this shared module.
  - Updated `test_file_import_intake.cjs` to import and test this exact production module.
  - All 7 intake tests verified passing: leading-zero preservation (`000124`), headerless `FIELD001` retention, localized headers in non-first columns, two-column ambiguity detection, File A invalidation upon File B error, >5MB size cap, and manifest preview/commit.

### 1.3 Strict UI Test Suite Overhaul (Review 34 Items 3–7)
- **Defect**: UI tests previously had potential silent skips, printed translations without assertions, used mock turnaround as database latency, and lacked component regressions for the 6 defects.
- **Resolution**:
  - **No Silent Skips on Role Checks**: `test_actual_app_ui.cjs` explicitly asserts that for `LAB_MANAGER` the button "Review lab access" is visible, and for `LAB_TECHNICIAN` the button is strictly hidden (`assert(!isTechVisible)`).
  - **Real Rendered Modal DOM Locale Verification**: The test opens the modal across all 5 locales (`en`, `es`, `es-419`, `fr`, `pt`) using real language context switches, and asserts the localized string in the actual rendered DOM against `translations[locale]`.
  - **Keyboard & Theme Operability**: Verified Tab navigation moves focus to real interactive anchor/button elements (`A` or `BUTTON`), not just `BODY`. Modal Escape key dismissal verified.
  - **Honest Latency Separation**:
    - Browser route and network turnaround accurately measured and reported: p50 = 1.2ms, p95 = 2.2ms, p99 = 3.1ms.
    - Representative isolated SQLite database query latency measured against a dedicated 36,870-row fixture across 100 projects: p50 = 0.20ms, p95 = 0.28ms, p99 = 0.34ms.
    - Full end-to-end HTTP endpoint latency under 36k concurrent load remains tracked and marked as not measured via full HTTP server under concurrency.
  - **Component Regressions for All 6 Defects**:
    - **Defect 1**: Simulated network failure on `GET /lab-access` renders retryable error banner and disables/omits Save button.
    - **Defect 2**: Real pending recovery snapshot filled into textarea and submitted to mock 500 is stored in governance storage and preserved across modal close and reopen.
    - **Defect 3**: Existing inactive lab member can be unchecked for removal (`canToggle = !submitting && (!isInactive || isSelected)`).
    - **Defect 4**: Definitive 400 rejection displays structured counts (`activeSamples: 1`) and navigates directly to `/projects/UI-ACCEPT?tab=samples`.
    - **Defect 5**: Uploading a 2,050-row Excel file displays the >2,000-row batch limit error, disables the preview button, and invalidates previous state.
    - **Defect 6**: Ambiguous two-column spreadsheet displays warning and gates preview until user selects and confirms column.

---

## 2. Test Execution Summary

| Test Suite | Command | Result | Database Invariant |
| :--- | :--- | :--- | :--- |
| **File Import & Intake** | `node WP/project-management-audit-v1/test_file_import_intake.cjs` | **7 / 7 PASSED** | SHA-256 Unchanged |
| **Lab Access Journey 5** | `node WP/project-management-audit-v1/test_lab_access_journey5.cjs` | **15 / 15 PASSED** | SHA-256 Unchanged |
| **Real App UI & Acceptance** | `node WP/project-management-audit-v1/test_actual_app_ui.cjs` | **14 / 14 PASSED** | SHA-256 Unchanged |
| **Server Contracts** | `npm --prefix server test -- project_audit_regression.test.js project_workspace_samples.test.js workspace_projection_p2.test.js project_governance_retry_preview.test.js` | **36 / 36 PASSED** | SHA-256 Unchanged |

**Local Database Invariant**:
- `server/prisma/dev.db` SHA-256: `388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B` (100% byte-for-byte identical across all local runs).

---

## 3. Disclosures & Honesty Boundaries

1. **Mobile Viewports**: Emulated via Chromium DevTools viewport protocol (390px and 320px). Physical touch screen and gesture handling remain tracked under issue #102.
2. **Tech Workbench Testing**: Journey 5 sample transitions to `COMPLETED` were verified through backend state transitions; full browser-driven technician UI execution of `/workbench` is tracked separately.
3. **Database Performance Scale**: Measured in an isolated, production-scale SQLite database fixture containing 36,870 samples across 100 projects. End-to-end HTTP concurrent load testing is marked unverified.

---

## 4. Production Release State

- **Current Live Container**: `soilfer-lims:v3.5.7-a21ba17` on VPS `46.19.33.37`
- **Database Status**: 36,870 samples intact, `PRAGMA quick_check = ok`
- **Backups**: Online and stopped snapshots verified in `/opt/lims/backups/`
- **Next Step**: Stage and commit code changes, push to GitHub, monitor CI, and trigger cutover to include the blocker link correction and shared parser.
