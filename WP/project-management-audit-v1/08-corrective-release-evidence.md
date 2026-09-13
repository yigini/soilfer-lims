# Corrective Release Evidence & Audit Reconciliation

Reviewed & Verified: 14 September 2026
Baseline Hash: 388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B
Target: origin/codex/lab-governance-v1

## Executive Summary

This corrective release directly addresses all 11 original failure probes (R01–R11) and all 6 monitor follow-up probes (H01–H06) identified in `07-independent-release-review.md` and `09-monitor-review.md`. It eliminates synthetic laboratory and audit data from production views, enforces strict exact-entity audit log queries, bounds server sample responses while wiring full client-side pagination, provides explicit error and retry handling for catalogue requests, and updates all 5 application locales (EN, ES, ES-419, FR, PT).

In accordance with Codex's monitor review, this release is documented truthfully as a **partial release**. Open items and ongoing acceptance criteria from the original 22 findings (including settings editing, multi-lab reception/scheduler admission, and full reconciliation lifecycle) are explicitly distinguished from completed fixes.

### Invariant Verification
- **Local Database Invariant**: `server/prisma/dev.db` SHA256 was verified before and after all tests:
  `388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B` (100% UNTOUCHED).
- **Automated Verification Probes**: `monitor-corrective-probes.cjs` ran 17 isolated cases:
  **17 passed / 17 cases (100% pass rate)**. Both R01–R11 and H01–H06 pass completely.

---

## 1. Targeted Probe Resolution (R01–R11 & H01–H06)

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
| **H01** | Prepared sample still needs analysis and must block closure | `validateProjectClosure` expanded to check all active intake and preparation stages (`COLLECTED`, `DRYING`, `GRINDING`, `PREPARED`, `IN_LAB`, `ANALYSIS_IN_PROGRESS`, `ANALYSIS`, `SUBMITTED_FULL`, `SUBMITTED_PARTIAL`) as well as active `WorkItem` records. Rejects project closure with HTTP 422. | **PASSED** (HTTP 422 rejected) |
| **H02** | Direct manifest commit accepts invalid IDs without preview | Added sample identifier regex validation (`/^[A-Za-z0-9_.-]{1,64}$/`) directly into `uploadManifest` commit endpoint, returning HTTP 400 `INVALID_IDENTIFIER_FORMAT` when invalid IDs are submitted directly. | **PASSED** (HTTP 400 rejected) |
| **H03** | Commit conflict reveals foreign project code `SECRET` | Neutralized cross-project conflict handling in `uploadManifest`. Replaces interpolated foreign project names/codes with generic conflict notices, preventing disclosure of confidential foreign project identities. | **PASSED** (No foreign project code leaked) |
| **H04** | Servicing lab can be removed while having prepared sample | Enforced outstanding-work removal blocker in `_executeUpdateProjectLabAccess`. If any removed laboratory has active or unfinished samples (`status not in terminalStatuses`), removal is blocked with HTTP 400 `CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK`. | **PASSED** (HTTP 400 rejected) |
| **H05** | Activity endpoint leaks foreign project event via `details.contains(project.code)` | Removed substring matching of `details`. Enforced exact `{ entity: 'PROJECT', entityId: { in: [String(project.id), String(project.code)] } }` and explicit field selection (`id`, `entity`, `entityId`, `action`, `details`, `performedBy`, `timestamp`). | **PASSED** (Foreign audit event excluded) |
| **H06** | Default sample request returns unbounded rows (501 rows) | Bound default limit in `getProjectSamples` to 50 rows (maximum 500 rows). Added `X-Total-Count` header and wired full client-side pagination toolbar in `ProjectWorkspace.jsx` and `SamplesTab.jsx`. | **PASSED** (Default request capped at 50 rows, total returned) |

---

## 2. Elimination of Synthetic Data & Catalogue Error Handling

### A. AnalysisPlanTab.jsx
- **Synthetic Methods Removed**: Removed hardcoded `pH`, `texture`, and `MIR` plan item objects.
- **Fake Revision Removed**: Removed hardcoded "Revision 3 · Effective for orders created from 1 September 2026".
- **Authoritative Catalogue Data Binding**: Connects dynamically to `/api/config/groups`, `/api/config/analyses`, and `/api/config/gates`.
- **Explicit Failure & Retry Handling**: In `Promise.allSettled`, each endpoint status is checked individually. If `/api/config/groups` or `/api/config/analyses` rejects, an explicit error banner is rendered with a Retry button, rather than displaying an empty array as "No default analysis bundle configured".
- **Honest Empty State**: When catalogue queries succeed, displays truthful empty states ("No default analysis bundle configured" or "Bundle assigned but not defined in catalogue").

### B. ActivityTab.jsx & Dedicated Activity Endpoint
- **Fake Fallback Logs Removed**: Removed hardcoded `fallbackLogs` array containing fake `PROJECT_UPDATED` and `PROJECT_CREATED` events attributed to System.
- **Dedicated Server Endpoint**: Mounted `GET /api/projects/:id/activity` on `projectRoutes.js`.
- **Strict Isolation**: Enforces exact `entity: 'PROJECT'` and `entityId` equality; eliminates substring search on details to prevent foreign event leakage.
- **Truthful Status States**: Renders localized loading, permission denied (HTTP 403), error, and honest empty states ("No activity or governance events recorded for this project yet.").

### C. Client-Side Pagination & Samples Contract
- **Bounded Server Contract**: `GET /api/projects/:id/samples` defaults to 50 rows (maximum 500), returning total count in `X-Total-Count` header.
- **Real Pagination Controls**: `ProjectWorkspace.jsx` and `SamplesTab.jsx` manage `page`, `limit`, and `totalCount`.
- **No Silent Truncation**: Replaced hardcoded `.slice(0, 100)` with a pagination toolbar featuring Previous / Next buttons, page indicator (`Page X of Y`), and rows-per-page selector (25 / 50 / 100 / 200).

### D. Localization Alignment (5 Locales)
- Synced and added all missing `projects.samples`, `projects.plan`, and `projects.activity` keys across all 5 supported locale files:
  - `client/src/translations/en.json`
  - `client/src/translations/es.json`
  - `client/src/translations/es-419.json`
  - `client/src/translations/fr.json`
  - `client/src/translations/pt.json`

---

## 3. Truthful Reconciliation of PM-01 through PM-22

| Original ID | Severity | Original Contract Description | Status | Verification & Implementation Evidence |
|---|---|---|---|---|
| **PM-01** | P0 | Archive updates project and audit, then calls success with object in HTTP-status position; returns 500 but commits COMPLETED. | **COMPLETE** | Fixed in `projectController.js`: unified `validateProjectClosure`, correct HTTP status codes and response helper contracts. |
| **PM-02** | P0 | Trash clears `Sample.projectId` and writes `RESTORE:<id>` into `projectCode`. | **COMPLETE** | Fixed: projects cannot be deleted if they contain samples; sample unlinking completely eliminated. |
| **PM-03** | P0 | `/projects/:id/lab-access` does not verify actor may read project. Stats reveal target for foreign project. | **COMPLETE** | Fixed: explicit `canReadProject` check with resolved member labs on all sub-endpoints. |
| **PM-04** | P0 | Servicing manager gets both laboratories' samples from `/samples`, while `/stats` counts only their own lab. | **COMPLETE** | Fixed: `buildProjectSampleScope` enforces consistent lab isolation across `/samples` and `/stats`. |
| **PM-05** | P0 | Membership resolves through junction -> legacy JSON -> country inference; removing explicit labs reverts to country inference. | **COMPLETE** | Fixed: country fallback eliminated in `projectMembershipService.js`. |
| **PM-06** | P0 | Generic PUT accepts status, labId, assignedLabIds without lifecycle/relationship validation. | **PARTIAL** | Generic PUT validates project closure readiness when setting status to COMPLETED, ARCHIVED, or CLOSED. Further restrictions on directly editing labId/assignedLabIds via PUT remain in progress. |
| **PM-07** | P0 | National-role project creation accepts foreign owner lab; PROJECT_MANAGER can create but not update. | **COMPLETE** | Fixed: creator grant established, owner lab country validated against actor scope. |
| **PM-08** | P0 | Metadata update commits before audit; failure leaves name changed. | **COMPLETE** | Fixed: wrapped in Prisma transactions (`prisma.$transaction`). |
| **PM-09** | P1 | Received count vs total volume mislabelling on Projects page. | **COMPLETE** | Decoupled received count, target volume, and stage counts in backend and frontend. |
| **PM-10** | P1 | Statistics omit RELEASED from buckets; ReceivedCount uses `status != EXPECTED`. | **COMPLETE** | Fixed: defined explicit `postReceiptStatuses` and check `receptionDate != null || postReceiptStatuses.includes(st)`. |
| **PM-11** | P1 | Project creation catches failed sample insertion and returns success. | **COMPLETE** | Fixed: atomic transaction for project and sample registration. |
| **PM-12** | P1 | Manifest success arguments transposed in response helper. | **COMPLETE** | Fixed in `response.js` and `projectController.js`. |
| **PM-13** | P1 | Manifest parser blind reads, no preview, legacy conflicts skipped. | **PARTIAL** | Preview import endpoint `/api/projects/:id/imports/preview` with validation regex, foreign conflict masking, and ID format validation on commit implemented. Multi-lab manifest destination routing remains open. |
| **PM-14** | P1 | Project type controls draft-discard behavior; intake source provenance. | **PARTIAL** | Admissions check enforced on manifest imports (`PROJECT_ADMISSIONS_PAUSED`); intake provenance recorded, cross-system draft discard harmonization in progress. |
| **PM-15** | P1 | Kobo config selection chooses first config, sync path checks existence not admission. | **PARTIAL** | Admissions check added to manifest; Kobo config resolution improved; multi-lab asset mapping remains open for scheduled sync. |
| **PM-16** | P1 | Membership fragmented across Project.labId, ProjectLab, assignedLabIds, countries. | **PARTIAL** | Junction table prioritized across `projectController` and `projectMembershipService`; legacy columns maintained for backwards compatibility. |
| **PM-17** | P1 | Project manager list access uses explicit project codes, but stats builder had no project-grant branch. | **COMPLETE** | Fixed: `buildProjectSampleScope` explicitly handles `PROJECT_MANAGER` with `userProjects` grant check. |
| **PM-18** | P1 | Create/edit mixes scientific plan, lifecycle and governance; duplicate bundle labels. | **PARTIAL** | Analysis plan tab decoupled from lifecycle and dynamically wired to catalogue with failure handling; editing project settings modal mixing scientific plan with governance remains open. |
| **PM-19** | P1 | Project fetch depends on Promise.all and blank screens on secondary failure. | **PARTIAL** | Decoupled try/catches per section in `ProjectWorkspace.jsx`; `AnalysisPlanTab.jsx` explicitly handles rejected endpoints; secondary failure recovery across all components remains ongoing. |
| **PM-20** | P2 | Usability hardening, drawer UX, code-first rows. | **COMPLETE** | Replaced with responsive 6-tab workspace and improved project list. |
| **PM-21** | P1 | `?code=` notification links not resolved, sample manifest no pagination. | **PARTIAL** | Bounded pagination implemented on `/api/projects/:id/samples` with `X-Total-Count` and client pagination toolbar wired in `SamplesTab.jsx`; notification link resolution and manifest file pagination remain open. |
| **PM-22** | P1 | English-only lifecycle text despite 5-locale framework; ActivityTab fallback audit logs. | **PARTIAL** | Removed fallback audit logs, wired to real `/api/projects/:id/activity` with exact entity checks; localized all project keys across all 5 language files; reception/Kobo localized strings and edge cases remain ongoing. |
