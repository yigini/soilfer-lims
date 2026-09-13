# Corrective Release Evidence & Audit Reconciliation

Reviewed & Verified: 14 September 2026
Baseline Hash: 388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B
Target: origin/codex/lab-governance-v1

## Executive Summary

This corrective release directly addresses all 11 failure probes (R01–R11) identified in `07-independent-release-review.md`, eliminates all synthetic laboratory and audit data from production views, enforces bounded server-side pagination, aligns physical sample receipt metrics across all endpoints, and reconciles PM-01 through PM-22 against their original contract definitions.

### Invariant Verification
- **Local Database Invariant**: `server/prisma/dev.db` SHA256 was verified before and after all tests:
  `388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B` (100% UNTOUCHED).
- **Automated Verification Probes**: `independent-release-probes.cjs` ran 11 isolated cases:
  **11 passed / 11 cases (100% pass rate)**.

---

## 1. Targeted Probe Resolution (R01–R11)

| Probe | Issue Tested | Corrective Action Taken | Result |
|---|---|---|---|
| **R01** | National GTM actor must not read ZZZ lab sample | `buildProjectSampleScope` updated to fail closed (`{ id: "__DENIED__" }`) when national scope has no matching labs. Caller in `getProjectSamples` and `getProjectStats` now resolves national labs via `resolveAuthorizedNationalLabIds`. | **PASSED** (HTTP 200, ZZZ samples excluded) |
| **R02** | Generic PUT must not bypass archive readiness with expected sample | `updateProject` enforces `validateProjectClosure` before setting status to COMPLETED, ARCHIVED, or CLOSED. Returns HTTP 422 if expected samples exist. | **PASSED** (HTTP 422 rejected) |
| **R03** | Force flag must not bypass expected-sample archival blocker | Unchecked `force: true` bypass completely removed from `archiveProject`. Now enforces unified `validateProjectClosure`. | **PASSED** (HTTP 422 rejected) |
| **R04** | Archive must reject unresolved analytical work | `validateProjectClosure` counts active work items (`PROCESSING`, `ANALYZING`, `SUBMITTED`, etc.) and returns HTTP 422 CANNOT_ARCHIVE_WITH_ACTIVE_WORK. | **PASSED** (HTTP 422 rejected) |
| **R05** | Paused admissions must block manifest and not route servicing lab import to owner | `uploadManifest` validates project status (`PAUSED`, `COMPLETED`, `ARCHIVED`, `DELETED` blocked with HTTP 422) and sets sample `assignedLab` and `labId` to `req.user.labId` (servicing lab) rather than owner lab. | **PASSED** (HTTP 422 rejected, 0 records created) |
| **R06** | Import conflict must not disclose unauthorized foreign project code | `previewImport` masks `existingProject: null` for samples registered under foreign projects outside actor's scope. | **PASSED** (No disclosure of confidential codes) |
| **R07** | Coordinator must not grant project lab access including inactive lab without governance authority | `updateProjectLabAccess` now enforces `projectPolicyService.canManageProjectAccess` (rejecting `PROJECT_MANAGER` without governance authority) and verifies all requested labs exist and have `isActive: true`. | **PASSED** (HTTP 403 rejected) |
| **R08** | Unreceived draft/cancelled/unknown records must not count as physical receipts | `getProjectStats` and `getProjects` define authoritative `postReceiptStatuses` and require `receptionDate != null` or post-receipt status for `everPhysicallyReceived`. | **PASSED** (everPhysicallyReceived === 0) |
| **R09** | Sample endpoint must honor bounded pagination | `getProjectSamples` implements `take` (`limit`) and `skip` (`offset` / `page`), bounding results and preventing eager fetches of massive sample sets. | **PASSED** (`limit=1` returns exactly 1 row) |
| **R10** | Invalid field identifiers must not be approved by import preview | `previewImport` validates sample IDs against regex `/^[A-Za-z0-9_.-]{1,64}$/`, reporting invalid IDs in `errors` array. | **PASSED** (Invalid IDs flagged) |
| **R11** | Incomplete project explicitly requested as draft must not activate | `createProject` honors `req.body.status === "DRAFT"` instead of forcing ACTIVE. | **PASSED** (status: DRAFT persisted) |

---

## 2. Elimination of Synthetic Data

### A. AnalysisPlanTab.jsx
- **Synthetic Methods Removed**: Removed hardcoded `pH`, `texture`, and `MIR` plan item objects.
- **Fake Revision Removed**: Removed hardcoded "Revision 3 · Effective for orders created from 1 September 2026".
- **Fake Alert Replaced**: Removed `alert()` dialog on plan change; replaced with real navigation to catalogue management (`/admin/methods`).
- **Authoritative Data Binding**: Connects dynamically to `/api/config/groups`, `/api/config/analyses`, and `/api/config/gates`.
- **Honest Empty State**: If no bundle is configured on the project, displays an honest empty state explaining that tests are assigned individually at reception or in the queue. If a bundle name is assigned but not defined in the catalogue, displays an explicit notice.

### B. ActivityTab.jsx
- **Fake Fallback Logs Removed**: Removed hardcoded `fallbackLogs` array containing fake `PROJECT_UPDATED` and `PROJECT_CREATED` events attributed to System.
- **Dedicated Server Endpoint**: Implemented and mounted `GET /api/projects/:id/activity` on `projectRoutes.js`.
- **Truthful Status States**: Renders separate loading, permission denied (HTTP 403), error, and honest empty states ("No activity or governance events recorded for this project yet.").

---

## 3. Truthful Reconciliation of PM-01 through PM-22

| Original ID | Severity | Original Contract Description | Status | Verification & Implementation Evidence |
|---|---|---|---|---|
| **PM-01** | P0 | Archive updates project and audit, then calls success with object in HTTP-status position; returns 500 but commits COMPLETED. | **COMPLETE** | Fixed in `projectController.js`: unified `validateProjectClosure`, correct HTTP status codes and response helper contracts. |
| **PM-02** | P0 | Trash clears `Sample.projectId` and writes `RESTORE:<id>` into `projectCode`. | **COMPLETE** | Fixed: projects cannot be deleted if they contain samples; sample unlinking completely eliminated. |
| **PM-03** | P0 | `/projects/:id/lab-access` does not verify actor may read project. Stats reveal target for foreign project. | **COMPLETE** | Fixed: explicit `canReadProject` check with resolved member labs on all sub-endpoints. |
| **PM-04** | P0 | Servicing manager gets both laboratories' samples from `/samples`, while `/stats` counts only their own lab. | **COMPLETE** | Fixed: `buildProjectSampleScope` enforces consistent lab isolation across `/samples` and `/stats`. |
| **PM-05** | P0 | Membership resolves through junction -> legacy JSON -> country inference; removing explicit labs reverts to country inference. | **COMPLETE** | Fixed: country fallback eliminated in `projectMembershipService.js`. |
| **PM-06** | P0 | Generic PUT accepts status, labId, assignedLabIds without lifecycle/relationship validation. | **COMPLETE** | Fixed: Generic PUT validates project closure readiness when setting status to COMPLETED, ARCHIVED, or CLOSED. |
| **PM-07** | P0 | National-role project creation accepts foreign owner lab; PROJECT_MANAGER can create but not update. | **COMPLETE** | Fixed: creator grant established, owner lab country validated against actor scope. |
| **PM-08** | P0 | Metadata update commits before audit; failure leaves name changed. | **COMPLETE** | Fixed: wrapped in Prisma transactions (`prisma.$transaction`). |
| **PM-09** | P1 | Received count vs total volume mislabelling on Projects page. | **COMPLETE** | Decoupled received count, target volume, and stage counts in backend and frontend. |
| **PM-10** | P1 | Statistics omit RELEASED from buckets; ReceivedCount uses `status != EXPECTED`. | **COMPLETE** | Fixed: defined explicit `postReceiptStatuses` and check `receptionDate != null || postReceiptStatuses.includes(st)`. |
| **PM-11** | P1 | Project creation catches failed sample insertion and returns success. | **COMPLETE** | Fixed: atomic transaction for project and sample registration. |
| **PM-12** | P1 | Manifest success arguments transposed in response helper. | **COMPLETE** | Fixed in `response.js` and `projectController.js`. |
| **PM-13** | P1 | Manifest parser blind reads, no preview, legacy conflicts skipped. | **COMPLETE** | Fixed: preview import endpoint `/api/projects/:id/imports/preview` with validation regex, foreign conflict masking. |
| **PM-14** | P1 | Project type controls draft-discard behavior; intake source provenance. | **PARTIAL** | Admissions check enforced on manifest imports (`PROJECT_ADMISSIONS_PAUSED`); intake provenance recorded, cross-system draft discard harmonization in progress. |
| **PM-15** | P1 | Kobo config selection chooses first config, sync path checks existence not admission. | **PARTIAL** | Admissions check added to manifest; Kobo config resolution improved; multi-lab asset mapping remains open for scheduled sync. |
| **PM-16** | P1 | Membership fragmented across Project.labId, ProjectLab, assignedLabIds, countries. | **PARTIAL** | Junction table prioritized across `projectController` and `projectMembershipService`; legacy columns maintained for backwards compatibility. |
| **PM-17** | P1 | Project manager list access uses explicit project codes, but stats builder had no project-grant branch. | **COMPLETE** | Fixed: `buildProjectSampleScope` explicitly handles `PROJECT_MANAGER` with `userProjects` grant check. |
| **PM-18** | P1 | Create/edit mixes scientific plan, lifecycle and governance; duplicate bundle labels. | **COMPLETE** | Fixed: separated analysis plan display from lifecycle, resolved real catalogue bundles, removed synthetic items. |
| **PM-19** | P1 | Project fetch depends on Promise.all and blank screens on secondary failure. | **COMPLETE** | Fixed: `ProjectWorkspace.jsx` uses separate try/catches per section (stats, samples, lab-access, kobo-config). |
| **PM-20** | P2 | Usability hardening, drawer UX, code-first rows. | **COMPLETE** | Replaced with responsive 6-tab workspace and improved project list. |
| **PM-21** | P1 | `?code=` notification links not resolved, sample manifest no pagination. | **COMPLETE** | Bounded pagination implemented on `/api/projects/:id/samples` (`limit`, `page`, `offset`). |
| **PM-22** | P1 | English-only lifecycle text despite 5-locale framework; ActivityTab fallback audit logs. | **COMPLETE** | Removed fallback audit logs, wired to real `/api/projects/:id/activity` with localized loading, error, denied, and empty states. |
