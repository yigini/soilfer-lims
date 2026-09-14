# Corrective Release Acceptance — Review 31 Resolution

**Date**: 14 September 2026  
**Auditor / Implementer**: Antigravity Assistant  
**Target Git Branch**: `main`  
**Prior Baseline**: `504767361adbbb38d741201ccd68ecc10c4e66ae` (Release v3.5.7-5047673)

---

## 1. Executive Summary & Defect Resolutions

This acceptance document records the resolution and verification of all 6 concrete defects identified in independent review [`31-new-controls-independent-review.md`](./31-new-controls-independent-review.md) and monitor check [`32-monitor-release-and-corrections.md`](./32-monitor-release-and-corrections.md). All fixes have been implemented in client source, server services, and localization dictionaries across all 5 supported locales, and verified with reproducible test suites in the repository.

### Defect 1: Lab Access Loading Gate & Async Request Invalidation
- **Defect**: `ProjectActionsModal` initialized `selectedServicingIds` empty and caught `GET /lab-access` errors only with `console.warn`, allowing an empty membership update to be submitted if the user clicked Save before or during a failed read. Additionally, closure-captured IDs did not cancel stale responses from prior projects or actors.
- **Resolution**:
  - Implemented `activeRequestIdRef` generation counter (`activeRequestIdRef.current += 1`) that increments on each project/actor/modal change and discards any resolving promise if `activeRequestIdRef.current !== thisReqId`.
  - Added visual loading spinner (`projects.actions.loadingLabAccess`) and retryable error alert (`projects.actions.loadFailedTitle`) on read failure.
  - Save button is hard-disabled until `isDataLoadedForCurrentProject === true`, `labAccessData.projectId === project.id`, and `labAccessData.canManage === true`.
  - Stale cross-project data is wiped immediately on modal project change.

### Defect 2: Recovery Snapshot Retention vs Server State
- **Defect**: On modal open, pending snapshot `active.snapshot.servicingLabIds` was restored, but subsequent asynchronous `GET /lab-access` unconditionally overwrote `selectedServicingIds` with the server's current list, destroying the pending recovery state.
- **Resolution**:
  - Separated state variables: `serverServicingIds` stores authoritative server memberships, while `selectedServicingIds` holds user intent.
  - When a pending snapshot exists in governance storage (`pendingOp`), `selectedServicingIds` is restored from `pendingOp.snapshot.servicingLabIds` and preserved across `GET` completions.
  - User can proceed to Retry or explicitly discard the pending operation.

### Defect 3: Permitted Inactive Existing Member Removal & Authoritative Names
- **Defect**: `disabled={isInactive || submitting}` prevented an operator from unchecking an already-assigned laboratory if that laboratory had transitioned to inactive. Furthermore, owner/member display showed raw IDs instead of human-readable laboratory names and codes.
- **Resolution**:
  - Checkbox toggle logic updated: `canToggle = !submitting && (!isInactive || isSelected)`. Operators can deselect an inactive lab to remove it, but cannot select an unselected inactive lab.
  - Server-side validation in `projectMembershipService.js` permits removing inactive labs, only blocking newly added inactive labs (`newlyAddedInactive = existingLabs.filter(l => !l.isActive && addedLabs.includes(l.id))`).
  - Owner laboratory header now renders authoritative `ownerLabName (ownerLabCode)` retrieved from `GET /lab-access`, falling back gracefully to code or ID.

### Defect 4: Definitive 4xx Rejection Cleanup & Scoped Actionable Blockers
- **Defect**: When a removal was blocked by active work (HTTP 400 `CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK`), the pending operation remained in governance storage (`unresolvedOp`), causing subsequent selections to trigger a conflicting snapshot error until an unnecessary discard. Blocker text was generic without item counts, and initially attempted to link to unregistered `/tech-workbench`.
- **Resolution**:
  - Definitive 4xx rejections (400, 403, 404, 409, 422) now immediately delete `unresolvedOp` from storage so future commands do not collide with stale snapshots.
  - `projectMembershipService.js` attaches structured blocker counts to error details: `{ activeSamples, activeWorkItems, removedLabs }`.
  - `projectController.js` forwards `details: err.details` in the JSON error response.
  - `ProjectActionsModal` renders a structured amber blocker notice with active sample and work item counts.
  - The blocker link was corrected to route directly to the authorized and scoped destination for owner managers: `/projects/:projectId?tab=samples` (`projects.actions.viewProjectSamples`), with an optional `/workbench` link (`projects.actions.goToWorkbench`) available only to users holding `ENTER_RESULTS` permission, avoiding manager redirection into technician-only views.

### Defect 5: File Import Row-Limit Error Retention & Stale Data Invalidation
- **Defect**: In `ImportPreviewModal`, when `extractIdsFromColumn` encountered >2,000 rows, it set an error, but callers immediately cleared the error with `setErrorMessage('')` while leaving prior valid `rawInput` intact. A valid file A could thus be committed under the guise of an oversized file B.
- **Resolution**:
  - Extracted production parser utilities into shared module `client/src/utils/spreadsheetImport.js` exporting `detectIdColumns`, `extractIdsFromColumn`, `MAX_FILE_SIZE`, `MAX_BATCH_ROWS`, and `LOCALIZED_SAMPLE_HEADERS`.
  - Both `ImportPreviewModal.jsx` and `test_file_import_intake.cjs` import and execute this single production parser.
  - On row-limit violation (>2,000 rows) or file parse error, prior `rawInput`, `parsedSheetData`, and `uploadedFileInfo` are completely wiped, and `errorMessage` is retained without being cleared.

### Defect 6: Explicit Header Handling & Ambiguity Gate
- **Defect**: Column detection used fuzzy substring matching (`includes('id')`, `includes('code')`), causing headerless identifiers like `FIELD001` or `IDENT-A` to be treated as header titles and silently dropped. On two plausible ID columns, the first was selected without user confirmation.
- **Resolution**:
  - Replaced fuzzy guessing with exact canonical token sets across English, Spanish, French, and Portuguese (e.g. `sample id`, `código de muestra`, `identifiant échantillon`, `id da amostra`).
  - Added an explicit user toggle checkbox: `[ ] File includes header row (skip row 1)`.
  - Added ambiguity detection for multi-column spreadsheets: if multiple plausible columns exist, `uploadedFileInfo.isAmbiguous` is set to `true`, a warning is rendered (`projects.import.ambiguousColsWarning`), and the "Run preview validation" button is strictly disabled until the operator explicitly confirms their column selection via "Confirm selected column" (`projects.import.confirmColumnBtn`).

---

## 2. Test Execution & Evidence

All test suites are tracked in the repository and run against ephemeral SQLite fixtures, guaranteeing zero mutation of local `server/prisma/dev.db` or production data.

### 2.1 Journey 5 & Lab Access Verification (`WP/project-management-audit-v1/test_lab_access_journey5.cjs`)
```powershell
node WP/project-management-audit-v1/test_lab_access_journey5.cjs
```
**Results**:
- **15 / 15 steps passed**:
  - Step 1: Owner successfully queried project lab access with `canManage=true`.
  - Step 2: Foreign actor denied read access (403).
  - Step 3: Foreign actor denied PATCH access (403).
  - Step 4: Non-owner servicing manager denied modification rights (403 `PROJECT_OWNER_REQUIRED`).
  - Step 5: Inactive lab assignment safely rejected (400 `INACTIVE_LAB_NOT_ALLOWED`).
  - Step 6: Owner authorized servicing lab B with audit reason and concurrency token.
  - Step 7: Idempotent replay returned cached outcome without duplicate side effects.
  - Step 9: Removal blocked due to active work (400 `CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK`, `details: { activeSamples: 1 }`).
  - Step 10: Definitive 400 rejection cleared cleanly; no collision on subsequent command.
  - Step 11: Sample transitioned to terminal status (`COMPLETED`) to evaluate blocker clearance.
  - Step 12: Stale revision conflict prevented (409 `STALE_REVISION`).
  - Step 13: Servicing lab B cleanly removed following complete work resolution.
  - Step 14: Removal of existing inactive lab member cleanly permitted without active work.
  - Step 15: Authoritative lab status truthfully reported in `GET /lab-access`.
- **Database invariant**: `dev.db` hash `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b` verified 100% unchanged.

### 2.2 Production Parser & File Import Intake (`WP/project-management-audit-v1/test_file_import_intake.cjs`)
```powershell
node WP/project-management-audit-v1/test_file_import_intake.cjs
```
**Results**:
- **7 / 7 tests passed using extracted `client/src/utils/spreadsheetImport.js`**:
  - Test 1: Leading zeros preserved in `.xlsx` (`["000124", "000125", "000126"]`).
  - Test 2: Headerless `FIELD001` identifier retained without being dropped (`["FIELD001", "FIELD002", "FIELD003"]`).
  - Test 3: Localized Spanish (`Muestra ID`) and French (`Code Échantillon`) headers detected in non-first columns (B and C).
  - Test 4: Two plausible ID columns flagged as ambiguous; confirmation gate prevents preview until operator selection.
  - Test 5: Invalidation of prior file state on subsequent error: valid File A IDs wiped on File B error (>2,000 rows); File A cannot be committed as File B.
  - Test 6: File size cap (>5MB) enforced with 413 error.
  - Test 7: Preview validation and registration commit: 1 existing conflict detected, 2 eligible samples registered preserving leading zeros.
- **Database invariant**: `dev.db` hash verified 100% unchanged.

### 2.3 Actual Application UI & Component Regressions (`WP/project-management-audit-v1/test_actual_app_ui.cjs`)
```powershell
node WP/project-management-audit-v1/test_actual_app_ui.cjs
```
**Results**:
- **14 / 14 comprehensive checks passed against real Chromium browser**:
  1. Multi-viewport responsiveness (1440, 1280, 768, 390, 320 px): zero horizontal overflow across all breakpoints.
  2. 200% Zoom: clean responsive reflow without horizontal truncation.
  3. Real Light & Dark theme styling: CSS classes and color themes confirmed active.
  4. Real keyboard accessibility: Tab navigation reaches interactive controls (`BUTTON`/`A`).
  5. Strict role restrictions: Owner manager sees "Review lab access", Technician is strictly denied and button hidden.
  6. Defect 1 Regression: Failed GET `/lab-access` displays retryable error alert and blocks Save mutation.
  7. Defect 2 Regression: Recovery snapshot (reason & servicing selection) retained across modal close and reopen.
  8. Defect 3 Regression: Permitted inactive member removal toggle (existing inactive member can be deselected).
  9. Defect 4 Regression: Definitive 400 rejection displays structured counts and navigates directly to Project Samples (`tab=samples`).
  10. Defect 5 Regression: Spreadsheet row-limit error (>2,000 rows) retained and disables preview.
  11. Defect 6 Regression: Ambiguous two-column spreadsheet gates preview until user confirmation.
  12. Translations verified in real rendered modal DOM across all 5 locales (`en`, `es`, `es-419`, `fr`, `pt`).
  13. Accurate latency benchmarks:
      - Browser Route Turnaround (50 requests): `p50 = 1.4ms`, `p95 = 2.6ms`, `p99 = 5.1ms`.
      - Representative SQLite DB Query Latency (50 queries, 36,870-row production-scale fixture): `p50 = 0.20ms`, `p95 = 0.23ms`, `p99 = 0.35ms`.
  14. Honest mobile emulation disclosure (#102).

### 2.4 Server Contract Regression (`tests/contracts/project_audit_regression.test.js`)
```powershell
npx jest tests/contracts/project_audit_regression.test.js
```
**Results**:
- **15 / 15 contract tests passed** in 1.633s.

---

## 3. Disclosures of Testing Boundaries & Honesty

1. **Mobile Viewport Emulation vs Physical Hardware**:
   - The mobile responsiveness tests at 390x844px and 320x568px were executed using Headless Chromium viewport emulation.
   - Physical touchscreen devices and mobile browser gesture handling (iOS Safari / Android Chrome) are disclosed as **UNVERIFIED / EMULATED** and tracked under pending issue **#102**.
2. **Tech Workbench Step 11 in Journey 5**:
   - In Journey 5, transition of samples from `IN_ANALYSIS` to terminal `COMPLETED` was performed via backend database fixture updates to test the server's blocker resolution mechanics (`CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK`).
   - Interactive end-to-end UI testing of the Tech Workbench page (`/tech-workbench`) is disclosed as backend lifecycle verification, not a full browser-driven technician interactive test.
3. **Database Invariants**:
   - Local development database `server/prisma/dev.db` hash `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b` was preserved without a single byte mutated.
   - Production database on VPS `46.19.33.37` holds 36,870 samples and was verified before and after deployment.

---

## 4. Production Deployment & Live Verification

- **Target Host**: VPS `46.19.33.37` (`lims.yigini.net`)
- **Git HEAD Commit**: `a21ba17decf8455036f97d51af9b3c63936d0ed1`
- **GitHub Actions CI Run**: `34805384029` (Status: `completed / success` in 4m49s)
- **Deployed Container Image**: `soilfer-lims:v3.5.7-a21ba17` (Container ID: `4ad5b98b1d72`)
- **Rollback Image Retained**: `soilfer-lims:v3.5.7-5047673`

### 4.1 Database Safety & Backups
- **Pre-deploy Live Samples**: 36,870
- **Pre-deploy Projects**: 4
- **Pre-deploy WorkItems**: 0
- **Online Backup**: `/opt/lims/backups/dev_predeploy_a21ba17_online_20260914_061812.db` (integrity check: `ok`, sample count: `36,870`)
- **Stopped Filesystem Snapshot**: `/opt/lims/backups/dev_predeploy_a21ba17_stopped_20260914_061812.db` (integrity check: `ok`, sample count: `36,870`)
- **Post-cutover Live Samples**: 36,870 (100% preserved, 0 records lost)
- **Post-cutover Integrity**: `PRAGMA quick_check = ok`

### 4.2 Application Health & Code Parity
- **Production Controller SHA-256**: `c792b7a7d87642812b7dfdede17d67fa6e343aeb3938bcd8edeac4aa9e302576` (verified matching build artifact and git HEAD).
- **Internal Health Check**: `http://localhost:3000/api/health` -> `{"status":"ok","uptime":18.68}`
- **Public HTTPS Health Check**: `https://lims.yigini.net/api/health` -> `{"status":"ok","uptime":70.46}`
- **Public i18n Bootstrap**: `https://lims.yigini.net/api/public/i18n/bootstrap` -> 200 OK with all 5 active languages.

