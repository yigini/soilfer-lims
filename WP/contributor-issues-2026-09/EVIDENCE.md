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
| **#125** | 3 | Inventory aggregation anomalies, expired lots vs usable stock confusion | Reproduced & Verified | Current | `inventory_aggregation.test.js` (10/10 passed), client build (`vite build` clean in 15.70s) | Pending | Usable stock strictly aggregates available, non-expired lots; expired lots tracked separately without precedence masking; items at or below reorder threshold flagged as low stock; missing quantities represented truthfully as null (not 0); usableMissingQuantityLotCount tracked so mixed known/unknown lots treat usable stock as a subtotal and prevent false OUT_OF_STOCK assertions; GET /api/inventory/alerts is 100% pure (zero DB mutations); FEFO strictly excludes expired lots. UI displays OUT OF STOCK and EXPIRED badges concurrently without mutual masking. | Display/aggregation fix; zero schema changes. | Verified locally; ready for release verification |
| **#117** | 3 | Failed reception criterion not persisting or reflecting in UI | Reproduced & Verified | Current | `reception_compliance.test.js` (18/18 passed), client build (`vite build` clean in 15.70s) | Pending | Authoritative saved state reflects OK/N/A/FAIL with visible badge indicators; non-conformance flag auto-syncs with failed checklist items; rejected sample intake persists checklist and ncReason in receptionData and metadata.nonConformance, transitioning to RECEIVED_REJECTED; inspecting or resuming draft rehydrates checklistData truthfully. | Non-conformance requires explanation note. | Verified locally; ready for release verification |
| **#113** | 3 | Reception compliance checklist and redundant/unauthorized dispositions | Reproduced & Verified | Current | `reception_compliance.test.js` (18/18 passed), client build (`vite build` clean in 15.70s) | Pending | Reception compliance checklist evaluation enforced upfront before sample creation, guaranteeing zero DB mutations on 400 rejection: all-pass admits sample routinely without redundant gates; permitted N/A (CoC on walk-in only) accepted; prohibited N/A (formal shipment CoC, or container/label/condition/quantity) rejected with 400 INVALID_CHECKLIST_NA; incomplete, empty, or omitted checklist rejected with 400 INCOMPLETE_COMPLIANCE_CHECKLIST; legacy alias normalization fails closed on conflicting aliases and tracks unknown keys; failed check blocks routine acceptance for reception staff (403 COMPLIANCE_FAILURE_EXCEPTION_REQUIRED); staff self-authorization strictly prohibited; manager exception required to admit with ADMITTED_WITH_EXCEPTION in history; draft save preserves partial/failed checks without exception. | Manager or admin exception required to admit failed compliance items. | Verified locally; ready for release verification |
| **#120** | 4 | Dashboard vs manager task list conflation; large field registry overwhelming queues | Reproduced & Implemented Locally | Current | `dashboard_manager_views.test.js` (7/7 passed), client production build (`vite build` clean in 6.74s) | Pending | Daily lab queue defaults to physically received and active samples (`view=daily`); field arrivals awaiting intake separated (`view=expected`); full field registry accessible across all stages (`view=registry`); truthful view counts returned in `views` and `facets.views`; manager exceptions lane (`/api/dashboard/queues/manager.exceptions`) surfaces only unresolved QC failures and clears resolved dispositions; honest pagination units (`QC batches`, `tasks`, `submissions`, `samples`). | Provenance and Kobo records preserved without data loss. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#114** | 4 | Map centering issues, lack of fullscreen, map layer fallbacks | Reproduced & Implemented Locally | Current | `map_view.test.js` (9/9 passed), client production build (`vite build` clean in 6.74s) | Pending | Centering precedence hierarchy: valid sample GPS coordinates -> configured laboratory location -> neutral global fallback `[0, 20]`; viewport centering never saved as sample coordinates without deliberate confirmation; HTML5 Fullscreen toggle integrated into map header with Leaflet container fixed-overlay styling; Esri World Imagery satellite tile provider configured with required legal attribution and zero paid keys; graceful fallback to standard OpenStreetMap on satellite tile error. | Physical printer/GPS field checks pending. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#115** | 4 | Navigation order not reflecting laboratory journey | Reproduced & Implemented Locally | Current | `navigation_order.test.js` (5/5 passed), client production build (`vite build` clean in 6.74s) | Pending | Reorganized navigation items into canonical laboratory journey sequence: Dashboard (`/`) -> Reception (`/reception`) -> Samples Registry (`/samples`) -> Technician Work & Workbench (`/my-work`, `/workbench`) -> Manager Task List (`/manager-queue`) -> Quality Assurance (`/qa`) -> Result Reports (`/result-reports`) -> Supporting Modules (Spectral, Inventory, Equipment, Projects, Admin, About). Role-aware filtering strictly enforced; all existing route paths, deep links, and permission checks preserved. | Role permissions unchanged. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#116** | 4 | Hardcoded English strings in Spanish/multilingual UI | Reproduced & Implemented Locally | Current | `localization_and_user_display.test.js` (12/12 passed), client production build (`vite build` clean in 6.74s) | Pending | Removed hardcoded English strings across dashboard, manager task list, QA, and navigation in all 5 supported locales (`en`, `es`, `es-419`, `fr`, `pt`). Standardized manager action terminology to "Lista de tareas" in Spanish/Portuguese and "Manager Task List" in English; localized queue units (`batches`, `tasks`, `submissions`, `samples`, `acrossSamples`), map controls (`satellite`, `standard`, `fullscreen`), and view selector pills; verified scientific codes (`SOC`, `PH`, `SAND`, `SILT`, `CLAY`, `TN`, `CEC`) remain untranslated scientific symbols. | Translation files maintain valid JSON syntax. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#126** | 4 | Raw usernames displayed instead of proper names in messages/tasks | Reproduced & Implemented Locally | Current | `localization_and_user_display.test.js` (12/12 passed), client production build (`vite build` clean in 6.74s) | Pending | Resolved stored proper display name (`user.name`) with safe username fallback across message lists, conversation threads, notification toasts, task assignment dropdowns, and header drawers; leading/trailing whitespace safely trimmed; historical/deactivated users and missing names fall back gracefully; audit logs and reviewer attributions retain stable immutable username identifiers without alteration. | Passwords and private profile data excluded. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#102** | 5 | Physical mobile device testing (iOS Safari, Android Chrome) | Open | Pending | Mobile device testing execution sheet (`docs/test-sheets/mobile-device-testing.md`) | Pending | Real physical device testing sheet established covering touch targets, virtual keyboard pan/zoom, horizontal scrolling, sticky headers, camera permissions, and offline draft sync. Emulation alone is insufficient. | Requires physical device validation on deployed release candidate. | Open (Human/Hardware Testing Pending) |
| **#103** | 5 | User membership reconciliation & country access grants | Open | Pending | Read-only discrepancy ledger (`docs/governance/membership-reconciliation-ledger.md`) | Pending | Aligned with country migration; explicit owner junctions separated from central servicing staff; fail-closed authorization comparison documented. Production data mutations remain behind reviewed change-set/backup/rollback gate. | Under production migration hold. | Open (Governance / Migration Gate Active) |
| **#104** | 5 | Separate Laboratory Dashboard sample count discrepancy | Open | Pending | External reconciliation protocol (`docs/governance/external-dashboard-reconciliation.md`) | Pending | Reconciled metric definitions (Field Registry vs Expected vs Active Lab Work); historical 15 Sept Guatemala count confirmed (3,580); architectural boundary documented (separate downstream application; no automatic synthetic backfill into LIMS). | Requires reporter confirmation from Luis. | Open (External Coordination Pending) |

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
  - `server/tests/contracts/reception_compliance.test.js` (18/18 passed):
    1. All-pass checklist accepted routinely by reception staff without redundant gates.
    2. Walk-in intake with N/A for chain of custody is accepted.
    3. Prohibited N/A on container or label is rejected with 400 `INVALID_CHECKLIST_NA`.
    4. Incomplete checklist with unanswered items is rejected with 400 `INCOMPLETE_COMPLIANCE_CHECKLIST`.
    5. Failed check blocks routine acceptance for reception staff with 403 `COMPLIANCE_FAILURE_EXCEPTION_REQUIRED`.
    6. Reception staff self-authorization on failed check is rejected with 403 `COMPLIANCE_FAILURE_EXCEPTION_REQUIRED`.
    7. Authorized laboratory manager admits sample with manager exception, recording `ADMITTED_WITH_EXCEPTION` in history and `complianceException` in metadata.
    8. Rejecting sample persists checklist and `ncReason` in `receptionData` and metadata, transitioning to `RECEIVED_REJECTED`.
    9. Draft save preserves partial/failed checklist without requiring exception.
    10. Rejects intake with 400 when checklist is omitted on final acceptance, asserting zero sample/history database mutations.
    11. Rejects intake with 400 when checklist items are empty object, asserting zero sample mutations.
    12. Rejects intake with 400 `INVALID_CHECKLIST_NA` when Chain of Custody is marked N/A on formal shipment (`isWalkIn: false`).
    13. Probe A: `{ items: { label: "FAIL" } }` returns `isComplete: false, isPassed: false, failedItems: ['label']`.
    14. Probe B: `{ items: { labelLegible: true } }` returns `isComplete: false, isPassed: false, 4 unanswered`.
    15. Probe C: `{ items: { unknown: true } }` returns `isComplete: false, isPassed: false, 5 unanswered, unknown tracked`.
    16. Probe D: Fully assessed legacy boolean payload resolves to complete and passed.
    17. Probe E: Conflicting aliases fail closed (e.g. `containerIntact: true` but `bagIntact: false`).
    18. Probe F: Omitted / null / empty returns `isProvided: false, isComplete: false, isPassed: false`.
- **Backend Implementation (Review 1629 Hardening)**:
  - `server/controllers/receptionController.js`:
    - Checklist compliance evaluation moved upfront in `processIntake` before `prisma.sample.create(...)` and before any database mutation, guaranteeing zero DB mutations on 400 rejection.
    - Explicit alias normalization per criterion:
      - `container`: `container`, `containerIntact`, `bagIntact`.
      - `label`: `label`, `labelLegible`.
      - `quantity`: `quantity`, `quantitySufficient`, `massAdequate`.
      - `condition`: `condition`, `conditionGood`, `noLeakage`.
      - `coc`: `coc`, `cocPresent`.
    - Conflicting aliases fail closed (`FAIL`); unknown keys tracked in `unknownItems`.
    - CoC N/A policy strictly enforced: allowed only when `isWalkIn: true`. If `!isWalkIn` and `coc === 'NA'`, returns 400 `INVALID_CHECKLIST_NA`.
  - `server/controllers/inventoryController.js`:
    - Tracked `usableMissingQuantityLotCount`; when usable stock has mixed numeric and null quantities, treats usable stock as a subtotal (`isUsableStockSubtotal = true`).
    - Prevented `0 + unknown` from incorrectly asserting `isOutOfStock = true`. Requires `usableLots.length === 0 || (usableStock === 0 && usableMissingQuantityLotCount === 0)`.
- **Client Implementation**:
  - `client/src/components/reception/ComplianceChecklist.jsx`:
    - Auto-syncs nonConformance state with presence of failed checklist items.
    - CoC N/A option conditionally enabled only when drop-off mode is walk-in (`isWalkIn`).
    - Added accessible `role="radiogroup"` and `role="radio"`, `aria-checked`, and visible badges for Failed and OK states.
    - Renders saved FAIL state authoritatively with failure icon and notes input.
  - `client/src/pages/Reception.jsx`:
    - `populateDeskFacts` rehydrates saved checklist from `receptionData?.checklist || metadata?.nonConformance?.checklist`.
    - `handleLookup` rehydrates `checklistData` when resuming draft or inspecting sample.
    - `handleSubmit` blocks acceptance for non-manager staff if checklist has failed checks, prompting for manager exception or rejection.

---

### Phase 4: Issue #120 Dashboard, Manager Task List & Field Registry Separation
- **Tests Executed**:
  - `server/tests/contracts/dashboard_manager_views.test.js` (7/7 passed):
    1. `GET /api/samples?view=daily` defaults daily lab queue to physically received and active samples.
    2. `GET /api/samples?view=expected` returns field arrivals awaiting intake.
    3. `GET /api/samples?view=registry` returns full field registry across all stages without omitting records.
    4. Response provides reconciled view counts in `views` and `facets.views`.
    5. Manager exceptions queue (`/api/dashboard/queues/manager.exceptions`) surfaces only unresolved QC failures and clears resolved dispositions.
    6. Cross-lab isolation: Manager B cannot view Lab A samples or exceptions (HTTP 403 / empty filtered view).
    7. Explicit status query parameter overrides view parameter without regression.
- **Backend Implementation**:
  - `server/controllers/sampleController.js`: Added `view` query parameter support (`daily`, `expected`, `registry`) with status filtering (`RECEIVED`, `IN_ANALYSIS`, `EXPECTED`, etc.) and view count aggregations in list responses.
- **Client Implementation**:
  - `client/src/pages/Samples.jsx`: Added view selector tabs (`Daily Lab Work`, `Expected Arrivals`, `Full Field Registry`) with badge counts; bound to `view` query parameter.
  - `client/src/pages/ManagerQueue.jsx`: Clear separation of pending manager action items from historical completed reviews; honest pagination count units (`tasks across samples`, `QC batches`, `submissions`).

---

### Phase 4: Issue #114 Map View Centering, Fullscreen, Satellite Layers & Coordinate Safety
- **Tests Executed**:
  - `server/tests/contracts/map_view.test.js` (9/9 passed):
    1. Centering hierarchy prioritizes valid sample GPS coordinates over laboratory location and neutral fallback.
    2. Falls back to configured laboratory location when sample coordinates are absent.
    3. Falls back to neutral center `[0, 20]` when both sample and lab coordinates are missing.
    4. Correctly parses string coordinate representations from Kobo / GPS forms.
    5. Rejects out-of-bounds latitude/longitude and falls back safely.
    6. Satellite tile URL points to Esri World Imagery with required legal attribution and zero paid keys.
    7. Standard OSM tile configuration provides valid URL and attribution.
    8. Viewport and coordinate provenance safety: map center resolution produces zero side-effects on stored sample coordinates.
    9. Viewport center is never silently persisted as sample coordinates without deliberate confirmation.
- **Client Implementation**:
  - `client/src/utils/mapConfig.js`: Implemented robust coordinate parsing, validation, and centering precedence helper (`resolveMapCenter`). Configured Esri World Imagery satellite layer with graceful fallback to OpenStreetMap.
  - `client/src/components/reception/SampleMap.jsx`: Added fullscreen toggle button with HTML5 Fullscreen API support; layer switcher between Standard and Satellite views; explicit coordinate confirmation flow.
  - `client/src/components/reception/LocationPicker.jsx`: Integrated coordinate validation, bounds checking, and satellite preview.

---

### Phase 4: Issue #115 Navigation Journey Order & Role Visibility
- **Tests Executed**:
  - `server/tests/contracts/navigation_order.test.js` (5/5 passed):
    1. Navigation reflects canonical laboratory journey sequence: Dashboard -> Reception -> Samples Registry -> Technician Work & Workbench -> Manager Task List -> Quality Assurance -> Result Reports -> Supporting Modules.
    2. `SAMPLE_RECEPTION` role sees Reception first followed by Samples and Reports.
    3. `LAB_TECHNICIAN` sees Samples followed by My Work and Workbench.
    4. `LAB_MANAGER` sees complete management journey: Reception -> Samples -> Manager Task List -> QA -> Reports.
    5. `SUPER_ADMIN` possesses complete laboratory and administrative scope.
- **Client Implementation**:
  - `client/src/App.jsx`: Reorganized navigation links and mobile drawer items to follow the canonical laboratory workflow sequence. Added role-aware visibility guards while preserving all route paths, deep links, and permission checks.
  - `client/src/components/mobile/MobileMoreSheet.jsx`: Aligned mobile navigation sheet order with the primary navigation layout.

---

### Phase 4: Issue #116 Localization, Translation Integrity & Scientific Code Protection
- **Tests Executed**:
  - `server/tests/contracts/localization_and_user_display.test.js` (Part 1, 6/6 passed):
    1. All 5 translation files (`en`, `es`, `es-419`, `fr`, `pt`) load as valid JSON with required top-level sections.
    2. Manager task list is properly localized ("Lista de tareas" in Spanish/Portuguese, "Manager Task List" in English) without raw English on localized screens.
    3. Operational view selector keys exist and are localized across all 5 languages (`daily`, `expected`, `registry`).
    4. Queue units for pagination and card counts are localized across all 5 languages (`batches`, `tasks`, `submissions`, `samples`).
    5. Map layer and fullscreen controls are localized across all 5 languages (`satellite`, `standard`, `fullscreen`).
    6. Scientific method codes (`SOC`, `PH`, `SAND`, `SILT`, `CLAY`, `TN`, `CEC`) remain standard scientific symbols across all catalogues.
- **Client Implementation**:
  - `client/src/translations/{en,es,es-419,fr,pt}.json`: Added missing translations for views, queues, map controls, and standardized "Lista de tareas".
  - `client/src/utils/dashboardConfig.js`: Localized queue labels, card titles, and count badges.

---

### Phase 4: Issue #126 Proper Display Names, Safe Fallback & Audit Attribution Integrity
- **Tests Executed**:
  - `server/tests/contracts/localization_and_user_display.test.js` (Part 2, 6/6 passed):
    1. Resolves proper display name when `user.name` is provided.
    2. Trims leading and trailing whitespace from `user.name`.
    3. Falls back to `username` when `user.name` is null, undefined, or whitespace-only string.
    4. Falls back to `'Unknown'` when both name and username are missing.
    5. Supports direct string username fallback.
    6. Audit reviewer attribution records stable immutable username rather than mutated display string.
- **Backend Implementation**:
  - `server/controllers/messageController.js`: Enriched message responses with sender proper display name while preserving immutable `username` in audit data.
- **Client Implementation**:
  - `client/src/components/messaging/MessagingCenter.jsx`: Displays sender proper name with safe username fallback in conversation list, header, and message bubbles.

---

### Phase 5: Governance & Verification Records

#### Issue #102: Physical Mobile Device Testing Protocol
- **Documentation**: `docs/test-sheets/mobile-device-testing.md`
- **Scope**: Established standardized testing protocol for real iOS Safari (iOS 16+, 17+) and Android Chrome (v115+) hardware.
- **Coverage Areas**:
  - Workspace tabs and responsiveness across portrait and landscape viewports.
  - Data tables, horizontal scrolling, and sticky headers.
  - Touch targets (minimum 44x44px per WCAG 2.1 AAA).
  - Virtual keyboard handling (no broken layouts, input focus visibility).
  - Dialog and modal lifecycle on mobile browsers.
  - Camera permission flow for barcode/QR scanning.
  - Offline intake draft persistence in localStorage.
- **Status**: Open pending human physical device test execution on deployed release candidate.

#### Issue #103: User Membership Reconciliation & Access Grants Discrepancy Ledger
- **Documentation**: `docs/governance/membership-reconciliation-ledger.md`
- **Scope**: Integrated read-only governance ledger aligning user project memberships, laboratory access grants, and country scopes with the generic-project / SoilFER country work package.
- **Key Findings**:
  - Explicit owner-junction rows separated from central servicing staff (e.g. `MASTER_USER`, global admins).
  - Programme membership does not grant blanket laboratory access; per-laboratory permissions strictly enforced.
  - Unmapped or ambiguous user assignments remain unresolved without speculative guessing.
  - Production data mutations strictly deferred under active production migration hold until reviewed change-set, backup, and rollback procedures are executed.
- **Status**: Open pending release authorization and database reconciliation run.

#### Issue #104: External Laboratory Dashboard Reconciliation Protocol
- **Documentation**: `docs/governance/external-dashboard-reconciliation.md`
- **Scope**: Architectural reconciliation between SoilFER-LIMS and the separate external Laboratory Dashboard application.
- **Key Clarifications**:
  - Reconciled metric definitions: Field Registry (all Kobo syncs) vs Expected Arrivals (pending intake) vs Active Lab Work (physically received).
  - Historical 15 September Guatemala sample count (3,580) confirmed as an point-in-time sync snapshot, not a permanent static target.
  - Clarified architectural boundary: LIMS does not perform automatic synthetic backfill or alter Kobo intake interpretation to match external dashboard counts.
- **Status**: Open pending reporter confirmation from Luis regarding form and date range parameters.



