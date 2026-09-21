# Contributor Issues Implementation & Verification Evidence Matrix

Work Package: `WP/contributor-issues-2026-09`  
Repository: `https://github.com/yigini/soilfer-lims`  
Implementation Lead: Antigravity  
Review & Communication Lead: Codex  
Baseline Commit: `762c46e`  
WP Checkpoint Commit: `e2fff7e` (feat(wp-country-kobo): checkpoint country kobo v2 policy, readers, migration, and capability gates)  
Date: 2026-09-21  

Status Key:
- **Reported**: Issue filed by contributor.
- **Reproduced**: Verified on relevant release/branch with concrete reproduction steps.
- **Implemented Locally**: Solution coded and passing local targeted contract/unit suites.
- **Verified**: Independently verified with tests, role journeys, and boundary integrity checks.
- **Released**: Deployed in authorized release SHA.
- **Closed**: Completed and officially closed with public evidence-backed explanation.

---

## Issue Evidence Ledger

| Issue / Work Item | Phase | Reported Problem | Reproduction Status | Fix Commit | Automated Tests | Release SHA | Verification Details | Residual Limitations | Closure Readiness |
|---|---|---|---|---|---|---|---|---|---|
| **WP-2 Country/Kobo v2** | 0 | Country project separation, Kobo explicit mapping, 0-to-0 preservation risk, client exception spoofing, operation binding | Reproduced & Verified | Current | `project_policy_v2.test.js` (26/26), `kobo_explicit_mapping.test.js` (25/25), `soilfer_country_migration.test.js` (3/3), `programme_readers_and_rollups.test.js` (9/9) | Pending | Populated Result/QC/Report fixtures verified (35,197 samples, 4 results, 3 QC batches, 3 reports); report checksums intact; HTTP exception verification enforced with strict operation binding (sample, project, lab, channel, non-empty reason) passing all 5 Monitor probes. | Production migration hold remains active. | Ready for Phase 0 closure |
| **#118** | 1 | QC batch inspection link disconnect, unhandled QC disposition, failed QC bypassing release gates | Reproduced & Verified | Current | `qc_disposition_release_gate.test.js` (20/20), client production build (`vite build` clean in 7.26s) | Pending | Canonical batch inspection returns actual control values, affected work items with canonical sample ID, original ID, lab ID, run profile, and notes. Unresolved failed QC strictly blocks sample approval (409) and report generation (409). Permitted disposition schema enforced; manager disposition override is atomic inside transaction, updates result flags while preserving non-QC invalidity flags (`MANUAL_INVALID`, `ORIGINALLY_INVALID`) and immutable released/superseded records; multi-step validity probe verified (originally invalid result stays invalid across FAIL -> PASS and PROCEED_WITH_WARNING); fails closed on DB errors; REANALYZE_BATCH updates work items to REANALYSIS_REQUIRED; audit.qc queue counts only unresolved batches. | Historical released results remain immutable. | Verified locally; ready for release verification |
| **#119** | 1 | Confusion between canonical, lab, and original IDs; 26-task fixture truncation; derived fractions vs ordered tasks | Reproduced & Verified | Current | `sample_assignment_identity.test.js` (8/8), client production build (`vite build` clean in 7.26s) | Pending | Disambiguated canonical UUID (`sampleId`), sample lab ID (`labId`), and field ID (`originalId`); honest task pagination (26-task fixture exposes all 26 tasks with honest pagination metadata); bidirectional texture equivalence (`TEXTURE` satisfied by 3 fractions `SAND, SILT, CLAY`, and composite `TEXTURE` satisfies fractions); independent gate evaluation respecting SKIPPED/WAIVED; sampleWorkspace extracts linked QC batches to gate final approval; unassignedCount calculated across all work items; ManagerQueue routes assign to `?tab=work` and review to `?tab=review`. | Manual assignment requires manager authority. | Verified locally; ready for release verification |
| **#121** | 2 | Label print dialog issues, printable content isolation, title/filename handling | Reproduced & Verified | Current | `label_print.test.js` (5/5), local browser CDP evidence (`run_browser_evidence.cjs` exit code 0), client build (`vite build` clean in 7.26s) | Pending | Dual standard (101x54mm) and compact (50x25mm) thermal label formats; 100% offline QR code generation via `qrcode`; portal to `#label-print-portal` at `document.body` with print CSS isolation hiding all standard web UI; dynamic `document.title = Label-${sanitizedSampleId}` with `afterprint` restoration; autoPrint trigger support; intake rejection gate (`canPrintLabel: false`). Verified in local headless Chrome with standard (75,034 bytes) and compact (46,046 bytes) PDFs. | Browser-controlled print filename is best effort. Physical printer checks pending. | Verified locally; ready for release verification |
| **#122** | 2 | LabMethods defaults failing or silently falling back across labs | Reproduced & Verified | Current | `lab_method_defaults.test.js` (6/6), client build (`vite build` clean in 7.26s) | Pending | Scoped loading/saving for target lab; honest empty states without cross-lab leakage; cross-lab modification and viewing rejected with 403; unauthorized roles without MANAGE_ANALYSES rejected with 403; unavailable or mismatched methodologies rejected with 400. Work item generation reflects per-lab override. | Requires lab manager or global admin role. | Verified locally; ready for release verification |
| **#128** | 2 | Workbench deep links broken for specific workItemId and sampleId | Reproduced & Verified | Current | `workbench_deep_link.test.js` (13/13), client build (`vite build` clean in 7.26s) | Pending | Central authorization precedes diagnostic checks; canonical sample ID resolution across column collisions; rejects contradictory cross-column sample collisions with 400 CONTRADICTORY_IDENTIFIERS; technician assignment validation (fail closed); outside-default-page status resolution (COMPLETED); cross-lab access rejected with 403 without leaking details; non-existent items/samples return 404; `WorkbenchShell` `activeTargetRef` retains target context across subsequent fetches without recursive retry loops; `WorksheetArea` highlights selected work item. | Forbidden items return 403 without leaking other labs' data. | Verified locally; ready for release verification |
| **#123** | 2 | Workbench search input and pagination issues | Reproduced & Verified | Current | `workbench_search.test.js` (8/8), client build (`vite build` clean in 7.26s) | Pending | Multi-field search across canonical UUID, sample lab ID, original field ID, analysis code, and analysis display name (e.g. "Soil Organic Carbon" -> SOC); truthful no-match state; clearing search restores full authorized queue; cross-lab search isolation strictly excludes other labs' items. | Server/client dual search filters. | Verified locally; ready for release verification |
| **#124** | 2 | Result reports search failing across client, project, sample queries | Reproduced & Verified | Current | `report_search.test.js` (7/7), client build (`vite build` clean in 7.26s) | Pending | Fixed Prisma schema relation crash on `projectId` search; multi-field search across client first/surname, project code/name, and sample identifiers (canonical UUID, lab ID, and field original ID); discoverable superseded report versions with `status=SUPERSEDED` and `status=ALL` while defaulting to `PUBLISHED`; UI status filter pills with distinct superseded badge; cross-lab access isolation. | Scoped to authorized projects/labs. | Verified locally; ready for release verification |
| **#125** | 3 | Inventory aggregation anomalies, expired lots vs usable stock confusion | Reproduced & Verified | Current | `inventory_aggregation.test.js` (9/9), client build (`vite build` clean in 7.26s) | Pending | Usable stock strictly aggregates available, non-expired lots; expired lots tracked separately without precedence masking; items at or below reorder threshold flagged as low stock; missing quantities represented truthfully as null (not 0); GET /api/inventory/alerts is 100% pure (zero DB mutations); FEFO strictly excludes expired lots. UI displays OUT OF STOCK and EXPIRED badges concurrently without mutual masking. | Display/aggregation fix; zero schema changes. | Verified locally; ready for release verification |
| **#117** | 3 | Failed reception criterion not persisting or reflecting in UI | Reproduced & Verified | Current | `reception_compliance.test.js` (9/9), client build (`vite build` clean in 7.26s) | Pending | Authoritative saved state reflects OK/N/A/FAIL with visible badge indicators; non-conformance flag auto-syncs with failed checklist items; rejected sample intake persists checklist and ncReason in receptionData and metadata.nonConformance, transitioning to RECEIVED_REJECTED; inspecting or resuming draft rehydrates checklistData truthfully. | Non-conformance requires explanation note. | Verified locally; ready for release verification |
| **#113** | 3 | Reception compliance checklist and redundant/unauthorized dispositions | Reproduced & Verified | Current | `reception_compliance.test.js` (9/9), client build (`vite build` clean in 7.26s) | Pending | Reception compliance checklist evaluation enforced: all-pass admits sample routinely without redundant gates; permitted N/A (CoC on walk-in) accepted; prohibited N/A (container/label/condition/quantity) rejected with 400 INVALID_CHECKLIST_NA; incomplete checklist rejected with 400 INCOMPLETE_COMPLIANCE_CHECKLIST; failed check blocks routine acceptance for reception staff (403 COMPLIANCE_FAILURE_EXCEPTION_REQUIRED); staff self-authorization strictly prohibited; manager exception required to admit with ADMITTED_WITH_EXCEPTION in history; draft save preserves partial/failed checks without exception. | Manager or admin exception required to admit failed compliance items. | Verified locally; ready for release verification |
| **#120** | 4 | Dashboard vs manager task list conflation; large field registry overwhelming queues | Open | Pending | `tests/contracts/dashboard_manager_views.test.js` (Planned) | Pending | Daily lab queue defaults to physically received/in-process; expected/field registry separated; true pending counts. | Provenance and Kobo records preserved. | Open |
| **#114** | 4 | Map centering issues, lack of fullscreen, map layer fallbacks | Open | Pending | `tests/contracts/map_view.test.js` (Planned) | Pending | Sample coordinates precedence -> lab location -> neutral fallback; fullscreen; compliant tile fallback. | No unsolicited device geolocation; no paid tile keys. | Open |
| **#115** | 4 | Navigation order not reflecting laboratory journey | Open | Pending | `tests/contracts/navigation_order.test.js` (Planned) | Pending | Journey order: Reception -> Workbench -> QA -> Reporting; role-aware; preserves paths and deep links. | Role permissions unchanged. | Open |
| **#116** | 4 | Hardcoded English strings in Spanish/multilingual UI | Open | Pending | `tests/contracts/localization_integrity.test.js` (Planned) | Pending | Extracted strings in en, es, es-419, fr, pt; domain term consistency ("Lista de tareas"); plural rules. | Scientific codes remain standard. | Open |
| **#126** | 4 | Raw usernames displayed instead of proper names in messages/tasks | Open | Pending | `tests/contracts/user_display_name.test.js` (Planned) | Pending | Proper name with username fallback; historical audit attribution preserved. | Passwords/private profile data excluded. | Open |
| **#102** | 5 | Physical mobile device testing (iOS Safari, Android Chrome) | Open | Pending | Mobile test execution sheet (Planned) | Pending | Real-device testing required for workspace tabs, sticky headers, virtual keyboard, camera permissions. | Emulation alone is insufficient. Remains open for real device checks. | Open (Human/Hardware) |
| **#103** | 5 | User membership reconciliation & country access grants | Open | Pending | Read-only reconciliation ledger (Planned) | Pending | Aligned with country migration; explicit owner junctions separated from central programme servicing. | Subject to production migration hold & reviewed change-set. | Open (Governance) |
| **#104** | 5 | Separate Laboratory Dashboard sample count discrepancy | Open | Pending | Verification report & reporter confirmation (Planned) | Pending | Historical count confirmed (3,580 on 15 Sept); read-only inspection; external pipeline coordination with Luis. | Separate external application; no auto-backfill into LIMS. | Open (External/Reporter) |

---

## Detailed Acceptance Records

### Phase 0: Acceptance Reconciliation & Operation Binding
- **Tests Executed**:
  - `server/tests/contracts/soilfer_country_migration.test.js` (3/3 passed): 35,197 samples, 4 results, 3 QC batches, 3 reports, zero orphaned results, SHA-256 report checksum conservation.
  - `server/tests/contracts/project_policy_v2.test.js` (26/26 passed):
    - Client-supplied `isStoredApprovalVerified` booleans strictly stripped at HTTP trust boundary.
    - Direct manager self-authorization verified.
    - Stored approval verified against persisted `SampleAmendment`.
    - Cross-sample mismatch fails closed (`APPROVAL_SAMPLE_MISMATCH`).
    - Cross-project mismatch fails closed (`APPROVAL_PROJECT_MISMATCH`).
    - Cross-lab mismatch fails closed (`APPROVAL_LAB_MISMATCH`).
    - Empty reason rejected (`APPROVAL_EMPTY_REASON`).
    - Channel purpose enforced (rejects clerical/scientific/order amendments for admission exception).
    - Batch sampleIds bound: partial batch coverage fails closed (`APPROVAL_BATCH_NOT_COVERED`).
    - Mandatory target sample identity enforced (`TARGET_SAMPLE_REQUIRED`).
    - Mandatory channel identity enforced (`CHANNEL_REQUIRED`).

### Phase 1: Issue #118 QC Batch Inspection, Disposition & Release Gates
- **Tests Executed**:
  - `server/tests/contracts/qc_disposition_release_gate.test.js` (10/10 passed):
    1. `GET /api/qc/batches/:id` returns canonical batch with actual control values, affected items, run profile, and enforces lab scope (cross-lab returns 403).
    2. Unresolved `QC_FAIL` batch strictly blocks downstream sample approval (409) and report publication (409 with code `QC_BATCH_FAILED`).
    3. `POST /api/qc/batches/:id/disposition` enforces manager role, scope, non-empty justification reason, logs transactional audit entry (`action: 'QC_DISPOSITION'`), and appends to batch history.
    4. Resending identical manager disposition is idempotent and does not create duplicate audit entries.
    5. Manager disposition override (`PROCEED_WITH_WARNING`) unblocks sample approval and report publication eligibility.
    6. Dispositioned batch clears from actionable pending exception queues (`manager.exceptions`, `audit.qc`, `master.exceptions`) while remaining permanently in history.
    7. Unknown disposition decision is rejected with 400 `INVALID_DISPOSITION_DECISION`.
    8. `flagBatchResults` preserves non-QC invalidity flags (`MANUAL_INVALID`) and protects immutable released/superseded records.
    9. `REANALYZE_BATCH` updates associated workItems to `REANALYSIS_REQUIRED` atomically inside transaction.
    10. `audit.qc` queue `qcFailedCount` strictly excludes dispositioned batches (`disposition: null`).
- **Client Build**:
  - Production build via `npm run build` (`vite build`) passed in 15.78s with 0 errors.
  - New component: `client/src/components/qc/BatchInspectionModal.jsx`.
  - Integrated into `client/src/pages/QADashboard.jsx` and `client/src/pages/ManagerQueue.jsx` via `?batchId=` URL search param and row Inspect actions.

### Phase 1: Issue #119 Sample and Assignment Identity, Pagination, and Server-Side Readiness
- **Tests Executed**:
  - `server/tests/contracts/sample_assignment_identity.test.js` (8/8 passed):
    1. 26-task fixture exposes all 26 tasks with honest totals and pagination metadata (no silent 20-item truncation); items enriched with `sampleLabId`, `originalId`, `projectCode`.
    2. Disambiguates canonical ID (`sampleId`), sample lab ID (`labId`), and field original ID (`originalId`) across dashboard review queue (`manager.review`) and submissions.
    3. Texture equivalence verified: bidirectional equivalence (`TEXTURE` satisfied by 3 accepted fractions `SAND`, `SILT`, `CLAY`, and composite `TEXTURE` satisfies individual fraction requirement) without false `ORDER_TASK_MISMATCH`; derived fractions tagged with `isDerived: true` and `derivedFrom: 'TEXTURE'`.
    4. Final approval readiness independently enforced on server: rejects premature approval with 409 and blockers; requires gate completion (`DRYING`, `PREPARATION`) and accepted analyses/fractions.
    5. Cross-lab assignment is strictly rejected with 403 `CROSS_LAB_ASSIGNMENT_DENIED` across bulk assign and single item assign.
    6. Workspace projection exposes accurate capabilities and nextAction reflecting readiness state (e.g. `ASSIGN` for unassigned tasks, `APPROVE` when ready).
    7. Operational gates evaluated independently and respect `SKIPPED`, `WAIVED`, `NOT_APPLICABLE` without triggering `PREREQUISITE_GATE_INCOMPLETE`.
    8. Workspace projection extracts linked QC batches and blocks final approval on unresolved QC failure.
- **Client Build**:
  - Production build via `npm run build` (`vite build`) passed in 15.78s with 0 errors.
  - `ManagerQueue.jsx`: Method filter via `?analysis=`, 100-item assign limit to prevent silent truncation, distinct Lab ID / Field ID / UUID rendering, `returnTo` queue context preservation, honest pagination units (`Page X of Y (Z tasks across W samples)`), card routing to `?tab=work` for assign and `?tab=review` for review.
  - `SampleDetail.jsx`: Context-aware back button (`returnTo`), final approval disabled button with explanatory tooltip when not eligible, ordered analyses counter with derived fractions notation.
  - `WorkItemsTable.jsx`: `Derived (TEXTURE)` badge for fraction tasks.

### Phase 2: Issue #121 Sample Label Printing, Sizing & Offline QR Code Isolation
- **Tests Executed**:
  - `server/tests/contracts/label_print.test.js` (5/5 passed):
    1. `GET /api/public/branding` provides branding configuration without requiring auth.
    2. Workspace projection enforces `canPrintLabel` capability gate based on intake rejection (`false` for `RECEIVED_REJECTED` and `REJECTED`, `true` for standard processing).
    3. Pre-arrival `EXPECTED` sample allows printing with `'Pending'` permanent lab identifier and original field ID in QR.
    4. Label format specifications match thermal printer physical dimensions (Standard: 101×54mm, Compact: 50×25mm).
    5. Sanitizes sample identifier for `document.title` print naming isolation (`Label-${sanitizedSampleId}`).
- **Local Browser CDP Evidence (`server/scripts/run_browser_evidence.cjs`)**:
  - Execution exit code: 0 (verified in headless Chrome via bounded 8s CDP automation).
  - Standard Label PDF generated: `artifacts/evidence-journeys/standard_label_101x54mm.pdf` (75,034 bytes, `%PDF-` header verified, dimensions 101x54mm).
  - Compact Label PDF generated: `artifacts/evidence-journeys/compact_label_50x25mm.pdf` (46,046 bytes, `%PDF-` header verified, dimensions 50x25mm).
  - React hook order integrity verified across modal close and re-open (zero hook ordering crashes).
  - 105 unassigned tasks pagination verified: Page 1 ("Page 1 of 2 (105 tasks across 34 samples)") -> Page 2 ("Page 2 of 2 (105 tasks across 2 samples)").
  - Skipped drying gate approval card verified visible with badge `DRY: SKIPPED`.
- **Client Implementation**:
  - `client/src/components/common/LabelPrintDialog.jsx`:
    - Portal rendering to `#label-print-portal` at `document.body` outside modal tree with `@media print` CSS isolation hiding all standard web UI.
    - 100% offline QR code generation via `qrcode` (no third-party network dependency).
    - Dual format toggle: Standard (101×54mm / 4"×2") and Vial/Tube Compact (50×25mm).
    - Batch checklist with "Accepted Only" filter and individual checkboxes.
    - Dynamic print title management (`Label-${sanitizedSampleId}` or `Labels-Batch-${count}`) restored on `afterprint`.
    - Auto-print trigger support.

### Phase 2: Issue #122 Lab Methodology Defaults & Isolation
- **Tests Executed**:
  - `server/tests/contracts/lab_method_defaults.test.js` (6/6 passed):
    1. Setting Lab A default to Dumas updates Lab A defaults API without affecting Lab B (which falls back to Walkley-Black).
    2. New work items in Lab A receive Dumas combustion while Lab B receives Walkley-Black.
    3. Cross-lab access denial: Lab A manager cannot view or modify Lab B defaults (HTTP 403 `FORBIDDEN`).
    4. Unauthorized role without `MANAGE_ANALYSES` cannot modify lab defaults (HTTP 403 `FORBIDDEN`).
    5. Supplying an unavailable or mismatched methodology ID is rejected (HTTP 400).
    6. Fresh lab with no overrides exhibits honest empty state without cross-lab leakage.

### Phase 2: Issue #128 Workbench Deep Link & Contradictory Identifiers
- **Tests Executed**:
  - `server/tests/contracts/workbench_deep_link.test.js` (6/6 passed):
    1. Valid deep link with `workItemId` and matching `sampleId` resolves and includes target work item in queue.
    2. Valid deep link for an item with `COMPLETED` status outside default `'my_work'` view resolves successfully.
    3. Contradictory identifiers: `workItemId` not belonging to `sampleId` rejected with HTTP 400 `CONTRADICTORY_IDENTIFIERS`.
    4. Cross-lab access denial: Lab A technician requesting Lab B work item rejected with HTTP 403 `FORBIDDEN` without leaking other labs' data.
    5. Non-existent `workItemId` returns HTTP 404 `WORK_ITEM_NOT_FOUND`.
    6. Non-existent `sampleId` returns HTTP 404 `SAMPLE_NOT_FOUND`.
- **Client Implementation**:
  - `client/src/components/workbench/WorkbenchShell.jsx`: passes `workItemId` and `sampleId` to `/api/workbench/queue`; handles 400, 403, 404 error responses with toast explanations and fallback to general queue.
  - `client/src/components/workbench/WorksheetArea.jsx`: accepts `initialWorkItemId` prop and prioritizes it in `selectedItemId` so deep-linked tasks are immediately selected and highlighted in the worksheet.

### Phase 2: Issue #123 Workbench Multi-Field Search & Honest Empty State
- **Tests Executed**:
  - `server/tests/contracts/workbench_search.test.js` (8/8 passed):
    1. Search by canonical sample UUID returns matching item in queue.
    2. Search by sample `labId` returns matching work item.
    3. Search by field `originalId` returns matching work item.
    4. Search by analysis code (e.g. `PH`) filters work items to that method.
    5. Search by analysis display name (e.g. `"Soil Organic Carbon"`) resolves to SOC work items.
    6. Non-matching search returns empty array with honest state.
    7. Clearing search (empty search param) restores full authorized queue.
    8. Cross-lab search isolation: searching for a shared project/method term strictly excludes work items from other laboratories.
- **Client Implementation**:
  - `client/src/components/workbench/WorkbenchShell.jsx`: wired `queueSearchQuery` state with `WorkbenchQueue`.
  - `client/src/components/workbench/WorkbenchQueue.jsx`: multi-field filtering across sampleDisplayId, labId, canonical sampleId, field originalId, workItemId, projectCode, and analysis name; truthful empty state rendering `No work items match "{searchQuery}".` when search is active.

### Phase 2: Issue #124 Result Reports Search & Discoverable Superseded Versions
- **Tests Executed**:
  - `server/tests/contracts/report_search.test.js` (7/7 passed):
    1. Default search returns only `PUBLISHED` reports in authorized lab.
    2. Searching with `status=SUPERSEDED` discovers historical superseded report versions.
    3. Searching with `status=ALL` discovers all report versions (both published and superseded).
    4. Searching by client name filters accurately across first name and surname.
    5. Searching by project code (`projectId`) filters to that project without Prisma relation crashes (fixed missing relation bug on `Report`).
    6. Searching by original field ID (`originalId`) finds the corresponding report.
    7. Cross-lab isolation: Lab A manager searching shared client name does not disclose Lab B reports.
- **Client Implementation**:
  - `client/src/pages/ResultReports.jsx`: added status filter pills (`Published`, `Superseded`, `All Versions`); bound status to search form and pagination controls; distinct `SUPERSEDED` badge rendered in table rows.

### Phase 2 Hardening (Review 1506 Resolutions)
- **#128 Authorization Precedence, Identifier Resolution & Stability**:
  - `server/controllers/workbenchController.js`: Centralized authorization before diagnostic checks; resolved canonical sample ID; rejected cross-column collisions with 400 `CONTRADICTORY_IDENTIFIERS`.
  - `server/utils/scopeGuard.js`: Added fail-closed checks on inactive users, missing lab for lab roles, technician assignment for WorkItem, deep country matching for MASTER_USER.
  - `client/src/components/workbench/WorkbenchShell.jsx`: Stabilized `fetchQueue` dependencies; added `activeTargetRef` and capped 400/403/404 retry fallback to 1 attempt.
  - Tests: `workbench_deep_link.test.js` expanded from 6/6 to 13/13 passing tests.
- **#118 Multi-Step Validity Probe & Immutability**:
  - `server/services/qcService.js`: Retained independent validity provenance (`ORIGINALLY_INVALID`); protected `SUPERSEDED` and `PUBLISHED` reports; failed closed on DB errors.
  - Tests: `qc_disposition_release_gate.test.js` expanded from 10/10 to 20/20 passing tests.
- **Production Entry Cleanliness**:
  - `client/src/main.jsx`: Removed all test-only `window.*` globals (`React`, `ReactDOM`, `axios`, contexts).
  - `server/data/help/RELEASE_MANIFEST_v1.json`: Restored original published timestamp (`2026-09-15T11:19:14.218Z`).

### Phase 3: Issue #125 Inventory Aggregation, Lifecycle & Pure GET Endpoints
- **Tests Executed**:
  - `server/tests/contracts/inventory_aggregation.test.js` (9/9 passed):
    1. Zero stock fixture: zero or no lots yields `usableStock=0`, `isOutOfStock=true`, `isLowStock=false`.
    2. Positive stock below threshold: `usableStock=15`, `reorderPoint=20` yields `isLowStock=true`, `isOutOfStock=false`.
    3. Positive stock at threshold: `usableStock=20`, `reorderPoint=20` yields `isLowStock=true` (at or below threshold boundary).
    4. Positive stock above threshold: `usableStock=30`, `reorderPoint=20` yields `isLowStock=false`, `isOutOfStock=false`.
    5. Missing value: lot with `null` quantity is not coerced to 0; yields `hasMissingQuantity=true` and `usableStock=null`.
    6. All-expired lots: yields `usableStock=0`, `isOutOfStock=true`, `hasExpired=true` with separate `expiredStock`.
    7. Mixed lots: both low-stock / out-of-stock and expired conditions remain visible concurrently without precedence masking.
    8. `GET /api/inventory/alerts` is 100% pure and produces zero database mutation side-effects.
    9. `GET /api/inventory/fefo/:itemId` strictly filters out expired lots from recommendations.
- **Backend Implementation**:
  - `server/controllers/inventoryController.js`:
    - Implemented `computeItemStockAggregation(item, now)` pure aggregation logic.
    - Updated `getItems` and `getItem` to use `computeItemStockAggregation`.
    - Removed side-effect database updates (`prisma.inventoryLot.update`) from `getAlerts`.
    - Updated `getFEFO` to omit expired lots.
- **Client Implementation**:
  - `client/src/pages/Inventory.jsx`:
    - Main inventory table renders usable stock (`—` if missing), `OUT OF STOCK` and `EXPIRED` badges simultaneously without mutual masking.
    - `ItemDrawer` displays distinct usable stock, expired stock, and missing quantity labels.
    - `AlertBanner` renders missing quantity count alongside low stock and expired counts.

### Phase 3: Issue #117 & #113 Reception Non-Conformance & Compliance Checklist Gate
- **Tests Executed**:
  - `server/tests/contracts/reception_compliance.test.js` (9/9 passed):
    1. All-pass checklist accepted routinely by reception staff without redundant gates.
    2. Walk-in intake with N/A for chain of custody is accepted.
    3. Prohibited N/A on container or label is rejected with 400 `INVALID_CHECKLIST_NA`.
    4. Incomplete checklist with unanswered items is rejected with 400 `INCOMPLETE_COMPLIANCE_CHECKLIST`.
    5. Failed check blocks routine acceptance for reception staff with 403 `COMPLIANCE_FAILURE_EXCEPTION_REQUIRED`.
    6. Reception staff self-authorization on failed check is rejected with 403 `COMPLIANCE_FAILURE_EXCEPTION_REQUIRED`.
    7. Authorized laboratory manager admits sample with manager exception, recording `ADMITTED_WITH_EXCEPTION` in history and `complianceException` in metadata.
    8. Rejecting sample persists checklist and `ncReason` in `receptionData` and metadata, transitioning to `RECEIVED_REJECTED`.
    9. Draft save preserves partial/failed checklist without requiring exception.
- **Backend Implementation**:
  - `server/controllers/receptionController.js`:
    - Implemented `evaluateChecklistCompliance(checklist, options)` evaluating required criteria (`container`, `label`, `quantity`, `condition`), permitting CoC N/A only for walk-in.
    - In `processIntake` (acceptance): enforced compliance gate. If any check fails, routine acceptance is blocked (403) unless an authorized manager exception is verified via `projectPolicyService.resolveAndVerifyExceptionRecord`.
    - In `processIntake` (rejection): persists `receptionData` alongside `metadata.nonConformance` on `RECEIVED_REJECTED`.
- **Client Implementation**:
  - `client/src/components/reception/ComplianceChecklist.jsx`:
    - Auto-syncs nonConformance state with presence of failed checklist items.
    - Added accessible `role="radiogroup"` and `role="radio"`, `aria-checked`, and visible badges for Failed and OK states.
    - Renders saved FAIL state authoritatively with failure icon and notes input.
  - `client/src/pages/Reception.jsx`:
    - `populateDeskFacts` rehydrates saved checklist from `receptionData?.checklist || metadata?.nonConformance?.checklist`.
    - `handleLookup` rehydrates `checklistData` when resuming draft or inspecting sample.
    - `handleSubmit` blocks acceptance for non-manager staff if checklist has failed checks, prompting for manager exception or rejection.


