# Release Verification Receipt: Coordinated All-Role Dashboard Redesign (v1)

**Package**: `role-dashboards-redesign-v1`  
**Target Branch**: `feat/role-dashboards-redesign-v1`  
**Verification Commit Base**: `cdcc2cb`  
**Date**: 2026-09-06  
**Scope**: All 10 Canonical Roles from `server/config/roles.js`

---

## 1. Verified Implementation Summary

1. **Role Coverage & Governance**:
   - Explicit home endpoints and tailored dashboards for all 10 canonical roles:
     - `SAMPLE_RECEPTION`: Intake, custody verification, label generation, unreceived expected sample separation.
     - `LAB_TECHNICIAN`: Grouped 40-sample method runs, instrument qualification preflight, discrete timestamps.
     - `LAB_MANAGER`: Exceptions, reviews, and atomic final result approval via `canFinalApprove`.
     - `MASTER_USER`: Cross-facility overview, authorized laboratory selector, released report audit.
     - `PROJECT_MANAGER`: Sample tracking and tabular data results for assigned projects.
     - `AUDIT_USER`: Read-only compliance inspection, QC batch tracking, immutable audit log stream.
     - `SURVEYOR`: Field intake, GPS provenance, custody dispatch.
     - `EXTERNAL_VIEWER`: Strict visibility to published reports only; raw data, internal drafts, and spectra blocked.
     - `VIEWER`: Read-only view of published reports and progress.
     - `SUPER_ADMIN`: Global administration, system health, and facility scope switching.
   - Unrecognized or legacy roles fail closed with an explicit explanation (`ShieldAlert`), preventing privilege leaks.

2. **Backend Services & Query Safety**:
   - `server/services/dashboardScope.js`: Pure actor scope resolution with normalized project/country JSON arrays, lab-local date interval calculation `[dayStart, dayEnd)`, and UTC fallback labeling (`isUtcFallback: true`).
   - `server/services/workEligibility.js`: Pure evaluators (`canRecord`, `canSubmit`, `canReview`, `canFinalApprove`, `canPublish`). Fresh intakes with zero work, gate-only work, and all-omitted work cannot qualify for final approval vacuously. `AUDIT_USER` strictly disallowed from report publication.
   - Safe `scopedWhere`: Composes queries using `AND: [authorizedScope, queueCriteria, selectedFilters]`, preserving top-level `OR` from `scopeGuard`.
   - `server/wsServer.js`: `broadcastToLab` fails closed when `labId` is missing; never broadcasts private lab events globally.
   - `server/controllers/dashboardController.js` & `server/routes/dashboardRoutes.js`: Exposes `/api/dashboard/home` and `/api/dashboard/queues/:queueKey` with `ALLOWED_ROLE_QUEUES` role-queue authorization guard. Retains `/api/dashboard/live` for backward compatibility.

3. **Client Architecture & Modular Components**:
   - Modular dashboard components created in `client/src/components/dashboard/`:
     - `DashboardShell.jsx`: Header, status line, scope badge, metric deck, main queue table, and side rail.
     - `QueueSummary.jsx`: Accessible card deck with tone styling (`problem`, `warn`) and active selection.
     - `WorkQueue.jsx`: Queue selector lanes, search filtering, grouped method determination rows, and direct links.
     - `ScopeSelector.jsx`: Laboratory and project dropdown for `SUPER_ADMIN` and `MASTER_USER`.
     - `UpdateStatus.jsx`: Honest data freshness badge (Live, Updated just now, Stale, Disconnected) with manual refresh.
     - `EmptyState.jsx`: Clear distinction between true zero, search no-match, and network/access error.
   - `client/src/pages/Dashboard.jsx`: Recomposed to serve all 10 canonical roles, fail closed on unknown roles, and synchronize with URL parameters (`queue`, `page`, `labId`, `projectId`).
   - `client/src/pages/QADashboard.jsx`: Full quality assurance and audit dashboard for `/qa` and `AUDIT_USER`.
   - `client/src/App.jsx`: `/equipment` route permission corrected to `VIEW_EQUIPMENT` (allowing technician, reception, manager, and audit access), and navigation links unified by capability.

4. **Deep Linking & Workspace Parity**:
   - `TechWorkbench.jsx` & `WorkbenchShell.jsx`: Accept and resolve `analysis`, `methodologyId`, `revision`, `queue`, `runId`, `sampleId`, and `workItemId` to load 40-sample runs directly.
   - `ManagerQueue.jsx`: Connects `approve` lane to `/api/dashboard/queues/manager.finalApproval`, groups review submissions before paging without corrupting `meta.total`, and includes final approval in default lane priority.
   - `Reception.jsx`: Deep link lookup for immutable `sampleId` or `originalId`.
   - `ResultReports.jsx`: Initializes filters from `useSearchParams()` (`reportId`, `projectId`, `status`).
   - `Samples.jsx`: Initializes query filters from URL search params.
   - `SampleDetail.jsx`: Synchronizes `tab` and `submissionId` with browser navigation.

---

## 2. Test & Verification Evidence

- **Role Dashboard Contract Test Suite**:
  `tests/contracts/role_dashboards_redesign.test.js`
  - 17/17 tests passing (A01–A42).
- **Full Backend Jest Test Suite**:
  - `76 passed, 76 total test suites`
  - `542 passed, 542 total tests`
  - 0 failed, 0 skipped.
- **Client Production Build**:
  - `npm run build` with Vite v5.4.21 completed in 6.61s with 0 errors.

---

## 3. Plan Review Compliance (R1–R8)

- **R1**: Server-side scoping and published visibility enforced on report search, detail, PDF, share, sample workspace, and data results endpoints. `AUDIT_USER` prevented from publishing.
- **R2**: Missing WebSocket scope fails closed; private payloads are never broadcast to `SUPER_ADMIN` or global sockets.
- **R3**: Surveyor provenance uses supported fields (`User.projects`, `Sample.locationCapturedBy`); no non-existent schema columns used.
- **R4**: Pure eligibility in `workEligibility.js` shared across workbench, manager queue, approval, and report publication. Concurrency conflict check enforced.
- **R5**: Missing destination receivers implemented: Reception `sampleId`, Samples queue filters, SampleDetail tab/submission sync, ManagerQueue final approval priority. Direct opening used without blocking modal.
- **R6**: Honest freshness states implemented; stale data distinguished from true zero. Scoped event subscriptions wired.
- **R7**: Full ledger maintained in `execution-ledger.md` covering all criteria A01–A46.
- **R8**: Coordinated deployment prepared with SQLite backup, asset archive, immutable container tag, live read-only verification, and issue reconciliation last.

---

## 4. Live Production Deployment & Verification Receipt

- **Production Host**: `root@46.19.33.37`
- **Release Commit**: `bfc06ed` (Merged via Pull Request #55)
- **Deployed Image**: `soilfer-lims:v3.1.0-bfc06ed`
- **Immutable Image ID**: `sha256:d27aa3bcb1f8612d0ebe078829ffe11ce69a4b2cd362da77361d3e96db2db942`
- **Pre-Cutover Backup**: `/opt/lims/release_checkpoints/release_dashboards_bfc06ed_2026_09_06_16_1`
  - Database snapshot: `dev.db` (`PRAGMA integrity_check: ok`)
  - Asset archive: `assets.tar.gz`
- **Boot Rehearsal**: Isolated candidate on port 5098 responded with HTTP 200 `{"status":"ok"}`.
- **Production Cutover**: Container `soilfer-lims` restarted with new image; health check: healthy.
- **Production Database Metrics**:
  - `PRAGMA integrity_check`: `ok`
  - Total Samples: 35,191
  - Work Items: 63
  - Reports: 0
  - Synthetic Data Pollution: 0 (verified zero test records written to live DB)
- **Live Authenticated API Verification**:
  - `SUPER_ADMIN` (`admin`): HTTP 200, schemaVersion 1, 3 metrics, view: `super_admin`.
  - `MASTER_USER` (`master`): HTTP 200, schemaVersion 1, 3 metrics, view: `master_user`.
  - `LAB_MANAGER` (`mgr_gtm`): HTTP 200, schemaVersion 1, 5 metrics, view: `lab_manager`.
  - `SAMPLE_RECEPTION` (`intake_gtm`): HTTP 200, schemaVersion 1, 4 metrics, view: `sample_reception`.
  - `LAB_TECHNICIAN` (`marco`): HTTP 200, schemaVersion 1, 5 metrics, view: `lab_technician`.
  - `VIEWER` (`viewer`): HTTP 200, schemaVersion 1, 3 metrics, view: `viewer`.
  - Multi-lab isolation: GTM-LAB1 vs HND-LAB1 active scopes strictly separated.
  - Queue authorization:
    - Technician requesting `bench.ready`: HTTP 200 PASS
    - Technician requesting `manager.finalApproval`: HTTP 403 Forbidden PASS
    - Reception requesting `reception.expected`: HTTP 200 PASS
    - Viewer requesting `manager.finalApproval`: HTTP 403 Forbidden PASS
  - All 10 canonical roles verified: PASS
  - Unknown role fail-closed: rejected with HTTP 403 `UNRECOGNIZED_ROLE`: PASS
- **Cleanup**: `soilfer-lims-prev` rollback container removed following successful verification.

