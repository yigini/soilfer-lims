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
| **WP-2 Country/Kobo v2** | 0 | Country project separation, Kobo explicit mapping, 0-to-0 preservation risk, client exception spoofing, operation binding | Reproduced & Implemented Locally | `e2fff7e` | `project_policy_v2.test.js` (26/26), `kobo_explicit_mapping.test.js` (25/25), `soilfer_country_migration.test.js` (3/3), `programme_readers_and_rollups.test.js` (9/9) | Pending | Populated Result/QC/Report fixtures verified (35,197 samples, 4 results, 3 QC batches, 3 reports); report checksums intact; HTTP exception verification enforced with strict operation binding (sample, project, lab, channel, non-empty reason) passing all 5 Monitor probes. | Production migration hold remains active. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#118** | 1 | QC batch inspection link disconnect, unhandled QC disposition, failed QC bypassing release gates | Reproduced & Implemented Locally | `1ed46ef` | `qc_disposition_release_gate.test.js` (20/20), client production build (`vite build` clean in 7.26s) | Pending | Canonical batch inspection returns actual control values, affected work items with canonical sample ID, original ID, lab ID, run profile, and notes. Unresolved failed QC strictly blocks sample approval (409) and report generation (409). Permitted disposition schema enforced; manager disposition override is atomic inside transaction, updates result flags while preserving non-QC invalidity flags (`MANUAL_INVALID`, `ORIGINALLY_INVALID`) and immutable released/superseded records; multi-step validity probe verified (originally invalid result stays invalid across FAIL -> PASS and PROCEED_WITH_WARNING); fails closed on DB errors; REANALYZE_BATCH updates work items to REANALYSIS_REQUIRED; audit.qc queue counts only unresolved batches. | Historical released results remain immutable. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#119** | 1 | Confusion between canonical, lab, and original IDs; 26-task fixture truncation; derived fractions vs ordered tasks | Reproduced & Implemented Locally | `1ed46ef` | `sample_assignment_identity.test.js` (8/8), client production build (`vite build` clean in 7.26s) | Pending | Disambiguated canonical UUID (`sampleId`), sample lab ID (`labId`), and field ID (`originalId`); honest task pagination (26-task fixture exposes all 26 tasks with honest pagination metadata); bidirectional texture equivalence (`TEXTURE` satisfied by 3 fractions `SAND, SILT, CLAY`, and composite `TEXTURE` satisfies fractions); independent gate evaluation respecting SKIPPED/WAIVED; sampleWorkspace extracts linked QC batches to gate final approval; unassignedCount calculated across all work items; ManagerQueue routes assign to `?tab=work` and review to `?tab=review`. | Manual assignment requires manager authority. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#121** | 2 | Label print dialog issues, printable content isolation, title/filename handling | Reproduced & Implemented Locally | `1ed46ef` | `label_print.test.js` (5/5), local browser CDP evidence (`run_browser_evidence.cjs` exit code 0), client build (`vite build` clean in 7.26s) | Pending | Dual standard (101x54mm) and compact (50x25mm) thermal label formats; 100% offline QR code generation via `qrcode`; portal to `#label-print-portal` at `document.body` with print CSS isolation hiding all standard web UI; dynamic `document.title = Label-${sanitizedSampleId}` with `afterprint` restoration; autoPrint trigger support; intake rejection gate (`canPrintLabel: false`). Verified in local headless Chrome with standard (75,034 bytes) and compact (46,046 bytes) PDFs. | Browser-controlled print filename is best effort. Physical printer checks pending. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#122** | 2 | LabMethods defaults failing or silently falling back across labs | Reproduced & Implemented Locally | `1ed46ef` | `lab_method_defaults.test.js` (6/6), client build (`vite build` clean in 7.26s) | Pending | Scoped loading/saving for target lab; honest empty states without cross-lab leakage; cross-lab modification and viewing rejected with 403; unauthorized roles without MANAGE_ANALYSES rejected with 403; unavailable or mismatched methodologies rejected with 400. Work item generation reflects per-lab override. | Requires lab manager or global admin role. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#128** | 2 | Workbench deep links broken for specific workItemId and sampleId | Reproduced & Implemented Locally | `1ed46ef` | `workbench_deep_link.test.js` (13/13), client build (`vite build` clean in 7.26s) | Pending | Central authorization precedes diagnostic checks; canonical sample ID resolution across column collisions; rejects contradictory cross-column sample collisions with 400 CONTRADICTORY_IDENTIFIERS; technician assignment validation (fail closed); outside-default-page status resolution (COMPLETED); cross-lab access rejected with 403 without leaking details; non-existent items/samples return 404; `WorkbenchShell` `activeTargetRef` retains target context across subsequent fetches without recursive retry loops; `WorksheetArea` highlights selected work item. | Forbidden items return 403 without leaking other labs' data. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#123** | 2 | Workbench search input and pagination issues | Reproduced & Implemented Locally | `1ed46ef` | `workbench_search.test.js` (8/8), client build (`vite build` clean in 7.26s) | Pending | Multi-field search across canonical UUID, sample lab ID, original field ID, analysis code, and analysis display name (e.g. "Soil Organic Carbon" -> SOC); truthful no-match state; clearing search restores full authorized queue; cross-lab search isolation strictly excludes other labs' items. | Server/client dual search filters. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#124** | 2 | Result reports search failing across client, project, sample queries; residual query/filter lifecycle race on status tab transition | Reproduced & Implemented Locally | `1ed46ef` + `a563969` (residual) | `report_search.test.js` (7/7), `result_reports_filter_lifecycle.test.js` (16/16), local browser CDP evidence (`run_result_reports_browser_evidence.cjs` exit code 0), client build (`vite build` clean in 7.24s) | Pending | Fixed Prisma schema relation crash on `projectId` search; multi-field search across client first/surname, project code/name, and sample identifiers (canonical UUID, lab ID, and field original ID); discoverable superseded report versions with `status=SUPERSEDED` and `status=ALL` while defaulting to `PUBLISHED`; UI status filter pills with distinct superseded badge; cross-lab access isolation. Residual fix: separated draft search input from applied query state; stable `fetchReports` referencing stable refs without re-creation loops; single mount-only effect preventing duplicate/empty requests; `AbortController` in-flight cancellation; sequence-based stale-response guard (`requestIdRef`) dropping out-of-order delayed responses; strictly preserves applied query across status tab and page changes (`GTM26-0002` + Superseded -> 0 reports, suppressing unrelated `GTM26-0003`); real CDP browser journey (7/7 passed). | Scoped to authorized projects/labs; zero production or database schema mutations; backend authorization and share links preserved. | Implemented locally (16/16 Contract Tests & Headless Chrome CDP Verified; Codex Review Pending) |
| **#125** | 3 | Inventory aggregation anomalies, expired lots vs usable stock confusion | Reproduced & Implemented Locally | `278d32b` + working tree | `inventory_aggregation.test.js` (12/12 passed), `localization_and_user_display.test.js` (13/13 passed), client build (`vite build` clean in 13.31s) | Pending | Usable stock strictly aggregates available, non-expired lots; expired lots tracked separately without precedence masking; items at or below reorder threshold flagged as low stock; missing quantities represented truthfully as null (not 0); usableMissingQuantityLotCount tracked so mixed known/unknown lots treat usable stock as a subtotal (`≥ X`, `SUBTOTAL` badge) and distinguish confirmed low stock (`LOW`) from uncertainty (`LOW? (UNCERTAIN)` / `COUNT NEEDED`); GET /api/inventory/alerts is 100% pure (zero DB mutations); FEFO strictly excludes expired lots. UI displays OUT OF STOCK, EXPIRED, and SUBTOTAL badges without mutual masking; inventory subtotal and uncertainty badges localized across all 5 locales (#116). | Display/aggregation fix; zero schema changes. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#117** | 3 | Failed reception criterion not persisting or reflecting in UI; Reception TDZ runtime crash before first render | Reproduced & Implemented Locally | `81487b1` | `reception_compliance.test.js` (18/18 passed), `reception_compliance_component.test.js` (12/12 passed), `reception_route_smoke.test.js` (6/6 passed including release prerequisite), isolated Headless Chrome CDP browser journey (6/6 passed, `reception_browser_journey.json`), client build (`vite build` clean) | Pending | Authoritative saved state reflects OK/N/A/FAIL with visible badge indicators; atomic single-event state update in ComplianceChecklist (`onChange(newValue)`) prevents stale-closure overwrite in parent Reception; non-conformance flag auto-syncs with failed checklist items and clears upon correction back to PASS unless custom reason supplied; rejected sample intake persists checklist and ncReason in receptionData and metadata.nonConformance, transitioning to RECEIVED_REJECTED; inspecting or resuming draft rehydrates checklistData truthfully. Resolved P1 TDZ ReferenceError by relocating mode-cleanup effect below checklistData useState declaration; verified in real isolated Headless Chrome (CDP) parent and child together (`reception_browser_journey_verified.png`), including fail selection, note entry, correction back to OK, and synthetic draft rehydration; route smoke tests enforce client/dist release prerequisite as explicit non-silent assertion. | Non-conformance requires explanation note. | Implemented locally (Verified in Headless Chrome & Contract Tests; Codex Review Pending) |
| **#113** | 3 | Reception compliance checklist and redundant/unauthorized dispositions | Reproduced & Implemented Locally | `81487b1` | `reception_compliance.test.js` (18/18 passed), `reception_compliance_component.test.js` (12/12 passed), `reception_route_smoke.test.js` (6/6 passed), isolated Headless Chrome CDP browser journey (6/6 passed, `reception_browser_journey.json`), client build (`vite build` clean) | Pending | Reception compliance checklist evaluation enforced upfront before sample creation, guaranteeing zero DB mutations on 400 rejection: all-pass admits sample routinely without redundant gates; permitted N/A (CoC strictly on walk-in) accepted; prohibited N/A (formal shipment CoC, or container/label/condition/quantity) rejected with 400 INVALID_CHECKLIST_NA and disabled in UI; incomplete, empty, or omitted checklist rejected with 400 INCOMPLETE_COMPLIANCE_CHECKLIST; legacy alias normalization fails closed on conflicting aliases and tracks unknown keys; failed check blocks routine acceptance for reception staff (403 COMPLIANCE_FAILURE_EXCEPTION_REQUIRED); staff self-authorization strictly prohibited; manager exception required to admit with ADMITTED_WITH_EXCEPTION in history. In real browser journey, verified Walk-in mode enables CoC N/A (`aria-checked="true"`), and switching Walk-in to Project mode triggers useEffect interactive cleanup resetting prohibited CoC N/A to undefined (`aria-checked="false"`). | Manager or admin exception required to admit failed compliance items. | Implemented locally (Verified in Headless Chrome & Contract Tests; Codex Review Pending) |
| **#120** | 4 | Dashboard vs manager task list conflation; large field registry overwhelming queues | Reproduced & Implemented Locally | `1ed46ef` | `dashboard_manager_views.test.js` (7/7 passed), client production build (`vite build` clean) | Pending | Daily lab queue defaults to physically received and active samples (`view=daily`, `ACTIVE_LAB_STATUSES = ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'SUBMITTED']`); field arrivals awaiting intake separated (`view=expected`, `EXPECTED_STATUSES = ['EXPECTED', 'COLLECTED']`); full field registry accessible across all stages (`view=registry`); returned sample rows and `views.daily`/`views.expected` aggregation counts strictly agree; manager exceptions lane surfaces only unresolved QC failures; honest pagination units. | Provenance and Kobo records preserved without data loss. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#114** | 4 | Map centering issues, lack of fullscreen, map layer fallbacks, hardcoded lab coordinates | Reproduced & Implemented Locally | `81487b1` | `map_view.test.js` (16/16 passed), `lab_directory_and_auth_profile.test.js` (5/5 passed), client production build (`vite build` clean) | Pending | Removed fake hard-coded LAB_DEFAULT_COORDINATES dictionary; sourced authorized actual laboratory configuration from schema (Lab.location) and auth (user.lab, GET /api/labs/:id); documented GET /api/labs/:id public directory policy; verified auth and profile resolution for configured vs unconfigured laboratories (null location handled truthfully without fake fallbacks); scoped authorization proven: cross-lab directory lookup succeeds (200), whereas cross-lab operational workspace access fails closed (403 TARGET_OUTSIDE_SCOPE); parseCoordinates normalizes and validates geographic bounds; HTML5 Fullscreen API guarded with document.fullscreenEnabled and denial catch; Leaflet invalidateSize triggered on fullscreen toggle; Esri MLA terms and OpenStreetMap Tile Usage Policy cited. | Physical printer/GPS field checks pending. | Implemented locally (Contract Tests Passing; Codex Review Pending) |
| **#115** | 4 | Navigation order not reflecting laboratory journey | Reproduced & Implemented Locally | `1ed46ef` + working tree | `navigation_order.test.js` (5/5 passed), client production build (`vite build` clean) | Pending | Reorganized navigation items into canonical laboratory journey sequence via production helper `client/src/navigationConfig.js`: Dashboard (`/`) -> Reception (`/reception`) -> Samples Registry (`/samples`) -> Technician Work & Workbench (`/my-work`, `/workbench`) -> Manager Task List (`/manager-queue`) -> Quality Assurance (`/qa`) -> Result Reports (`/result-reports`) -> Supporting Modules. Navigation order contract test executes production module directly. | Role permissions unchanged. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#116** | 4 | Hardcoded English strings in Spanish/multilingual UI | Reproduced & Implemented Locally | `278d32b` + working tree | `localization_and_user_display.test.js` (13/13 passed), `npm run i18n:check` passed, client production build (`vite build` clean in 13.31s) | Pending | Removed hardcoded English strings across dashboard, manager task list, QA, navigation, and inventory in all 5 supported locales (`en`, `es`, `es-419`, `fr`, `pt`). Standardized manager action terminology to "Lista de tareas" in Spanish/Portuguese and "Manager Task List" in English; localized queue units, map controls, view selector pills, and newly added inventory subtotal, count needed, confirmed low, and uncertain low stock badges; verified scientific codes remain untranslated scientific symbols; i18n audit passed. | Translation files maintain valid JSON syntax. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#126** | 4 | Raw usernames displayed instead of proper names in messages/tasks | Reproduced & Implemented Locally | `1ed46ef` | `localization_and_user_display.test.js` (12/12 passed), client production build (`vite build` clean) | Pending | Resolved stored proper display name (`user.name`) with safe username fallback across message lists, conversation threads, notification toasts, task assignment dropdowns, and header drawers; leading/trailing whitespace safely trimmed; historical/deactivated users and missing names fall back gracefully; audit logs and reviewer attributions retain stable immutable username identifiers. | Passwords and private profile data excluded. | Implemented locally (Local Tests Passing; Independent Codex Review Pending) |
| **#102** | 5 | Physical mobile device testing (iOS Safari, Android Chrome) | Open | Pending | Mobile device testing execution sheet (`docs/test-sheets/mobile-device-testing.md`) | Pending | Real physical device testing sheet established covering touch targets, virtual keyboard pan/zoom, horizontal scrolling, sticky headers, camera permissions, and offline draft sync. Emulation alone is insufficient. | Requires physical device validation on deployed release candidate. | Open (Human/Hardware Testing Pending) |
| **#103** | 5 | User membership reconciliation & country access grants | Open | Pending | Read-only discrepancy ledger (`docs/governance/membership-reconciliation-ledger.md`) | Pending | Governance framework and illustrative archetypes mapped against real Prisma schema (`User.labId`, `User.projects`, `User.countries`, `ProjectLab`); scopeGuard global access rules documented (`SUPER_ADMIN` only); no invented junction tables; production migration hold strictly active. | Under production migration hold. | Open (Governance / Migration Gate Active) |
| **#104** | 5 | Separate Laboratory Dashboard sample count discrepancy | Open | Pending | External reconciliation protocol (`docs/governance/external-dashboard-reconciliation.md`) | Pending | Reconciled metric definitions (Field Registry vs Expected vs Active Lab Work); 3,580 distinguished as reporter snapshot (Luis, 15 Sept 2026); external dashboard architecture documented as unknown; protocol marked as preparation framework; synthetic backfill prohibited. | Requires reporter confirmation from Luis. | Open (External Coordination Pending) |

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
    - Relocated mode cleanup effect below `checklistData` `useState` declaration to prevent TDZ ReferenceError.

- **Route Smoke Tests & Release Prerequisite (`server/tests/contracts/reception_route_smoke.test.js`, 6/6 passed)**:
  1. Release Prerequisite: Client production build (`client/dist/index.html`) must exist (explicit non-silent assertion, fails release gate if missing).
  2. `GET /reception` returns HTTP 200 and text/html SPA shell.
  3. `GET /reception?mode=WALK_IN` returns HTTP 200 and text/html SPA shell.
  4. Client dist bundle contains compiled Reception page asset.
  5. Referenced entry assets in index.html are served with HTTP 200.
  6. Isolated Reception parent render with WALK_IN mode completes without runtime crash.

- **Isolated Headless Chrome CDP Interactive Browser Journey (`server/scripts/run_reception_browser_journey.cjs`, 6/6 passed)**:
  - **Database Isolation & Refusal Guard**: Executed against a dedicated disposable database copy (`server/.tmp_journey_runner_<timestamp>_<rand>/disposable_journey_<nonce>.db`) pre-configured and validated before importing Prisma or Express; wiped all copied records from tables to guarantee schema-only synthetic fixtures without copied Kobo/integration configs or real credentials; verified refusal guard rejects inherited working databases (`prisma/dev.db`); refusal contract test passed 9/9 (`server/tests/contracts/journey_runner_db_refusal.test.js`); CLI refusal check passed (`node server/scripts/run_reception_browser_journey.cjs --refusal-check`); restricted cleanup strictly to exact recorded owned root, preserving other active runs (no broad sweeper); background jobs disabled (`DISABLE_BACKGROUND_JOBS = 'true'`) and handles stopped on teardown; prior run audit privately documented under `databaseIsolation.priorRunAudit` (`server/prisma/dev.db` due to unset `DATABASE_PATH` before import).
  - Executed real compiled client bundle served by Express production server on `http://127.0.0.1:49160/reception` against local Headless Chrome via Chrome DevTools Protocol.
  - Evidence report: `artifacts/evidence-journeys/reception_browser_journey.json`
  - Evidence screenshot: `artifacts/evidence-journeys/reception_browser_journey_verified.png`
  - Journeys Verified:
    1. **Reception First Render & TDZ Prevention**: Verified first render of parent Reception console; modes visible; zero `checklistData` `ReferenceError` exceptions.
    2. **Parent & Child Integration**: Clicked "Walk-in Sample"; verified `WalkInForm` parent and `ComplianceChecklist` child mounted together with CoC, Container, and Label controls.
    3. **Walk-in CoC N/A Permitted**: Selected CoC N/A; verified button allowed in walk-in mode and `aria-checked="true"`.
    4. **Mode-Switch Interactive Cleanup**: Dispatched `Alt+1` to switch Walk-in to Project mode; strictly asserted `inProjectMode: true` (which renders "Select Project Session" header and active project cards); selected active project card; dispatched `Alt+2` to return to Walk-in mode; verified React `useEffect` executed in live browser and reset prohibited CoC N/A (`aria-checked="false"`).
    5. **Checklist Fail & Correction Lifecycle**: Selected Fail on Container Intact; verified failure note input rendered; entered note "Bag torn at seam during transport" via real controlled-input property setter; asserted note in DOM before correction; corrected back to OK; verified failure note input cleared and non-conformance flag resolved.
    6. **Real 10-Second Autosave & Reopen/Restore Lifecycle**: Entered Submitter ("Farmer Chanda") and Label Non-Conformance Note ("Handwritten label smudged by rain") via real DOM input typing; waited 11.5s for application's actual 10-second `setInterval` autosave timer to persist to `localStorage['limsi_intake_autosave']`; asserted saved draft payload; reloaded `/reception`; handled and accepted authentic application "Restore Draft?" confirmation modal; verified rehydration and DOM persistence of restored values.

---

### Phase 4: Issue #120 Dashboard, Manager Task List & Field Registry Separation
- **Tests Executed**:
  - `server/tests/contracts/dashboard_manager_views.test.js` (7/7 passed):
    1. `GET /api/samples?view=daily` defaults daily lab queue to physically received and active samples (`ACTIVE_LAB_STATUSES = ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'SUBMITTED']`).
    2. `GET /api/samples?view=expected` returns field arrivals awaiting intake (`EXPECTED_STATUSES = ['EXPECTED', 'COLLECTED']`).
    3. `GET /api/samples?view=registry` returns full field registry across all stages without omitting records.
    4. Response provides reconciled view counts in `views` and `facets.views`; rows and counts agree for `COLLECTED` specimens.
    5. Manager exceptions queue (`/api/dashboard/queues/manager.exceptions`) surfaces only unresolved QC failures and clears resolved dispositions.
    6. Cross-lab isolation: Manager B cannot view Lab A samples or exceptions (HTTP 403 / empty filtered view).
    7. Explicit status query parameter overrides view parameter without regression.
- **Backend Implementation**:
  - `server/controllers/sampleController.js`: Added `view` query parameter support (`daily`, `expected`, `registry`) with status filtering; removed `COLLECTED` from `ACTIVE_LAB_STATUSES` and added `EXPECTED_STATUSES = ['EXPECTED', 'COLLECTED']` so `views.daily` and `views.expected` agree with returned rows.
- **Client Implementation**:
  - `client/src/pages/Samples.jsx`: Added view selector tabs (`Daily Lab Work`, `Expected Arrivals`, `Full Field Registry`) with badge counts; bound to `view` query parameter.
  - `client/src/pages/ManagerQueue.jsx`: Clear separation of pending manager action items from historical completed reviews; honest pagination count units (`tasks across samples`, `QC batches`, `submissions`).

---

### Phase 4: Issue #114 Map View Centering, Fullscreen, Satellite Layers & Coordinate Safety
- **Tests Executed**:
  - `server/tests/contracts/map_view.test.js` (15/15 passed):
    1. Centering hierarchy prioritizes valid sample GPS coordinates over laboratory location and neutral fallback.
    2. Falls back to configured laboratory location when sample coordinates are absent.
    3. Falls back to neutral center `[0, 20]` when both sample and lab coordinates are missing.
    4. Correctly parses string coordinate representations from Kobo / GPS forms.
    5. Rejects out-of-bounds latitude/longitude and falls back safely.
    6. Satellite tile URL points to Esri World Imagery with required legal attribution and zero paid keys.
    7. Standard OSM tile configuration provides valid URL and attribution.
    8. Viewport and coordinate provenance safety: map center resolution produces zero side-effects on stored sample coordinates.
    9. Viewport center is never silently persisted as sample coordinates without deliberate confirmation.
    10. Harare laboratory intake fixture centers viewport on `[-17.8292, 31.0522]` while sample coordinates remain blank.
    11. Deliberate sample coordinates override laboratory center.
    12. Missing laboratory coordinates fall back to country default `[-17.8292, 31.0522]` or neutral `[0, 20]`.
    13. MapContainer renders with Harare center and blank sample coordinates.
    14. Fullscreen component integrates `document.fullscreenEnabled` capability check and rejection catch.
    15. InvalidateMapSize component invokes Leaflet `invalidateSize` on fullscreen changes.
  - `server/tests/contracts/lab_directory_and_auth_profile.test.js` (5/5 passed):
    1. Configured laboratory: login and `/api/auth/me` populate `user.lab` and `user.labLocation` from database.
    2. Unconfigured laboratory (location null): login and `/api/auth/me` return null location without fallback claims.
    3. Unassigned user (labId null): login and `/api/auth/me` return null lab and labLocation.
    4. `GET /api/labs/:id` directory policy: returns public directory fields (`id, code, name, location, country, city, isActive`), excludes sensitive operational data, and requires authentication (401 on unauthenticated).
    5. Scoped authorization distinction: calling `GET /api/labs/:id` across labs succeeds (public directory lookup), while accessing another lab's operational workspace (`GET /api/labs/:id/workspace`) is strictly rejected with HTTP 403 `TARGET_OUTSIDE_SCOPE`.
- **Backend Implementation**:
  - `server/routes/labRoutes.js`: Documented public directory policy on `GET /api/labs/:id` and clarified scoped authorization boundaries for operational endpoints.
  - `server/middleware/authMiddleware.js`: Consistently resolved `user.lab` and `user.labLocation` for any authenticated user with `labId`.
- **Client Implementation**:
  - `client/src/utils/mapConfig.js`: Implemented coordinate parsing, validation, centering precedence helper (`resolveMapCenter`), and documented official Esri Master License Agreement and OpenStreetMap Tile Usage terms.
  - `client/src/components/reception/LocationPicker.jsx`: Centered on authenticated laboratory coordinates (`labCoordinates`), preserved blank sample coordinates until deliberate selection, and added fullscreen capability guards and Leaflet size invalidation.
  - `client/src/components/reception/SampleMap.jsx`: Preserved missing coordinates placeholder for read-only viewing, with fullscreen capability guards and Leaflet size invalidation.

---

### Phase 4: Issue #115 Navigation Journey Order & Role Visibility
- **Tests Executed**:
  - `server/tests/contracts/navigation_order.test.js` (5/5 passed):
    1. Production helper `client/src/navigationConfig.js` executed directly: App.jsx imports and binds `buildNavItems(user, t, icons)`.
    2. Navigation reflects canonical laboratory journey sequence: Dashboard -> Reception -> Samples Registry -> Technician Work & Workbench -> Manager Task List -> Quality Assurance -> Result Reports -> Supporting Modules.
    3. `SAMPLE_RECEPTION` role sees Reception first followed by Samples and Reports.
    4. `LAB_TECHNICIAN` sees Samples followed by My Work and Workbench.
    5. `LAB_MANAGER` sees complete management journey: Reception -> Samples -> Manager Task List -> QA -> Reports.
- **Client Implementation**:
  - `client/src/navigationConfig.js`: Extracted pure, authoritative navigation item generator `buildNavItems(user, t, icons)` enforcing canonical journey order and role filtering.
  - `client/src/App.jsx`: Bound navigation and drawer items to `buildNavItems`.
  - `client/src/components/mobile/MobileMoreSheet.jsx`: Aligned mobile navigation sheet order with primary navigation layout.

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
- **Scope**: Governance reconciliation framework mapping user project memberships, laboratory access grants, and country scopes against the actual Prisma schema (`User.labId`, `User.projects`, `User.countries`, `ProjectLab`).
- **Key Findings**:
  - Single source of truth is the actual schema: `User` has `labId`, JSON arrays for `projects` and `countries`; no fictional `UserProject`/`UserLab` tables.
  - `scopeGuard.js` gives global access strictly to `SUPER_ADMIN`; `AUDIT_USER` does not have un-scoped bypass.
  - Discrepancy ledger contains illustrative archetypes / pending entries, NOT verified production migration inputs.
  - Production data mutations strictly held under production migration hold until formal country coordinator mandate letters are logged.
- **Status**: Open (Governance / Migration Gate Active; Illustrative Protocol Documented).

#### Issue #104: External Laboratory Dashboard Reconciliation Protocol
- **Documentation**: `docs/governance/external-dashboard-reconciliation.md`
- **Scope**: Architectural reconciliation protocol between SoilFER-LIMS and the separate external Laboratory Dashboard application.
- **Key Clarifications**:
  - Reconciled metric definitions: Field Registry (all Kobo syncs) vs Expected Arrivals (pending intake, `EXPECTED` + `COLLECTED`) vs Active Lab Work (physically received).
  - Historical 15 September Guatemala sample count (3,580) explicitly distinguished as a reporter-observed snapshot, not an internally verified ETL fact.
  - External dashboard architecture and ingestion mechanism documented as unknown.
  - Document designated as preparation framework, not completed reconciliation.
  - LIMS core will not perform synthetic backfill or fabricate intake dates.
- **Status**: Open (External Coordination Pending; Preparation Framework Documented).

---

### Phase 6: Independent Candidate Release Review Remediation (Findings R1–R5)

#### R1: Authoritative Linked Sample Scope on Reports & Metadata Conflict Resolution
- **Problem**: In candidate `b23d4ac`, changing `IR-REPORT-B.labId` to `IR-LAB-A` while linked sample remained in Kenya (`KEN/lab B`) allowed GTM national report search to return the report (status 200) while detail returned 403. Accidental OR expansion (`labId: countryLabIds`, `sampleLabId: countryLabIds`) authorized stale report metadata without applying authoritative sample scope. `sampleLabId` (a human sample identifier string) was treated as laboratory authority.
- **Remediation**:
  - Implemented shared authoritative authorization predicate `isReportAuthorized(user, report, sample)` in `server/controllers/reportController.js`:
    - Linked sample scope is strictly authoritative when present.
    - Report metadata is only consulted as fallback for orphaned reports (e.g. historical unlinked reports).
    - Removed `sampleLabId` from laboratory authority evaluation.
  - Wired `isReportAuthorized` uniformly across `getReport`, `getReportBySample`, `createShareLink`, `getReportPdf`, and `searchReports`.
  - In `searchReports`, candidate reports are filtered through `isReportAuthorized` against accessible samples resolved via `scopeGuard.buildScopedWhere`. Total count and returned list agree with 100% consistency.
  - Project snapshot conflicts (e.g. report claiming Project Alpha on Beta sample) are excluded from Alpha search and denied in detail.
- **Verification**: `candidate_release_review_fixes.test.js` (R1 tests 1–7 pass, including metadata conflict and project snapshot conflict); Codex `independent-release-retest-b23d4ac.cjs` returns only own-scope report (`IR-REPORT-A`), excluding Kenya report (`IR-REPORT-B`) from search and detail (403).

#### R2: Ordinary Workbench Queue & Stale Assignment Isolation
- **Problem**: `GET /api/workbench/drafts` returned drafts for cross-lab tasks when `draft.labId = null`. Furthermore, setting conflicting lab IDs on work items and samples resulted in SQL counts including the item while in-memory post-filters hid it (`totalItems=1`, `myWorkCount=2`).
- **Remediation**:
  - Implemented `canAccessDraft(user, draft, workItem, sample)` in `server/services/draftService.js`:
    - Validates draft's own lab, parent work item lab (`labId`, `assignedLab`), and linked sample lab (`assignedLab`, `labId`).
    - Stale draft ownership alone is strictly denied after staff transfers.
    - Wired across `getDrafts`, `discardDraft`, `resolveConflict`, and workbench statistics (`stats.totalDrafts`).
    - Scope denials in `discardDraft` and `resolveConflict` return HTTP 403.
  - Aligned `labScopeCondition` in `server/controllers/workbenchController.js` to match post-fetch scope check directly in SQL:
    - Work item: non-conflicting lab assignments (`labId` in `[user.labId, null]`, `assignedLab` in `[user.labId, null]`, at least one matching `user.labId`).
    - Linked sample: non-conflicting lab assignments (`assignedLab` in `[user.labId, null]`, at least one matching `user.labId`).
    - Conflicting combinations (`labId=B, assignedLab=A` with sample `assignedLab=B, labId=A`) are filtered out at the SQL level.
    - `myWorkCount`, `readyToSubmitCount`, `submittedCount`, `completedCount`, and visible items agree with zero divergence.
- **Verification**: `candidate_release_review_fixes.test.js` (R2 tests 1–5 pass); Codex `independent-release-retest-b23d4ac.cjs` returns empty drafts (`{"drafts":{},"items":[]}`) and consistent queue stats (`myWorkCount: 1, totalItems: 1, totalDrafts: 0`).

#### R3: QC Reanalysis Transitions Completed-Unsubmitted Work Items
- **Problem**: `server/controllers/qcController.js` treated `COMPLETED` work items as immutable alongside `ACCEPTED` and `RELEASED`, causing `REANALYZE_BATCH` dispositions to leave completed unsubmitted determinations in a dead-end state.
- **Remediation**:
  - Distinguished recorded completion from immutable scientific history:
    - Immutable: `ACCEPTED` and `RELEASED` work items, and work items on `RELEASED`, `ARCHIVED`, or `DISPOSED` samples remain strictly untouched.
    - Eligible: `COMPLETED`, `SUBMITTED`, `IN_PROGRESS`, and `ASSIGNED` work items in the failed QC batch transition to `REANALYSIS_REQUIRED` upon `REANALYZE_BATCH` (or `REJECTED` upon `REJECT_BATCH`).
    - Audit and history trails updated atomically with disposition reason and author.
    - Reanalysis does NOT fabricate or tamper with raw scientific determination values.
    - Idempotent repeated dispositions with matching decision/reason return `idempotent: true`; conflicting dispositions fail with 409 `DISPOSITION_CONFLICT`.
- **Verification**: `candidate_release_review_fixes.test.js` (R3 tests 1–2 pass); Codex independent scripts record `workStatus: "REANALYSIS_REQUIRED"` and status 200.

#### R4: Precedence of Explicit Exception Requirements over Channel Whitelist
- **Problem**: `server/services/projectPolicyService.js:canAdmitSample` returned `{ allowed: true }` when `policy.allowedChannels.includes(channel)` before checking `requiresExceptionForDesk` or `requiresExceptionForManifest`.
- **Remediation**:
  - Enforced explicit configuration precedence:
    - If `requiresExceptionForDesk` is true or `allowDirectRegistration` is false, DESK intake strictly requires an authorized exception record, even if DESK is listed in `allowedChannels`.
    - If `requiresExceptionForManifest` is true, MANIFEST intake strictly requires an authorized exception record.
    - Channel whitelist validated; un-whitelisted channels fail closed with channel-specific reason codes (`KOBO_REQUIRED`, `MANIFEST_REQUIRED`, or `CHANNEL_NOT_ALLOWED`).
  - HTTP trust boundary in `server/controllers/receptionController.js:processIntake`: client-claimed boolean flags (`isStoredApprovalVerified`) are stripped and rejected (`EXCEPTION_NOT_AUTHORIZED`); stored approvals require valid database record with matching target sample, channel, and authorized manager.
- **Verification**: `candidate_release_review_fixes.test.js` (R4 tests 1–3 pass); Codex independent scripts return `{ allowed: false, exceptionRequired: true, code: "EXCEPTION_REQUIRED" }`.

#### R5: Additive Schema Migration Runner Hardening & Populated Legacy Schema Rehearsal
- **Problem**: Previous runner rehearsal only created a 7-column Project table without exercising application queries, populated results/QC/reports, rollback compatibility, or failing closed on invalid paths/tables.
- **Remediation**:
  - `server/scripts/migrate_project_templates_and_policy.js`:
    - Fail closed on non-existent database file path (`fs.existsSync` check + `fileMustExist: true`).
    - Fail closed on target database missing `Project` table.
    - Enclosed additive `ALTER TABLE` statements, index creation, post-migration column checks, row count assertion, and `PRAGMA foreign_key_check("Project")` inside a single atomic `db.transaction(...)`. On any error or constraint issue, all changes roll back automatically leaving the schema unmodified.
    - In no-op state, ensures index `Project_parentProjectId_idx` and executes `PRAGMA foreign_key_check`.
  - Populated Legacy Schema Rehearsal:
    - Constructed full legacy schema database populated across all operational domains: `Project` (legacy 16-column schema without the 5 additive columns), `Lab`, `User` (restricted roles), `Sample`, `Batch` (QC batch), `WorkItem` (completed and assigned), and `Report` (published and superseded versions).
    - Executed additive migration runner: 100% row preservation verified across all tables.
    - Instantiated Prisma Client with Better-Sqlite3 driver adapter on the migrated database: queried projects, samples with joined projects, reports, users, work items, and QC batches with **zero `P2022` (column not found) errors**.
    - Verified conservative policy behavior with migrated open intake projects.
    - Verified strictly idempotent rerun (`applied: false`, row counts identical).
- **Verification**: `candidate_release_review_fixes.test.js` (R5 tests 1–7 pass: dry-run, application, idempotence, fail-closed on missing DB, fail-closed on missing table, atomic rollback on FK failure, and full populated legacy rehearsal).

#### CI Isolation Fix
- **Problem**: GitHub Actions CI Run 35649079609 failed on `tests/security/lab_isolation.test.js:95` because `sampleGTM` finder queried `findFirst({ where: { country: 'GTM' } })`, matching cross-lab test sample `SMP-R1-A` created earlier by `candidate_release_review_fixes.test.js` in clean CI.
- **Remediation**:
  - Hardened sample finders in `server/tests/security/lab_isolation.test.js` to strictly query `where: { country: 'GTM', OR: [{ assignedLab: 'GTM-LAB1' }, { labId: 'GTM-LAB1' }] }` (and similarly for HND).
  - Added `afterAll` teardown hooks across describe blocks in `candidate_release_review_fixes.test.js`.
- **Verification**: Combined sequential execution of `candidate_release_review_fixes.test.js` and `lab_isolation.test.js` passed 37/37 tests with zero cross-talk.

---

### Remediation of Retest Findings at 0cdcaed (Candidate Final Hardening)

#### 1. R1: Technician Stale Assignment Report Search/Detail Parity
- **Defect Identified**: In retest at `0cdcaed`, technician in Lab A with a stale work item assigned on foreign sample B (in Lab B) saw report B in `GET /api/reports/search` (status 200) while `GET /api/reports/IR-REPORT-B` returned 403. This was caused by `scopeGuard.buildScopedWhere` adding an unconstrained `OR: [{ workItems: { some: { assignedTo: user.username } } }]` for non-admin users, which bypassed laboratory boundaries and matched foreign samples with stale technician assignments.
- **Root Cause & Fix**:
  - In `server/utils/scopeGuard.js:buildScopedWhere`: constrained technician `workItems` matching to strictly require the laboratory scope when `user.labId` is present:
    ```javascript
    if (user.role === 'LAB_TECHNICIAN' && user.username) {
        if (labScope) {
            orClauses.push({
                AND: [
                    { workItems: { some: { assignedTo: user.username } } },
                    { OR: [{ [labField]: labScope }, ...(altLabField ? [{ [altLabField]: labScope }] : [])] }
                ]
            });
        } else {
            orClauses.push({ workItems: { some: { assignedTo: user.username } } });
        }
    }
    ```
  - In `server/utils/scopeGuard.js:canAccessEntity`: ensured `entity.workItems` checking respects `labScope` so foreign-lab work item assignments never grant access.
  - In `server/controllers/reportController.js:searchReports`: replaced indirect Prisma query filtering with direct evaluation via the shared authoritative helper `isReportAuthorized(req.user, report, sample)`. Candidate samples are resolved and passed directly into `isReportAuthorized` for every report row, guaranteeing 100% authorization parity between search lists, pagination counts, and single-report detail endpoints.
  - Added scope validation to `listShareLinks` and `revokeShareLink`.
- **Verification**:
  - Codex independent retest script (`independent-release-retest-0cdcaed.cjs`): observation 9 `technician report search stale assignment` returned exclusively `["IR-REPORT-A"]` (foreign report B excluded).
  - Search and detail match 100% across all tested roles: technician, manager, national user, project manager, and external viewer.
  - Unit test `Technician with stale cross-lab assignment: foreign report excluded from search and denied in detail (search/detail parity)` in `candidate_release_review_fixes.test.js` passes.

#### 2. R5: Dry-Run Immutability & Index Creation Atomicity
- **Defect Identified**: On a database with all five additive columns present but missing `Project_parentProjectId_idx`, calling `migrateProjectTemplatesAndPolicy(db, { dryRun: true })` executed `CREATE INDEX IF NOT EXISTS` before checking the dry-run flag, creating the index on disk while reporting `applied: false`. Observed index count was 0 before and 1 after.
- **Root Cause & Fix**:
  - In `server/scripts/migrate_project_templates_and_policy.js`:
    - Computed `missingIndex = !db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='Project_parentProjectId_idx'").get()`.
    - Evaluated `needsMigration = missingColumns.length > 0 || missingIndex`.
    - Checked `if (isDryRun)` immediately BEFORE any DDL statement. In dry-run mode, the function returns `{ success: true, dryRun: true, applied: false, needsMigration, missingColumns, missingIndex, totalProjects }` with ZERO writes to `sqlite_master`.
    - In apply mode, wrapped missing column alterations AND missing index creation inside `db.transaction(...)` for atomic rollback on any failure.
    - Verified foreign key integrity and post-migration schema integrity inside the transaction.
- **Verification**:
  - Codex dry-run script `migration-dry-run-0cdcaed.cjs` confirmed:
    `{"before":0,"after":0,"result":{"success":true,"dryRun":true,"applied":false,"needsMigration":true,"missingColumns":[],"missingIndex":true,"totalProjects":0}}`
  - Automated tests in `candidate_release_review_fixes.test.js`:
    - `Dry run detects 5 missing additive columns without modifying database or sqlite_master`: SHA256 checksum of `sqlite_master` strictly identical before and after.
    - `Dry run on DB with columns present but missing index never creates index or mutates sqlite_master, and apply mode creates it atomically`: SHA256 checksum of `sqlite_master` strictly identical before and after dry-run; apply mode creates index atomically and reports `applied: true, createdIndex: true`.

#### 3. R5: Populated Upgrade Rehearsal Expansion & Conservation Proof
- **Enhancement Completed**:
  - Expanded synthetic populated rehearsal database to include representative historical records across all domains:
    - 2 Labs (`LAB-GTM`, `LAB-KEN`)
    - 2 Legacy Projects (`PRJ-GTM-ALPHA`, `PRJ-KEN-BETA`)
    - 4 Users with restricted role scopes (`LAB_TECHNICIAN`, `LAB_MANAGER`, `MASTER_USER`, `PROJECT_MANAGER`)
    - 2 Samples (`SMP-001`, `SMP-002`)
    - 2 QC Batches (`BATCH-001`, `BATCH-002`)
    - 2 WorkItems (`WI-001`, `WI-002`)
    - 2 Measured Results with numeric values, quality flags, and units (`RES-001`, `RES-002`)
    - 3 Reports across published and superseded versions (`REP-PUB`, `REP-SUP`, `REP-KEN`)
    - 1 ReportShareLink (`RSL-001`)
    - 2 AuditLogs (`AUD-001`, `AUD-002`)
  - **100% Byte/Checksum Conservation**:
    - Captured pre-migration SHA256 hashes of raw rows for all tables (`Result`, `Report`, `ReportShareLink`, `AuditLog`, `WorkItem`, `Sample`, `Batch`, `Lab`, `User`).
    - After executing `migrateProjectTemplatesAndPolicy`, computed post-migration SHA256 hashes for all tables:
      - `Result`: `preHash === postHash` (zero byte modification on measured results)
      - `Report`: `preHash === postHash` (zero byte modification on certificate contents)
      - `ReportShareLink`: `preHash === postHash` (zero byte modification on share links)
      - `AuditLog`: `preHash === postHash` (zero byte modification on audit events)
      - `WorkItem`, `Sample`, `Batch`, `Lab`, `User`: all hashes identical.
  - **Forward/Backward Query Compatibility**:
    - Legacy SELECT query (`SELECT id, code, name, status, projectType FROM Project`) executed on migrated database schema with zero errors, returning identical records.
  - **Prisma Client Validation**:
    - Better-Sqlite3 driver adapter queried all models with zero `P2022` missing-column errors.
  - **Supported-Channel Policy Behavior**:
    - Real channels tested: `DESK`, `MANIFEST`, `KOBO`.
    - Open intake on migrated projects defaults to direct `DESK` admission (`allowed: true`).
    - Configured project with `requiresExceptionForDesk: true` requires exception record (`code: 'EXCEPTION_REQUIRED', allowed: false`).
    - With authorized manager exception record: `allowed: true`.
    - Whitelisted `MANIFEST` channel: `allowed: true`.
    - Un-whitelisted `KOBO` channel: `allowed: false, exceptionRequired: true`.
  - **Real Migrated HTTP Scoped Access**:
    - Mounted Express app with supertest against the migrated database on disk.
    - Verified technician in Lab A sees only Lab A reports and receives 403 on out-of-scope Kenyan report.
    - Verified national user in GTM sees only GTM reports in search.
    - Verified PM in Kenya sees only Project Beta reports.
  - **Rollback Boundary Transparency**:
    - Old-code query execution verified on additive schema without column drops or type changes. Full multi-version production rollback rehearsal across deployed versions remains a release prerequisite pending staging deployment.
  - **Owned Disposable Fixtures**:
    - Fixture lifecycle strictly owned via `journey_db_isolation.cjs` (`.tmp_journey_runner_*`), preventing concurrent test interference.

---

### Issue #124 Residual Follow-Up: Result Reports Query/Filter Lifecycle & Truthful No-Match

#### Context & Live Reproduction on 7516f0e
Following production release `7516f0e`, Codex live verification by `SUPER_ADMIN` on `/result-reports` identified a residual query/filter state desynchronization:
- **Reproduction**:
  1. Submitted sample search `GTM26-0002` in "All Versions" -> returned 1 correct report (v1 `PUBLISHED`).
  2. With `GTM26-0002` visibly remaining in the search input, clicked the "Superseded" status tab.
  3. Instead of returning 0 reports (as `GTM26-0002` has no superseded version), the table rendered the unrelated `GTM26-0003` superseded v1 report (1 report found).
- **Root Cause in `client/src/pages/ResultReports.jsx`**:
  1. `fetchReports` depended on `[query, pagination.limit, paramProjectId, statusFilter]`.
  2. Every keystroke updated `query`, re-creating `fetchReports`.
  3. An effect `useEffect(() => { fetchReports(1, '', statusFilter); }, [fetchReports, statusFilter])` was tied to `fetchReports` and `statusFilter`. Consequently, typing a query triggered an unfiltered request that restored all four rows before submission.
  4. Clicking a status tab (`onClick`) called `fetchReports(1, query, tab.id)` while `setStatusFilter(tab.id)` simultaneously triggered the effect to call `fetchReports(1, '', tab.id)`, launching two competing requests.
  5. Without a cancellation or stale-response guard, the unfiltered request (`q=''`) overrode the filtered request, surfacing `GTM26-0003` superseded v1.

#### Implementation Fix (`client/src/pages/ResultReports.jsx`)
1. **Separation of Draft Input vs. Applied Query**:
   - `query` tracks the active typing draft inside the search input.
   - `appliedQuery` tracks the explicitly submitted search term.
   - Typing into the input updates only `query` and never dispatches network requests or alters the displayed results.
   - Form submission (`handleSearch`) trims `query`, updates `appliedQuery`, and dispatches a search at page 1.
2. **Stable Lifecycle & Request Runner**:
   - `fetchReports` uses stable `useRef` handles (`appliedQueryRef`, `statusFilterRef`), depending strictly on `[pagination.limit, paramProjectId]`.
   - Initial mount runs exactly once via a mount-only `useEffect`.
   - Tab switching (`handleStatusFilterChange`) updates `statusFilter` and dispatches `fetchReports(1, appliedQuery, newStatus)`, guaranteeing the applied search (`GTM26-0002`) is strictly preserved.
   - Pagination (`handlePageChange`) dispatches `fetchReports(newPage, appliedQuery, statusFilter)`.
   - Search clear button (`handleClearSearch`) clears both `query` and `appliedQuery`, dispatching an unfiltered search (`q=''`).
3. **In-Flight Cancellation & Stale Response Guard**:
   - Each request increments an internal sequence counter (`requestIdRef.current`).
   - Active in-flight requests are aborted using an `AbortController` signal before a new request begins.
   - When a response resolves, it verifies `requestId === requestIdRef.current`. Stale or delayed responses arriving out of order are dropped immediately without modifying component state or loading flags.

#### Automated Contract & Component Tests (`server/tests/contracts/result_reports_filter_lifecycle.test.js`)
Executed `cmd.exe /c "npx jest tests/contracts/result_reports_filter_lifecycle.test.js"` in `server`:
- **16/16 tests passed** in 3.949s:
  1. `[PASS]` `Renders page header, search input, and 3 filter tabs with Published active by default` (SSR).
  2. `[PASS]` `Renders clear button when initialQuery is provided` (SSR).
  3. `[PASS]` `Renders populated reports table rows with version and client badges` (SSR).
  4. `[PASS]` `Renders truthful empty state when initialReports is empty` (SSR).
  5. `[PASS]` `Initial mount executes exactly 1 query with default PUBLISHED and empty search`.
  6. `[PASS]` `Typing in search input updates draft query WITHOUT dispatching requests or resetting table`.
  7. `[PASS]` `Submitting search form dispatches request with trimmed query and sets applied query`.
  8. `[PASS]` `Exact transition: clicking Superseded tab retains applied query and does NOT fire empty-string request` (`q='GTM26-0002'&status='SUPERSEDED'`).
  9. `[PASS]` `Clicking All Versions tab retains applied query and dispatches status ALL`.
  10. `[PASS]` `Clear button resets draft query, resets applied query, and dispatches unfiltered search`.
  11. `[PASS]` `Pagination preserves applied query and status filter on page change`.
  12. `[PASS]` `Aborts in-flight request and drops delayed stale response arriving out of order`.
  13. `[PASS]` `GTM26-0002 in All Versions returns exactly 1 report (v1 PUBLISHED)`.
  14. `[PASS]` `GTM26-0002 in Superseded strictly returns 0 reports (truthful no-match)`.
  15. `[PASS]` `Unfiltered status=SUPERSEDED returns GTM26-0003 v1 (demonstrating why empty query was a bug)`.
  16. `[PASS]` `GTM26-0003 in All Versions returns both v1 and v2`.

#### Isolated Headless Chrome CDP Browser Journey (`server/scripts/run_result_reports_browser_evidence.cjs`)
Executed against a disposable synthetic SQLite database with active `DB_ISOLATION_REFUSAL` guard:
- **7/7 steps passed (Exit 0)**:
  1. `[PASS]` `Step 1: /result-reports rendered with Published tab active (3 published reports)`.
  2. `[PASS]` `Step 2: "All Versions" tab active with all 5 reports displayed`.
  3. `[PASS]` `Step 3: Search for "GTM26-0002" filtered to exactly 1 report`.
  4. `[PASS]` `Step 4: Exact Transition: Retained "GTM26-0002" input, strictly displayed 0 reports ("No reports found"), and GTM26-0003 did NOT appear`.
  5. `[PASS]` `Step 5: "All Versions" tab restored 1 report matching "GTM26-0002"`.
  6. `[PASS]` `Step 6: Search cleared, input reset to empty, and all 5 reports restored`.
  7. `[PASS]` `Step 7: Saved evidence JSON and high-resolution viewport screenshot`.
- **Evidence Artifacts**:
  - Screenshot: `artifacts/evidence-journeys/result_reports_filter_lifecycle_transition.png`
  - Evidence JSON: `artifacts/evidence-journeys/result_reports_filter_lifecycle_evidence.json`

#### Invariants & Constraints Maintained
- **Zero Production Database Mutations**: Production database (`46.19.33.37`) and local `dev.db` untouched.
- **Backend Integrity**: No backend authorization, report contents, report history, or share links modified.
- **PR #130 Candidate Unmodified**: PR #130 head `5ad5012` remains completely frozen and undeployed.
- **Issue Governance**: Issue #124 residual documented; Codex handles public issue communication and closure.
