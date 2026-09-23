# Contributor Issues Implementation & Verification Evidence Matrix

Work Package: `WP/contributor-issues-2026-09`  
Repository: `https://github.com/yigini/soilfer-lims`  
Implementation Lead: Antigravity  
Review & Communication Lead: Codex  
Baseline Commit: `762c46e`  
Current Production Release: `v3.5.23` (`3241d4efdb8562575815328a7396c794ee9c12ac`)  
Production Serving Image: `soilfer-lims:v3.5.23-3241d4e` (sha256:`9b1d62aa3606c29e6fc63211c6c92970365d5e8197ff831f6ef4f5836ab2db6f`)  
Date: 2026-09-23  

Status Summary:
- **Total Tracked Issues**: 18
- **Independently Accepted & Closed**: 8 (#115, #116, #118, #119, #122, #124, #125, #126)
- **Open**: 10 (7 with fixes deployed/live awaiting individual workflow acceptance: #113, #114, #117, #120, #121, #123, #128; 3 external/device/governance items: #102, #103, #104)

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
| **WP-2 Country/Kobo v2** | 0 | Country project separation, Kobo explicit mapping, 0-to-0 preservation risk, client exception spoofing, operation binding | Reproduced & Implemented Locally | `e2fff7e` | `project_policy_v2.test.js` (26/26), `kobo_explicit_mapping.test.js` (25/25), `soilfer_country_migration.test.js` (3/3), `programme_readers_and_rollups.test.js` (9/9) | `7516f0e` | Populated Result/QC/Report fixtures verified (35,197 samples, 4 results, 3 QC batches, 3 reports); report checksums intact; HTTP exception verification enforced with strict operation binding (sample, project, lab, channel, non-empty reason) passing all 5 Monitor probes. | Production migration hold remains active. | Released to Production (`7516f0e`); Codex Verification and Closure Pending |
| **#118** | 1 | QC batch inspection link disconnect, unhandled QC disposition, failed QC bypassing release gates | Reproduced & Implemented Locally | `1ed46ef` + `5ad5012` (PR #130) | `qc_disposition_release_gate.test.js` (20/20), `qc_inspection_display_legacy_limits.test.js` (17/17), client production build (`vite build` clean in 7.18s), isolated Headless Chrome CDP browser journey (5/5 passed, `qc_inspection_legacy_reject_evidence.json`) | `2032617` (v3.5.18) | Canonical batch inspection returns actual control values, affected work items with canonical sample ID, original ID, lab ID, run profile, and notes. Unresolved failed QC strictly blocks sample approval (409) and report generation (409). Permitted disposition schema enforced; manager disposition override is atomic inside transaction, updates result flags while preserving non-QC invalidity flags (`MANUAL_INVALID`, `ORIGINALLY_INVALID`) and immutable released/superseded records; multi-step validity probe verified (originally invalid result stays invalid across FAIL -> PASS and PROCEED_WITH_WARNING); fails closed on DB errors; REANALYZE_BATCH updates work items to REANALYSIS_REQUIRED; audit.qc queue counts only unresolved batches. Follow-up display corrections: legacy `REJECT_REANALYSIS` mapped to prominent read-only banner (`REJECTED FOR RE-ANALYSIS (Legacy)`) with author, timestamp, justification, and dedicated read-only card; legacy `ACCEPT` kept neutral (`RECORDED LEGACY ACCEPT (Under Review)`, slate styling); factual audit history notices without sweeping ISO 17025 claims; editable form and old reason prefill strictly suppressed; blanks with missing limits render `"Not recorded"` (never 0, never implicit 0.05); blank status inference enforces strict `parseFiniteNumber` (accepts finite numbers, strings, and valid zero `0`, while rejecting empty/whitespace/false/array/non-finite inputs); explicit recorded statuses strictly preserved. Populated batch SSR and initial SSR verified. Verified in headless Chrome CDP with screenshots `qc_inspection_legacy_reject_modal.png` and `qc_inspection_legacy_reject_card.png`. Independent live acceptance verified on production. | Historical released results and persisted decisions remain immutable. | **CLOSED** (2026-09-22; [Issue #118 comment 5776124568](https://github.com/yigini/soilfer-lims/issues/118#issuecomment-5776124568)) |
| **#119** | 1 | Confusion between canonical, lab, and original IDs; 26-task fixture truncation; derived fractions vs ordered tasks; primary action navigation loop and stale-ID selection leakage | Reproduced & Implemented Locally | `1ed46ef` + `5ad5012` (PR #130) + `b69ab45` (PR #133) | `sample_assignment_identity.test.js` (8/8), `sample_assignment_manager_route.test.js` (23/23), React 18 test renderer mounted transition probe (`pr133-mounted-review.cjs`), client production build, isolated Headless Chrome CDP browser journey (11/11 passed, `sample_assign_scoped_controls_evidence.json`) | `c5ed62e` (v3.5.19) | Disambiguated canonical UUID (`sampleId`), sample lab ID (`labId`), and field ID (`originalId`); honest task pagination (26-task fixture exposes all 26 tasks with honest pagination metadata); bidirectional texture equivalence (`TEXTURE` satisfied by 3 fractions `SAND, SILT, CLAY`, and composite `TEXTURE` satisfies fractions); independent gate evaluation respecting SKIPPED/WAIVED; sampleWorkspace extracts linked QC batches to gate final approval; unassignedCount calculated across all work items; ManagerQueue routes assign to `?tab=work` and review to `?tab=review`. Prioritized canonical ID lookups (`findUnique({ where: { id } })`) before labId/originalId aliases to prevent cross-column collisions. Resolved live icon ReferenceError. Fixed primary action navigation loop by keeping manager on sample page with focused scoped bulk preview bar ("11 Selected"). Required explicit technician selection before enabling "Assign Selected" button; cancel clears selection and technician choice. Added state reconciliation in `SampleDetail.jsx` and `WorkItemsTable.jsx` clearing selections across sample navigation (`useEffect([id])`), auto-pruning ineligible items (`useEffect([workItems])`), and validating current eligible IDs inside `handleBulkAssign` (dispatching 0 network calls if all selected items are ineligible). Verified under React 18 test renderer: same-instance sample parameter change, `WORKITEM_CHANGED` partial eligibility refresh, bulk button dispatching only eligible IDs, and all-ineligible control reset. Independent live Spanish LAB_MANAGER verification passed without mutations. | Manual assignment requires manager authority. | **CLOSED** (2026-09-22 14:01:12 UTC; [Issue #119 comment 5777893938](https://github.com/yigini/soilfer-lims/issues/119#issuecomment-5777893938)) |
| **#121** | 2 | Label print dialog blank second page, forced page breaks, and false current-clock dates | Reproduced & Implemented Locally | `1ed46ef` + working tree | `label_print.test.js` (7/7 passed), Headless Chrome CDP print journey (`verify_issue121_label_print.cjs` 6/6 passed), client build (`vite build` clean in 14.95s) | `7516f0e` (base) | Dual standard (101x54mm) and compact (50x25mm) thermal label formats; 100% offline QR code generation via `qrcode`; portal to `#label-print-portal` at `document.body` with print CSS isolation; `.sample-label-page:not(:last-child)` page break with `:last-child` suppression and `height: auto` eliminating blank 2nd page on single labels and blank 4th page on 3-label batches; truthful date extraction resolving persisted `receptionDate` and `collectionDate` without inventing current-clock (`new Date()`); honest unknown (`—`, `Coll: —`) when dates are missing; verified in real Headless Chrome CDP via Samples and Reception journeys with exact 1-page (single) and 3-page (batch) PDF stream counts; dynamic `document.title = Label-${sanitizedSampleId}` (`Label-S004`) and `Labels-Batch-${count}` (`Labels-Batch-3`) restored on `afterprint`. | Safari browser print preview and physical thermal printer hardware checks remain pending. | Code updated in `soilfer-lims-label-print`; physical printer and Safari checks pending. Strictly OPEN (`Refs #121`) |
| **#122** | 2 | LabMethods defaults failing or silently falling back across labs; URL scope ignored, stale-state cross-lab save corruption, and delayed body race | Reproduced & Fixed Locally | `bd4e577` + working tree (PR #134) | `lab_method_defaults.test.js` (6/6 passed), React 18 mounted verification (`issue122-mounted-verification.cjs` 6/6 passed), client build (`vite build` clean in 15.54s) | `c5ed62e` (v3.5.19 base) | Scoped loading/saving for target lab; reactive router search/location (`useSearchParams`, `useLocation`) honors URL scope and same-mounted incoming transitions; clears and binds loaded defaults/error/wizard to target lab; dropdown changes preserve router history state; prevents stale/error/loading state from enabling or dispatching saves (0 writes); revalidates generation and target after body resolution and before state commits; invalidates obsolete requests on cleanup (`activeRequestIdRef`). Contract tests verify 403 cross-lab access, 403 unauthorized role, 400 mismatched methods, honest empty state. | Requires lab manager or global admin role. | Undergoing verification (Refs #122); 9 other shipped issues awaiting acceptance. Strictly OPEN |
| **#128** | 2 | Workbench deep links broken for specific workItemId and sampleId | Reproduced & Implemented Locally | `1ed46ef` | `workbench_deep_link.test.js` (13/13), client build (`vite build` clean in 7.26s) | `7516f0e` | Central authorization precedes diagnostic checks; canonical sample ID resolution across column collisions; rejects contradictory cross-column sample collisions with 400 CONTRADICTORY_IDENTIFIERS; technician assignment validation (fail closed); outside-default-page status resolution (COMPLETED); cross-lab access rejected with 403 without leaking details; non-existent items/samples return 404; `WorkbenchShell` `activeTargetRef` retains target context across subsequent fetches without recursive retry loops; `WorksheetArea` highlights selected work item. | Forbidden items return 403 without leaking other labs' data. | Code LIVE in `v3.5.19`; Individual live workflow acceptance pending. OPEN |
| **#123** | 2 | Workbench search input and pagination issues | Reproduced & Implemented Locally | `1ed46ef` | `workbench_search.test.js` (8/8), client build (`vite build` clean in 7.26s) | `7516f0e` | Multi-field search across canonical UUID, sample lab ID, original field ID, analysis code, and analysis display name (e.g. "Soil Organic Carbon" -> SOC); truthful no-match state; clearing search restores full authorized queue; cross-lab search isolation strictly excludes other labs' items. | Server/client dual search filters. | Code LIVE in `v3.5.19`; Individual live workflow acceptance pending. OPEN |
| **#124** | 2 | Result reports search failing across client, project, sample queries; residual query/filter lifecycle race on status tab transition | Reproduced & Implemented Locally | `1ed46ef` + `efc2b9c` (PR #131) | `report_search.test.js` (7/7), `result_reports_filter_lifecycle.test.js` (18/18), local browser CDP evidence (`run_result_reports_browser_evidence.cjs` 8/8 steps exit code 0), client build (`vite build` clean in 7.10s) | `2032617` (v3.5.18) | Fixed Prisma schema relation crash on `projectId` search; multi-field search across client first/surname, project code/name, and sample identifiers (canonical UUID, lab ID, and field original ID); discoverable superseded report versions with `status=SUPERSEDED` and `status=ALL` while defaulting to `PUBLISHED`; UI status filter pills with distinct superseded badge; cross-lab access isolation. Separated draft search input (`query`) from applied query state (`appliedQuery`); cleanup-safe initialization/scope synchronization effect replaces one-shot `hasMountedRef` guard; fully supports React 18 StrictMode setup-cleanup-setup development replay; tracks same-instance `projectId` URL route changes while strictly preserving user's applied search query without unfiltered competing requests; `AbortController` in-flight cancellation; sequence-based stale-response guard (`requestIdRef`) dropping out-of-order delayed responses; strictly preserves applied query across status tab and page changes (`GTM26-0002` + Superseded -> 0 reports, suppressing unrelated `GTM26-0003`); real CDP browser journey (8/8 passed). Independent live acceptance verified on production. | Scoped to authorized projects/labs; zero production or database schema mutations; backend authorization and share links preserved. | **CLOSED** (2026-09-22; [Issue #124 comment 5776176422](https://github.com/yigini/soilfer-lims/issues/124#issuecomment-5776176422)) |
| **#125** | 3 | Inventory aggregation anomalies, expired lots vs usable stock confusion | Reproduced & Implemented Locally | `278d32b` + working tree | `inventory_aggregation.test.js` (12/12 passed), `localization_and_user_display.test.js` (13/13 passed), client build (`vite build` clean in 13.31s) | `7516f0e` | Usable stock strictly aggregates available, non-expired lots; expired lots tracked separately without precedence masking; items at or below reorder threshold flagged as low stock; missing quantities represented truthfully as null (not 0); usableMissingQuantityLotCount tracked so mixed known/unknown lots treat usable stock as a subtotal (`≥ X`, `SUBTOTAL` badge) and distinguish confirmed low stock (`LOW`) from uncertainty (`LOW? (UNCERTAIN)` / `COUNT NEEDED`); GET /api/inventory/alerts is 100% pure (zero DB mutations); FEFO strictly excludes expired lots. UI displays OUT OF STOCK, EXPIRED, and SUBTOTAL badges without mutual masking; inventory subtotal and uncertainty badges localized across all 5 locales (#116). | Display/aggregation fix; zero schema changes. | Code LIVE in `v3.5.19`; Individual live workflow acceptance pending. OPEN |
| **#117** | 3 | Failed reception criterion not persisting or reflecting in UI; Reception TDZ runtime crash before first render | Reproduced & Implemented Locally | `81487b1` | `reception_compliance.test.js` (18/18 passed), `reception_compliance_component.test.js` (12/12 passed), `reception_route_smoke.test.js` (6/6 passed including release prerequisite), isolated Headless Chrome CDP browser journey (6/6 passed, `reception_browser_journey.json`), client build (`vite build` clean) | `7516f0e` | Authoritative saved state reflects OK/N/A/FAIL with visible badge indicators; atomic single-event state update in ComplianceChecklist (`onChange(newValue)`) prevents stale-closure overwrite in parent Reception; non-conformance flag auto-syncs with failed checklist items and clears upon correction back to PASS unless custom reason supplied; rejected sample intake persists checklist and ncReason in receptionData and metadata.nonConformance, transitioning to RECEIVED_REJECTED; inspecting or resuming draft rehydrates checklistData truthfully. Resolved P1 TDZ ReferenceError by relocating mode-cleanup effect below checklistData useState declaration; verified in real isolated Headless Chrome (CDP) parent and child together (`reception_browser_journey_verified.png`), including fail selection, note entry, correction back to OK, and synthetic draft rehydration; route smoke tests enforce client/dist release prerequisite as explicit non-silent assertion. | Non-conformance requires explanation note. | Code LIVE in `v3.5.19`; Individual live workflow acceptance pending. OPEN |
| **#113** | 3 | Reception compliance checklist and redundant/unauthorized dispositions | Reproduced & Implemented Locally | `81487b1` | `reception_compliance.test.js` (18/18 passed), `reception_compliance_component.test.js` (12/12 passed), `reception_route_smoke.test.js` (6/6 passed), isolated Headless Chrome CDP browser journey (6/6 passed, `reception_browser_journey.json`), client build (`vite build` clean) | `7516f0e` | Reception compliance checklist evaluation enforced upfront before sample creation, guaranteeing zero DB mutations on 400 rejection: all-pass admits sample routinely without redundant gates; permitted N/A (CoC strictly on walk-in) accepted; prohibited N/A (formal shipment CoC, or container/label/condition/quantity) rejected with 400 INVALID_CHECKLIST_NA and disabled in UI; incomplete, empty, or omitted checklist rejected with 400 INCOMPLETE_COMPLIANCE_CHECKLIST; legacy alias normalization fails closed on conflicting aliases and tracks unknown keys; failed check blocks routine acceptance for reception staff (403 COMPLIANCE_FAILURE_EXCEPTION_REQUIRED); staff self-authorization strictly prohibited; manager exception required to admit with ADMITTED_WITH_EXCEPTION in history. In real browser journey, verified Walk-in mode enables CoC N/A (`aria-checked="true"`), and switching Walk-in to Project mode triggers useEffect interactive cleanup resetting prohibited CoC N/A to undefined (`aria-checked="false"`). | Manager or admin exception required to admit failed compliance items. | Code LIVE in `v3.5.19`; Individual live workflow acceptance pending. OPEN |
| **#120** | 4 | Dashboard vs manager task list conflation; large field registry overwhelming queues; Kobo notification deep link alignment and search/filter preservation across view switches | Reproduced & Implemented Locally | `1ed46ef` + `0341151` (PR #138) + `1ee1b0b` (PR #139) | `dashboard_manager_views.test.js` (7/7 passed), `operational_views_and_manager_queue.test.js` (10/10 passed), `kobo_notification_view_link.test.js` (5/5 passed), isolated Headless Chrome CDP mounted navigation journey (`run_samples_mounted_nav_evidence.cjs` 3/3 journeys exit code 0, `samples_mounted_nav_evidence.json`), client production build (`vite build` clean in 1m 6s) | `3241d4e` (v3.5.23) | Daily lab queue defaults to physically received and active samples (`view=daily`, `ACTIVE_LAB_STATUSES = ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'SUBMITTED_PARTIAL']`); field arrivals awaiting intake separated (`view=expected`, `EXPECTED_STATUSES = ['EXPECTED', 'COLLECTED']`); full field registry accessible across all stages (`view=registry`); returned sample rows and `views.daily`/`views.expected` aggregation counts strictly agree; manager exceptions lane surfaces only unresolved QC failures; honest pagination units. Notification deep link in Kobo intake updated to route to Expected Arrivals view (`/samples?view=expected&projects=${encodeURIComponent(projectCode)}&labs=${encodeURIComponent(currentConfig.labId)}`). Client Samples page preserves active search text and advanced filters (field ID, project, lab, batch) across view switches (`daily` <-> `expected` <-> `registry`), while clearing status filter on preset transitions; direct URL navigation, notification click, and Reset button verified in mounted browser CDP. Production release v3.5.23 verified on host with 28/28 postflight checks. | Kobo remains an optional external intake channel; core laboratory operations decoupled from Kobo availability; provenance and expected-arrival records preserved without data loss. | Code LIVE in `v3.5.23`; Individual live workflow acceptance pending. Strictly OPEN |
| **#114** | 4 | Map centering issues, lack of fullscreen, map layer fallbacks, hardcoded lab coordinates | Reproduced & Implemented Locally | `81487b1` | `map_view.test.js` (16/16 passed), `lab_directory_and_auth_profile.test.js` (5/5 passed), client production build (`vite build` clean) | `7516f0e` | Removed fake hard-coded LAB_DEFAULT_COORDINATES dictionary; sourced authorized actual laboratory configuration from schema (Lab.location) and auth (user.lab, GET /api/labs/:id); documented GET /api/labs/:id public directory policy; verified auth and profile resolution for configured vs unconfigured laboratories (null location handled truthfully without fake fallbacks); scoped authorization proven: cross-lab directory lookup succeeds (200), whereas cross-lab operational workspace access fails closed (403 TARGET_OUTSIDE_SCOPE); parseCoordinates normalizes and validates geographic bounds; HTML5 Fullscreen API guarded with document.fullscreenEnabled and denial catch; Leaflet invalidateSize triggered on fullscreen toggle; Esri MLA terms and OpenStreetMap Tile Usage Policy cited. | Physical printer/GPS field checks pending. | Code LIVE in `v3.5.19`; Individual live/map acceptance and relevant field evidence pending. OPEN |
| **#115** | 4 | Navigation order not reflecting canonical laboratory journey | Reproduced & Implemented Locally | `1ed46ef` + `0a7cbde` (PR #132) | `navigation_order.test.js` (7/7 passed), client production build (`vite build` clean) | `c5ed62e` (v3.5.19) | Reorganized navigation items into canonical laboratory journey sequence via production helper `client/src/navigationConfig.js`: Dashboard (`/`) -> Projects (`/projects`) -> Reception (`/reception`) -> Samples Registry (`/samples`) -> Manager Task List (`/manager-queue`) -> Quality Assurance (`/qa`) -> Data Results (`/results`) -> Result Reports (`/result-reports`) -> Spectral Library (`/spectral`) -> Inventory (`/inventory`) -> Equipment (`/equipment`) -> Staff (`/staff`) -> My Laboratory (`/my-lab`) -> Admin (`/admin`) -> About (`/about`). Order contract tests execute production module directly across all 6 roles. Independent live Spanish LAB_MANAGER verification confirmed sidebar order. | Role permissions unchanged. | **CLOSED** (2026-09-22 14:00:48 UTC; [Issue #115 comment 5777888265](https://github.com/yigini/soilfer-lims/issues/115#issuecomment-5777888265)) |
| **#116** | 4 | Hardcoded English strings in Spanish/multilingual UI | Reproduced & Implemented Locally | `278d32b` + `0a7cbde` (PR #132) | `localization_and_user_display.test.js` (18/18 passed), 450 ICU checks passed, client production build (`vite build` clean) | `c5ed62e` (v3.5.19) | Removed hardcoded English strings across dashboard, manager task list, QA, navigation, and inventory in all 5 supported locales (`en`, `es`, `es-419`, `fr`, `pt`). Standardized manager action terminology to "Lista de tareas" in Spanish/Portuguese and "Manager Task List" in English; localized queue units, map controls, view selector pills, dynamic row descriptions/actions, decision tabs, and newly added inventory subtotal, count needed, confirmed low, and uncertain low stock badges; localized header Help button ("Ayuda" in Spanish, "Aide" in French, "Ajuda" in Portuguese, "Help" in English) across all locales. Scientific codes remain untranslated scientific symbols. Independent live Spanish LAB_MANAGER verification confirmed translated UI, visible "Ayuda" and "Plegar". | Translation files maintain valid JSON syntax. | **CLOSED** (2026-09-22 14:00:58 UTC; [Issue #116 comment 5777891149](https://github.com/yigini/soilfer-lims/issues/116#issuecomment-5777891149)) |
| **#126** | 4 | Raw usernames displayed instead of proper names in messages/tasks | Reproduced & Implemented Locally | `1ed46ef` | `localization_and_user_display.test.js` (12/12 passed), client production build (`vite build` clean) | `7516f0e` | Resolved stored proper display name (`user.name`) with safe username fallback across message lists, conversation threads, notification toasts, task assignment dropdowns, and header drawers; leading/trailing whitespace safely trimmed; historical/deactivated users and missing names fall back gracefully; audit logs and reviewer attributions retain stable immutable username identifiers. | Passwords and private profile data excluded. | Code LIVE in `v3.5.19`; Individual live workflow acceptance pending. OPEN |
| **#102** | 5 | Physical mobile device testing (iOS Safari, Android Chrome) | Open | Pending | Mobile device testing execution sheet (`docs/test-sheets/mobile-device-testing.md`) | `7516f0e` | Real physical device testing sheet established covering touch targets, virtual keyboard pan/zoom, horizontal scrolling, sticky headers, camera permissions, and offline draft sync. Emulation alone is insufficient. | Requires physical device validation on deployed release candidate. | Actual iOS Safari / Android Chrome hardware evidence pending. OPEN |
| **#103** | 5 | User membership reconciliation & country access grants | Open | Pending | Read-only discrepancy ledger (`docs/governance/membership-reconciliation-ledger.md`) | None (Gate) | Governance framework and illustrative archetypes mapped against real Prisma schema (`User.labId`, `User.projects`, `User.countries`, `ProjectLab`); scopeGuard global access rules documented (`SUPER_ADMIN` only); no invented junction tables; production migration hold strictly active. | Under production migration hold. | Reconciliation apply and access expansion NOT performed; governance hold remains. OPEN |
| **#104** | 5 | Separate Laboratory Dashboard sample count discrepancy | Open | Pending | External reconciliation protocol (`docs/governance/external-dashboard-reconciliation.md`) | None (Gate) | Reconciled metric definitions (Field Registry vs Expected vs Active Lab Work); 3,580 distinguished as reporter snapshot (Luis, 15 Sept 2026); external dashboard architecture documented as unknown; protocol marked as preparation framework; synthetic backfill prohibited. | Requires reporter confirmation from Luis. | Separate dashboard discrepancy not established as fixed; investigation/reporter clarification pending. OPEN |


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
  - `server/tests/contracts/label_print.test.js` (7/7 passed):
    1. `GET /api/public/branding` provides branding configuration without requiring auth.
    2. Workspace projection enforces `canPrintLabel` capability gate based on intake rejection (`false` for `RECEIVED_REJECTED` and `REJECTED`, `true` for standard processing).
    3. Pre-arrival `EXPECTED` sample allows printing with `'Pending'` permanent lab identifier and original field ID in QR.
    4. Label format specifications match thermal printer physical dimensions (Standard: 101×54mm, Compact: 50×25mm).
    5. Sanitizes sample identifier for `document.title` print naming isolation (`Label-${sanitizedSampleId}`).
    6. Print CSS prevents blank extra page with last-child break suppression (`.sample-label-page:not(:last-child)` break-after: page; `:last-child` break-after: auto) and auto body height (`height: auto !important; min-height: 0 !important`).
    7. Truthful date binding contract: binds persisted `receptionDate`, `custodyHandoverAt`, and `collectionDate` without inventing current clock (`new Date()`); rejects DRAFT/COLLECTED `createdAt` promotion (returns null); verifies Reception prop mapping respects recorded custody without render clock.
    8. `POST /api/reception/intake` returns persisted `receptionDate`, `custodyHandoverAt`, and `collectionDate` in its JSON response for immediate caller consumption.
  - **Headless Chrome CDP Browser & Print-to-PDF Journey Suite (`server/scripts/verify_issue121_label_print.cjs`, 11/11 passed across Part 1 & Part 2)**:
    - **Part 1: Fixture-Level Card Layout & Print CSS Output Checks (Isolated HTML Stream, 6/6 passed)**:
      - Standard Label (101×54mm) Single Sample `S004`: exactly **1 page** PDF stream; suggested title `Label-S004`; truthful intake date `2026-09-05` and truthful receipt date `Rec: 2026-09-05` (current clock NOT invented).
      - Compact Cryovial Label (50×25mm) Single Sample `S004`: exactly **1 page** PDF stream; suggested title `Label-S004`; truthful receipt date `LAB-GTM • REC: 2026-09-05`.
      - Standard Label (101×54mm) Batch 3 Samples: exactly **3 pages** PDF stream (zero blank 4th page); suggested title `Labels-Batch-3`; Sample 1 (`Coll: 2026-08-25`, `Intake: 2026-09-01`), Sample 2 (`Rec: 2026-09-05`, `Intake: 2026-09-05`), Sample 3 with missing dates (`Coll: —`, `Intake: —`).
      - Compact Cryovial Label (50×25mm) Batch 3 Samples: exactly **3 pages** PDF stream (zero blank 4th page); suggested title `Labels-Batch-3`.
      - Reception Journey Immediate Print (Standard): exactly **1 page** PDF stream; truthful reception timestamp (`2026-09-22`, `Coll: 2026-09-20`).
      - Reception Journey Immediate Print (Compact): exactly **1 page** PDF stream; truthful reception timestamp (`LAB-GTM • REC: 2026-09-22`).
    - **Part 2: Mounted Route & Component Dialog Lifecycle Journeys (Real React Portals, Caller Projections & Print Streams, 5/5 passed)**:
      - Journey 2.1: Mounted SampleDetail Route (`/samples/SMP-S004-GTM`) Single Standard Label Lifecycle: clicks "Print label"; confirms real React portal (`#label-print-portal`) mounted to `document.body`; generates offline QR; binds truthful dates (`2026-09-05`, `Rec: 2026-09-05`); updates title to `Label-S004`; generates exact **1 page** PDF stream; restores title to `SoilFER LIMS` on `afterprint`.
      - Journey 2.2: Mounted SampleDetail Format Switch to Compact (50×25mm): toggles format; verifies compact card in `#label-print-portal`; generates exact **1 page** PDF stream; unmounts portal on dialog close.
      - Journey 2.3: Mounted Batch Label Dialog Lifecycle (3 Samples: Standard & Compact): mounts 3 sample batch; updates title to `Labels-Batch-3`; Standard print stream: exact **3 pages** (0 blank 4th page); title restored on `afterprint`; Compact print stream: exact **3 pages** (0 blank 4th page).
      - Journey 2.4: Reception Route Immediate Print API & Caller Projection Lifecycle: executes physical intake via `POST /api/reception/intake` with recorded `custodyHandoverAt`; verifies response includes persisted `receptionDate`, `custodyHandoverAt`, `collectionDate`; verifies Reception caller projection preserves persisted dates and excludes `createdAt`; print stream: exact **1 page**.
      - Journey 2.5: Provenance Truthfulness on DRAFT & Custody Records: DRAFT `createdAt` rejected as intake (returns `null`, renders `'—'`); recorded `custodyHandoverAt` honored as intake when `receptionDate` is null (renders `'2026-09-01'`); zero render-time clock substitutions.
    - Evidence report: `artifacts/evidence-journeys/label_print_browser_journey.json`.
- **Outstanding Verification & Boundaries**:
  - Browser Print Preview: Headless Chrome CDP Save-as-PDF and print preview layout verified 100%.
  - Safari Print Preview: **PENDING** physical or macOS Safari environment.
  - Physical Thermal Printer: **PENDING** real continuous thermal printer hardware testing.
- **Client & Server Implementation**:
  - `client/src/components/common/LabelPrintDialog.jsx`:
    - Portal rendering to `#label-print-portal` at `document.body` outside modal tree with `@media print` CSS isolation.
    - Suppressed extra blank page by replacing unconditional page breaks with `.sample-label-page:not(:last-child) { page-break-after: always !important; break-after: page !important; }` and `.sample-label-page:last-child, .sample-label-page:last-of-type { page-break-after: auto !important; break-after: auto !important; }`.
    - Set `html, body { height: auto !important; min-height: 0 !important; }` in `@media print` to prevent 100% viewport container overflow.
    - Added `max-width`, `max-height`, and `overflow-hidden` with `shadow-none` on printed cards.
    - Replaced `new Date()` calls with pure resolvers: `resolveIntakeDate(sample)` binds persisted `receptionDate`, `receivedDate`, `intakeDate`, `custodyHandoverAt`, and `receptionData` JSON; strictly returns `null` for creation-only records (`DRAFT`/`COLLECTED`).
    - 100% offline QR code generation via `qrcode` (no third-party network dependency).
    - Dual format toggle: Standard (101×54mm / 4"×2") and Vial/Tube Compact (50×25mm).
    - Dynamic print title management (`Label-${sanitizedSampleId}` or `Labels-Batch-${count}`) restored on `afterprint`.
  - `server/controllers/receptionController.js`:
    - `processIntake` JSON response returns persisted `receptionDate`, `custodyHandoverAt`, `collectionDate`, `status`, `assignedLab`, `projectCode`, `fieldMetadata`, and `receptionData` for immediate caller consumption.
  - `client/src/pages/Reception.jsx`: passed persisted `receptionDate`, `custodyHandoverAt`, and `collectionDate` from `processIntake` result to `LabelPrintDialog`, eliminating `createdAt` and current clock fallbacks.
  - `client/src/pages/SampleDetail.jsx`: preserved `receptionDate`, `custodyHandoverAt`, and `collectionDate` on fallback `printTarget`, eliminating `createdAt`.

### Phase 2: Issue #122 Lab Methodology Defaults & Isolation
- **Tests Executed**:
  - `server/tests/contracts/lab_method_defaults.test.js` (6/6 passed):
    1. Setting Lab A default to Dumas updates Lab A defaults API without affecting Lab B (which falls back to Walkley-Black).
    2. New work items in Lab A receive Dumas combustion while Lab B receives Walkley-Black.
    3. Cross-lab access denial: Lab A manager cannot view or modify Lab B defaults (HTTP 403 `FORBIDDEN`).
    4. Unauthorized role without `MANAGE_ANALYSES` cannot modify lab defaults (HTTP 403 `FORBIDDEN`).
    5. Supplying an unavailable or mismatched methodology ID is rejected (HTTP 400).
    6. Fresh lab with no overrides exhibits honest empty state without cross-lab leakage.
  - React 18 Mounted Synthetic Test Suite (`issue122-mounted-verification.cjs`, 7/7 suites passed):
    1. URL Lab Scope (?labId=LAB-A) with Failed GET:
       - `SUPER_ADMIN` without `user.labId` mounts with `?labId=LAB-A`.
       - Initial selection strictly honors URL scope (`selectedLabId === 'LAB-A'`), issuing GET `/api/config/lab-defaults/LAB-A`.
       - Extraneous requests to `/api/config/lab-defaults/LAB-DEFAULT` and `LAB-B` are completely avoided.
       - Target load failure (503) sets `loadError = true`, clears methodology rows, and disables Save Defaults button (`disabled === true`).
       - Programmatic/direct invocation of `save().props.onClick()` dispatches ZERO PUT requests (`calls.filter(c => c.method === 'PUT').length === 0`).
       - Switching to valid target (`LAB-B`) resolves rows, enables Save button, and dispatches PUT `/api/config/lab-defaults/LAB-B` with `B-METHOD`.
       - Switching back to failing `LAB-A` on the same mounted instance immediately clears stale `LAB-B` rows from state/view, disables Save button, and guarantees zero write dispatch.
    2. Out-of-Order Delayed Response Guard (Race Condition):
       - Rapid switching from slow lab (`LAB-SLOW`) to fast lab (`LAB-FAST`) initiates two requests.
       - `LAB-FAST` resolves first, displaying its analyses and enabling Save.
       - Delayed `LAB-SLOW` response resolves later: guarded by `activeRequestIdRef`, stale response is discarded and does not overwrite active selection.
    3. Direct Visit without URL Param:
       - Direct visit (`/lab-methods`) as admin cleanly selects the first listed lab from `/api/labs` without requesting `LAB-DEFAULT`.
    4. Fallback to `LAB-DEFAULT`:
       - Direct visit with empty labs list cleanly falls back to `LAB-DEFAULT`.
    5. Incoming Same-Mounted Router URL Transition (A -> B) & Preserved History State:
       - Incoming route change `?labId=A` -> `?labId=B` on same mounted instance triggers reactive re-synchronization (`selectedLabId = 'B'`), requesting B defaults and rendering B rows.
       - Dropdown navigation to C updates router search params while preserving `window.history.state` and router location state.
    6. Delayed JSON Body Resolution Race Condition:
       - Initial request headers arrive for SLOW lab, but JSON body is delayed.
       - Dropdown switched to FAST lab, which completes and renders FAST analyses with Save enabled.
       - Delayed SLOW body resolves: post-body generation/target revalidation discards SLOW payload; FAST rows remain displayed; Save remains enabled for FAST and dispatches FAST payload.
    7. Real MemoryRouter + Non-Null History State ({usr, key, idx}) Envelope Preservation:
       - Initialized with non-null history state (`{ returnTo: '/admin/labs' }`) inside React Router's `{ usr, key, idx }` envelope.
       - Incoming URL transition A -> B maintains mounted instance, updates selection, requests B defaults.
       - Dropdown navigation back to A calls `setSearchParams(..., { replace: true, state: location?.state })`.
       - Eliminates redundant raw `window.history.replaceState`: preserves React Router's internal `{ usr, key, idx }` envelope and location state in memory without clobbering history position.
- **Defects Reproduced at `c5ed62e` & `bd4e577`**:
  - Initial defects reproduced via `C:\Users\yigin\Documents\Codex\2026-09-21\se\work\issue122-mounted-review.cjs`:
    1. `selectedLabId` initialized to `'LAB-DEFAULT'`, requested `LAB-DEFAULT`, and on `/api/labs` response silently overwrote selection with first listed `LAB-B`, ignoring `?labId=LAB-A`.
    2. Selecting `LAB-A` whose GET failed retained `LAB-B` rows in state, left Save enabled, and clicking Save dispatched `LAB-B` methods to `/api/config/lab-defaults/LAB-A`.
  - Additional lifecycle findings reproduced via `C:\Users\yigin\Documents\Codex\2026-09-21\se\work\pr134-independent-probes.cjs`:
    1. Incoming same-mounted URL transition A->B with rerender left A selected because `getUrlLabId` was initialization-only.
    2. Request guard before `await res.json()` only allowed delayed body to overwrite displayed rows after FAST loaded.
  - Integration defect reproduced via `C:\Users\yigin\Documents\Codex\2026-09-21\se\work\pr134-router-review.cjs`:
    - `handleLabChange` called raw `window.history.replaceState(location?.state || window.history.state)` after `setSearchParams`. With non-null `location.state`, this clobbered React Router's `{ usr, key, idx }` envelope with bare `{ returnTo: '/admin/labs' }`, losing history `.idx` and `.usr` structure.
- **Client Implementation (`client/src/pages/admin/LabMethods.jsx`)**:
  - Reactive URL scope integration via `useSearchParams` and `useLocation` from `react-router-dom`.
  - In-render incoming URL synchronization (`prevUrlLabIdRef`) updating `selectedLabId` on same mounted instance navigation.
  - Dropdown selection delegates entirely to router `setSearchParams(nextParams, { replace: true, state: location?.state })`, eliminating redundant raw `window.history.replaceState` and preserving React Router's internal `{ usr, key, idx }` history envelope.
  - `fetchLabs` preserves existing selection (`selectedLabId`) and does not overwrite with `data[0].id`.
  - Clears `defaults`, `loadedLabId`, and `isWizardOpen` on target change and on load failure.
  - Post-body resolution revalidation: checks `activeRequestIdRef.current === requestId && selectedLabIdRef.current === labId` after `await res.json()` and before committing to state.
  - Invalidation on cleanup: `useEffect([selectedLabId])` cleanup runs `activeRequestIdRef.current += 1` to immediately cancel in-flight obsolete requests.
  - Bound Save button and `handleSave` to `canSave = !saving && !loading && !loadError && Boolean(selectedLabId) && loadedLabId === selectedLabId && defaults.length > 0`.
  - Upfront `if (!canSave) return;` in `handleSave` guarantees zero network writes if invoked in invalid/error state.
  - Rendered explicit error state in table area when `loadError` occurs.


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

### Phase 3 Follow-Up: Issue #125 Summary Warning & Row Badge Rule Alignment
- **Root Cause & Production Finding**:
  - Production v3.5.21 live audit revealed 126 active items displaying `OUT OF STOCK` in the table, while the top alert banner reported only `2 low / out of stock`.
  - Diagnosis: In `getAlerts`, `if (item.isOutOfStock && item.lotCount > 0)` gated `OUT_OF_STOCK` alert creation behind having at least one lot, excluding the 124 active items with 0 lots. `getItems` and the table rows, conversely, declared any item with `usableLots.length === 0` as `OUT OF STOCK`.
  - Secondary Defect: Clicking the `LOW_STOCK` banner filter filtered by `item.isLowStock`, excluding items where `item.isOutOfStock` was true (displaying 0 rows when clicking on "low / out of stock").
  - Multi-Lot Parity Finding: If an item has multiple expired lots (e.g. 2 expired lots on 1 item), raw alert counting yielded `counts.expired: 2`, but the catalog table lists unique items, so clicking the chip displayed only 1 item row.
- **Bounded Backend Fix (`server/controllers/inventoryController.js`)**:
  - Removed `&& item.lotCount > 0` guard from `item.isOutOfStock` branch in `getAlerts`. Items with 0 lots now generate `OUT_OF_STOCK` alerts with `0 available` message.
  - Aligned banner chip counts (`counts.expired`, `counts.expiringSoon`, `counts.quarantined`, `counts.lowStock`, `counts.outOfStock`, `counts.missingQuantity`) to count **unique affected item rows** (`countUniqueItems`), ensuring 1-to-1 parity between banner chip badges and catalog filtered table rows.
  - Fully preserved per-lot alert details in the `alerts` array (retaining each individual lot's `lotId`, `lotNumber`, `expiryDate`, `message`), and exposed lot-level totals (`expiredLots`, `expiringSoonLots`, `quarantinedLots`) for observability.
  - Defaulted `where.isActive = true` in `getItems` when `active` is undefined, guaranteeing `getItems` and `getAlerts` evaluate the identical active item catalog by default.
- **Client Alignment & Localization (`client/src/pages/Inventory.jsx` & `client/src/translations/`)**:
  - Made `AlertBanner` chips interactive button controls with dedicated filters (`LOW_STOCK`, `EXPIRED`, `EXPIRING_SOON`, `QUARANTINED`, `MISSING_QUANTITY`).
  - Aligned `LOW_STOCK` filter predicate to `Boolean(item.isLowStock || item.isOutOfStock)`, so clicking "126 low / out of stock" displays all 126 items.
  - Added filter-label translations across all 5 supported locales (`en`, `es`, `es-419`, `fr`, `pt`): `showingLowOrOutOfStock`, `showingExpired`, `showingExpiringSoon`, `showingQuarantined`, `showingMissingQuantity`, and `outOfStock`.
  - Updated `COUNT NEEDED` row badge condition to `(item.usableStock === 0 || item.usableStock === null) && item.hasMissingQuantityInUsableLots` so uncounted usable lots show `COUNT NEEDED`.
- **Contract Tests (`server/tests/contracts/inventory_aggregation.test.js`)**:
  - Expanded suite to 18 passing tests (0.55s):
    - Test 10: `getAlerts` includes no-lot items as `OUT_OF_STOCK` and counts them in `lowStock`.
    - Test 11: Expired lots produce both `OUT_OF_STOCK` and `EXPIRED` alerts without masking.
    - Test 12: Missing quantities produce `MISSING_QUANTITY` alerts without false `OUT_OF_STOCK`.
    - Test 13: Exact production replica (124 no-lot items + 2 expired-lot items) confirms `getItems` returns 126 `isOutOfStock` items and `getAlerts` returns `counts.lowStock: 126`, `counts.outOfStock: 126`, `counts.expired: 2` (100% agreement between row badges and summary counts).
    - Test 14: Lab scoping verified across roles.
    - Test 15: Multi-lot regression verifying single item with multiple expired/expiring/quarantined lots yields 1 affected item in chip counts while preserving 2 per-lot alerts of each type in `res.body.alerts` and lot-level counts. Filter parity verified on 2 items with 3 total expired lots.
- **Read-Only Browser Verification (`WP/contributor-issues-2026-09/verify_inventory_alerts_browser.cjs`)**:
  - Headless Chrome test executed against production-built client and ephemeral SQLite database:
    - Multi-lot fixture: Item 125 has 2 expired lots, Item 126 has 1 expired lot (3 expired lots total across 2 items).
    - `inventory_summary_126_matched.png`: Banner reports `🔴 2 expired  📦 126 low / out of stock`; table displays 126 rows with `OUT OF STOCK` badges.
    - `inventory_filtered_low_stock.png`: Banner filter bar displays `Showing: Low / Out of Stock Items` with explicitly asserted **126 rows**.
    - `inventory_filtered_expired.png`: Banner filter bar displays `Showing: Expired Items` with explicitly asserted **2 rows**.
    - All programmatic assertions passed: `results.bannerLowStock126 === true`, `results.bannerExpired2 === true`, `results.lowStockFilteredRows === 126`, `results.expiredFilteredRows === 2`.

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

## Production Release & Deployment Evidence (Commit 7516f0e — 2026-09-22)

Following explicit operator authorization, the release package from PR #129 was deployed to production on `lims.yigini.net` (`46.19.33.37`) adhering strictly to the procedures in [`RELEASE-PACKAGE.md`](./RELEASE-PACKAGE.md).

### 1. Release Identification & Artifacts
- **Merge Commit**: [`7516f0e408c258a6ee7ffb08b7298e04fe373e09`](https://github.com/yigini/soilfer-lims/commit/7516f0e408c258a6ee7ffb08b7298e04fe373e09) (merging `review/wp-contributor-issues-candidate` into `main`)
- **Candidate Head**: `8025ea0520b5c691d40017ac0237e83c63286bf7`
- **Application Code Base**: `fe02e7589205bb6a8d085b93be573982f13ec45d`
- **Clean CI**: [Run 35661612739](https://github.com/yigini/soilfer-lims/actions/runs/35661612739) — **PASSED**
- **Production Container Image**: `soilfer-lims:v3.5.17-7516f0e` (Image ID `17c1f743ce00`)
- **Preserved Rollback Baseline**: `soilfer-lims:rollback-baseline` (`soilfer-lims:v3.5.16-762c46e`, Image ID `e749d4d60093`)

### 2. Ingress Write Quiescence & Background Writer Suppression
- **Ingress Quiescence**:
  - Apache reverse proxy configuration (`/etc/httpd/conf/extra/httpd-lims.conf`) updated with rewrite rules returning HTTP 503 for all mutating methods (`POST|PUT|PATCH|DELETE`).
  - Active verification: mutating `POST` returned `503 Service Unavailable`; read-only `GET` returned `200 OK`.
- **Background Writer Termination**:
  - Active container stopped, terminating all internal background sync schedulers (`koboScheduler`), escalation checkers, and automated backup intervals.
  - Zero writes occurring during backup creation.

### 3. Verified Pre-Migration & Final Consistent Backups
- **Pre-Migration Backups**:
  - Online: `/opt/lims/backups/dev_predeploy_7516f0e_online_20260922_093051.db` (Samples: 36,878, `PRAGMA integrity_check`: ok)
  - Stopped: `/opt/lims/backups/dev_predeploy_7516f0e_stopped_20260922_093051.db` (Samples: 36,878, `PRAGMA integrity_check`: ok)
- **Additive DDL Applied**:
  - Script: `server/scripts/migrate_project_templates_and_policy.js`
  - Columns Added: `templateId`, `templateVersion`, `policyConfig`, `programmeCode`, `parentProjectId` (5 columns)
  - Index Created: `Project_parentProjectId_idx`
  - Transaction: 100% atomic inside SQLite transaction; zero foreign key violations.
- **Final Consistent Backup (Zero Writers)**:
  - File: `/opt/lims/backups/dev_release_7516f0e_consistent_20260922_093929.db`
  - SHA256 Checksum: `8aa1679095f1c9992f5ac477cbb087ea31e8f3c06b48ebaaaa23fc3b9650ac1d`
  - Integrity Check: `PRAGMA integrity_check` -> `ok`
  - Foreign Key Check: `PRAGMA foreign_key_check` -> `OK (0 errors)`
  - Exact Verified Row Counts:
    - `Sample`: 36,878
    - `Project`: 5
    - `WorkItem`: 90
    - `Result`: 19
    - `Report`: 4

### 4. Postflight Container Verification (Background Jobs Suppressed)
- Container started with `-e DISABLE_BACKGROUND_JOBS=true`.
- Verified container environment: `DISABLE_BACKGROUND_JOBS=true` active.
- Confirmed from logs: zero `KOBO_SCHEDULER` sync logs; all background sync writers suppressed.
- **Read-Only Role/Route Postflight Protocol (17/17 PASSED)**:
  1. `[PASS]` `PUBLIC` - System Health (`/api/health`) -> Got 200, Expected 200
  2. `[PASS]` `SUPER_ADMIN` - Users List (`/api/users`) -> Got 200, Expected 200
  3. `[PASS]` `SUPER_ADMIN` - Labs Directory (`/api/labs`) -> Got 200, Expected 200
  4. `[PASS]` `LAB_MANAGER` - Live Dashboard KPIs (`/api/dashboard/live`) -> Got 200, Expected 200
  5. `[PASS]` `LAB_MANAGER` - QC Exceptions Queue (`/api/dashboard/queues/manager.exceptions`) -> Got 200, Expected 200
  6. `[PASS]` `LAB_MANAGER` - QC Batches List (`/api/qc/batches`) -> Got 200, Expected 200
  7. `[PASS]` `LAB_MANAGER` - Submissions Queue (`/api/submissions`) -> Got 200, Expected 200
  8. `[PASS]` `LAB_TECHNICIAN` - My Work (`/api/work`) -> Got 200, Expected 200
  9. `[PASS]` `LAB_TECHNICIAN` - Workbench Queue (`/api/workbench/queue`) -> Got 200, Expected 200
  10. `[PASS]` `LAB_TECHNICIAN` - Reports Search (`/api/reports/search`) -> Got 200, Expected 200
  11. `[PASS]` `SAMPLE_RECEPTION` - Samples List (`/api/samples`) -> Got 200, Expected 200
  12. `[PASS]` `SAMPLE_RECEPTION` - Admin Units (`/api/reception/admin-units`) -> Got 200, Expected 200
  13. `[PASS]` `SAMPLE_RECEPTION` - Consignments (`/api/reception/consignments`) -> Got 200, Expected 200
  14. `[PASS]` `MASTER_USER` - Scoped Reports Search (`/api/reports/search`) -> Got 200, Expected 200
  15. `[PASS]` `LAB_MANAGER (HND)` - Cross-Lab Foreign Report Forbidden (`/api/reports/RPT-GTM-DEMO-S01-v1`) -> Got 403, Expected 403 (Scope boundary confirmed)
  16. `[PASS]` `SUPER_ADMIN` - Project Detail (`/api/projects/proj-demo-gtm-soilfer-2026`) -> Got 200, Expected 200
  17. `[PASS]` `PUBLIC` - Invalid Share Token (`/api/reports/public/invalid-token-xyz`) -> Got 404, Expected 404
- Post-Check Database Counts: Samples=36,878, Projects=5 (zero drift).

### 5. Production Resumption & Public Verification
- **Container Service**: Restarted in standard production mode (without `DISABLE_BACKGROUND_JOBS=true`). Container healthy within 3 seconds.
- **Ingress Writes**: Apache reverse proxy restored; mutating HTTP methods operational.
- **Public Health Endpoint**: `https://lims.yigini.net/api/health` -> HTTP 200 (`{"status":"ok","uptime":3.087}`).
- **Static Assets**: Client web bundle (`/assets/index-CsTR4Dk2.js`) loads cleanly.
- **Final Row Counts**:
  - Samples: 36,878
  - Projects: 5
  - WorkItems: 90
  - Results: 19
  - Reports: 4

### 6. Data Integrity & Governance Invariants
- **Zero Country Reassociations**: All historical country assignments preserved.
- **Zero Membership Reconciliations**: User-laboratory-project allocations unchanged; governance ledger remains open for human review.
- **Zero Grant Expansions**: User roles and permissions unmodified.
- **Zero Test Records**: No synthetic test samples or rows injected into the production database.
- **Preservation of Codex Working Tree**: Codex's uncommitted entry in `COMMUNICATION-LOG.md` preserved intact.
- **Issue Tracking**: All 18 contributor issues remain open pending Codex's independent live verification and subsequent closure workflows.

### 7. Issue #118 Focused Follow-Up: QC Batch Inspection Display & Legacy Limits Verification

Following production release verification on `7516f0e`, Codex conducted independent live verification (`production-release-review-7516f0e.md`) and a focused follow-up review (`issue118-followup-review-20260922.md`), noting:
1. **Persisted Legacy REJECT_REANALYSIS**: The demo batch (`BATCH-GTM-2026-P-01`) possesses a pre-existing rejection recorded on 7 September 2026 by `mgr_gtm`. While database records and audit history were conserved without data loss, the inspection modal previously defaulted to an editable "Record Manager QC Disposition" form with a pre-selected "Proceed with Warning" decision, prefilled the legacy rejection reason, and failed to surface the legacy rejection in the prominent disposition area.
2. **Reagent Blank Limit & Status Evaluation**: Reagent blanks with nominal zero analyte (`expected: 0`) and measured concentration `0.03` displayed `Upper Limit: 0` and `PASS` because `b.expected` was used as a fallback limit, and an implicit threshold `0.05` was used for evaluation when `limit` was missing. Furthermore, missing, whitespace, boolean (`false`), array (`[]`), or non-finite measurements must not evaluate to `PASS` via JavaScript loose coercion when a limit exists.
3. **Neutral Wording & Factual Governance**: Legacy `ACCEPT` must be treated as a recorded legacy decision requiring review rather than an automated green acceptance claim. Legacy `REJECT_REANALYSIS` must describe the recorded decision without claiming old work items were altered. Broad claims of universal immutability and ISO 17025 compliance must be replaced with factual statements that recorded manager dispositions are preserved in audit history and cannot be overwritten through the UI.
4. **SSR Test Authenticity**: The server-side rendering unit test must verify real rendered DOM of a populated batch rather than asserting only the modal container heading during loading state.

#### Technical Implementation (`client/src/components/qc/BatchInspectionModal.jsx`)
- **Strict Numeric Parsing Helper (`parseFiniteNumber`)**:
  - Validates `Number.isFinite` for numeric primitives and non-empty trimmed strings.
  - Returns `null` for empty strings `""`, whitespace `"   "`, booleans (`false`, `true`), arrays (`[]`), objects (`{}`), `Infinity`, `-Infinity`, and `NaN`.
  - Valid numeric zero (`0` and `"0"`) is explicitly recognized and preserved.
- **Blank Upper Limit & Evaluation Truthfulness (`formatBlankLimit` & `evaluateBlankStatus`)**:
  - `formatBlankLimit` strictly returns recorded numeric or string limit (`b.limit` or `b.upperLimit`). If neither is recorded, returns `"Not recorded"`. Never falls back to `b.expected` (which is nominal 0), and never invents an implicit SOP threshold (such as `0.05`).
  - `evaluateBlankStatus` strictly preserves explicit recorded status (`b.status`) if present. If unrecorded/null, status inference is performed **only** when both measured value and limit are valid finite numbers parsed via `parseFiniteNumber`. In this valid numeric case, returns `parsedMeasured <= parsedLimit ? 'PASS' : 'FAIL'`. For missing, invalid, non-finite, empty string, boolean, or array inputs, inference strictly yields `null` (`Not evaluated`).
- **Legacy & Recognized Decision Classification (`getDispositionInfo`)**:
  - `REJECT_REANALYSIS` maps to `LEGACY_REJECT_REANALYSIS` (`REJECTED FOR RE-ANALYSIS (Legacy)` banner, `Legacy Rejection: REJECT_REANALYSIS` badge, rose styling, and factual note describing the recorded decision without claiming historical work item modifications).
  - `REANALYZE_BATCH` maps to `REANALYSIS_REQUIRED` (`RE-ANALYZE BATCH` banner, rose styling).
  - `REJECT_BATCH` maps to `REJECTED` (`BATCH REJECTED` banner, rose styling).
  - `PROCEED_WITH_WARNING` maps to `WARNING_OVERRIDE` (`PROCEED WITH WARNING` banner, amber styling).
  - `ACCEPT` maps to `CUSTOM_OR_UNSUPPORTED` (`RECORDED LEGACY ACCEPT (Under Review)` banner, slate neutral styling, `Legacy Decision: ACCEPT` badge, and explanatory note that this legacy decision is preserved for review and is not an automated system acceptance).
  - Unrecognized or custom decisions map to `CUSTOM_OR_UNSUPPORTED` (slate styling, surfaced read-only for technical review, never defaulting to approval).
- **Form Guard & Removal of Pre-fill**:
  - Removed `setReason(...)` prefill from `fetchBatch` to prevent prefilling old rejection reasons into new forms.
  - Manager disposition form guarded with `isManager && isFailed && !dispInfo` (strictly suppressed when a disposition has already been recorded).
  - When `dispInfo` is present, renders a dedicated read-only card: Decision, Recorded By, Documented Technical Justification, `Recorded Audit Entry` badge, and factual notice: *"Recorded manager QC dispositions are preserved in audit history and cannot be overwritten through this interface."*
  - Added optional `initialBatch` prop to `BatchInspectionModal` enabling direct, deterministic SSR testing with populated batch data.

#### Automated Contract & Unit Tests (`server/tests/contracts/qc_inspection_display_legacy_limits.test.js`)
- Test Suite: 17 passed, 17 total (clean execution via Jest in 0.312s):
  1. Blank with explicit numeric limit renders exact limit.
  2. Blank with explicit string limit renders exact string.
  3. Blank with upperLimit field renders upperLimit.
  4. **CRITICAL**: Blank with `expected: 0` but missing limit renders `"Not recorded"` (never 0, never implicit 0.05).
  5. Blank with missing limit and null status returns null (`Not evaluated`, zero invented thresholds).
  6. Blank evaluates against recorded limit if limit is present.
  7. **CRITICAL**: Blank evaluates valid zero (`0` and `"0"`) correctly against positive limit (`PASS`).
  8. **CRITICAL**: Blank inference strictly returns `null` for empty/whitespace/false/array/non-finite inputs even when limit exists.
  9. Blank strictly preserves explicit recorded status even if measurement is non-numeric or missing.
  10. Legacy `REJECT_REANALYSIS` maps to `LEGACY_REJECT_REANALYSIS` with factual audit note (no claim of modifying old items).
  11. `REANALYZE_BATCH` maps to `REANALYSIS_REQUIRED`.
  12. `PROCEED_WITH_WARNING` maps to `WARNING_OVERRIDE`.
  13. **CRITICAL**: Legacy `ACCEPT` maps to neutral `CUSTOM_OR_UNSUPPORTED` review state (slate styling, no automated acceptance claim).
  14. Unsupported or custom decision maps to `CUSTOM_OR_UNSUPPORTED` without approval default.
  15. Missing or null disposition returns null.
  16. Modal component SSR rendering initial state confirms container, header, and footer without throwing.
  17. **CRITICAL**: Modal component SSR rendering with populated `initialBatch` confirms prominent banner, blank "Not recorded", factual card, and strictly suppressed form.

#### Isolated Headless Chrome CDP Browser Journey (`server/scripts/run_qc_inspection_browser_evidence.cjs`)
- **Database Isolation & Refusal Guard**: Executed against a dedicated disposable database copy (`disposable_journey_<nonce>.db`) inside a runner-owned temporary directory with validated refusal guard rejecting working databases (`server/prisma/dev.db`). Cleaned up on exit.
- **Client Build**: Production build (`npm run build` in `client`) clean in 7.18s (`dist/assets/BatchInspectionModal-BPJw9IVo.js`).
- **Browser Journey Execution**: 5/5 steps passed (Exit 0):
  1. `[PASS]` `Modal Root Render`: Modal loaded batch header `BATCH-GTM-2026-P-01`.
  2. `[PASS]` `Prominent Legacy Rejection Banner`: Banner Title rendered `QC FAILED — Manager Disposition Active: REJECTED FOR RE-ANALYSIS (Legacy)`, author `mgr_gtm`, recorded timestamp, justification displayed, re-analysis note visible.
  3. `[PASS]` `Blank Limit Display & Evaluation (#118)`: Blank row displays Measured `0.03`, Upper Limit renders `"Not recorded"` (italics/muted; invented 0 = false, invented 0.05 = false), Status displays `PASS`.
  4. `[PASS]` `Action Form Suppression on Recorded Disposition`: Form suppressed (disposition form present = false, radio count = 0, editable textarea = false).
  5. `[PASS]` `Read-Only Disposition Card & Factual History Notice`: Header `Manager QC Disposition (Recorded — Read Only)`, badge `RECORDED AUDIT ENTRY`, Decision `REJECT_REANALYSIS`, and factual audit history statement verified in DOM.
- **Evidence Artifacts**:
  - Report JSON: `artifacts/evidence-journeys/qc_inspection_legacy_reject_evidence.json`
  - High-Resolution Viewport Screenshot (Top): `artifacts/evidence-journeys/qc_inspection_legacy_reject_modal.png`
  - High-Resolution Viewport Screenshot (Card): `artifacts/evidence-journeys/qc_inspection_legacy_reject_card.png`
- **Data Invariants**:
  - Zero database mutations on production (all live historical data conserved).
  - Issue #118 remains open pending Codex's verification and closure.

---

### 8. Issue #119 Follow-Up: Manager Queue Assignment Route, SampleDetail Icon Definitions, and Disambiguation

#### Context & Problem Reproduction
- **Reproduction Environment**: Live production commit `7516f0e` (PR #129) accessed as `SUPER_ADMIN` in Google Chrome.
- **Symptom**: In Manager Queue (`/manager-queue?lane=assign`), clicking "Assign Tech" on sample S005 navigated to `/samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign` and crashed with:
  ```
  Application Error
  ReferenceError: ArrowRight is not defined
  ```
- **Root Cause**:
  1. `client/src/pages/SampleDetail.jsx` referenced `<ArrowRight size={16} />` at line 540 in the primary nextAction button for unassigned samples (`Assign X unassigned task(s) to technician`), and `<Eye size={14} />` at line 1313 in the Reports tab (`View Report vX`), but omitted `ArrowRight` and `Eye` from the `lucide-react` import statement at line 22.
  2. In `server/services/sampleWorkspaceService.js`, `SampleWorkspaceService.getWorkspace` used `findFirst({ where: { OR: [ { id }, { originalId }, { labId } ] } })`. In environments where an existing sample record has `labId = 'GTM-LAB1'`, querying by canonical ID `'GTM-LAB1'` could match an alias row instead of prioritizing the canonical sample ID `id`.

#### Technical Implementation
1. **Frontend Icon Import Correction (`client/src/pages/SampleDetail.jsx`)**:
   - Added `ArrowRight` and `Eye` to the `lucide-react` import list.
   - Added optional `initialWorkspace = null, initialSample = null` props to `SampleDetail` to support deterministic SSR rendering and state testing.
   - Verified that all JSX icons throughout `SampleDetail.jsx` are fully defined.
2. **Backend Canonical Lookup Precedence (`server/services/sampleWorkspaceService.js`)**:
   - Prioritized `prisma.sample.findUnique({ where: { id: String(sampleId) } })` before falling back to `findFirst({ where: { OR: [{ originalId }, { labId }] } })`. This guarantees canonical UUID / ID matches take precedence, aligning with `sampleController.getSampleDetail`.
3. **Clean Client Production Build**:
   - Executed `npm run build` (`vite build`) in `client`: passed cleanly in 6.97s with zero errors or bundle warnings.

#### Automated Contract & Component Tests (`server/tests/contracts/sample_assignment_manager_route.test.js`)
- Test Suite: 10 passed, 10 total (clean execution via Jest in 1.633s):
  1. `[PASS]` `SampleDetail renders without ReferenceError when nextAction is ASSIGN`: Component mounts cleanly under Node SSR, evaluating the primary action button branch, rendering `<ArrowRight />` SVG, and displaying `"Assign 15 unassigned task(s) to technician"`.
  2. `[PASS]` `SampleDetail renders without ReferenceError when released report is present (Eye icon)`: Component mounts cleanly with `?tab=reports`, evaluating the report action branch, rendering `<Eye />` SVG, and displaying `"View Report v1"`.
  3. `[PASS]` `SUPER_ADMIN unassigned queue aggregates 38 tasks across S005, S004, and W001`: SUPER_ADMIN scope spans all labs and countries, seeing 15 (S005) + 11 (S004) + 12 (W001) = 38 tasks.
  4. `[PASS]` `LAB_MANAGER (LAB-GTM) is lab-scoped and sees only S005 (15) and S004 (11) totaling 26 tasks`: Scoped manager query excludes LAB-CLO sample W001.
  5. `[PASS]` `S005 resolves strictly to its own 15 tasks via canonical ID GTM-LAB1`: Workspace service query by canonical ID returns exactly 15 tasks.
  6. `[PASS]` `S005 also resolves accurately when queried via display lab code`: Workspace service fallback query by display lab code (`S005-ROUTE`) returns exactly 15 tasks.
  7. `[PASS]` `canonical ID query takes strict precedence over cross-column labId alias collision`: Verifies against a suite-owned decoy sample having `labId = 'GTM-LAB1'` that querying canonical ID `'GTM-LAB1'` returns the canonical sample (15 tasks), not the decoy sample (1 task).
  8. `[PASS]` `S004 resolves strictly to its own 11 tasks`: Workspace service returns exactly 11 tasks.
  9. `[PASS]` `W001 resolves strictly to its own 12 tasks`: Workspace service returns exactly 12 tasks.
  10. `[PASS]` `Target URL uses canonical sampleId GTM-LAB1 and preserves returnTo queue context`: Validates target route `/samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign`.

#### Isolated Headless Chrome CDP Browser Journey (`server/scripts/run_sample_assignment_browser_evidence.cjs`)
- **Database Isolation & Refusal Guard**: Executed against a disposable synthetic database copy (`disposable_journey_<nonce>.db`) in an isolated runner directory with the active `DB_ISOLATION_REFUSAL` guard rejecting any access to `server/prisma/dev.db`. Cleaned up on exit.
- **Real DOM Interactions & Journey Execution**: 7/7 steps passed (Exit 0):
  1. `[PASS]` `Step 1a: Method Filter Interaction in Manager Queue`: Navigated to `/manager-queue?lane=assign&analysis=PH_H2O`. Verified "Filtered by method: PH_H2O" banner rendered with "Clear filter" button.
  2. `[PASS]` `Step 1b: Clear Filter Interaction`: Clicked "Clear filter" button in DOM. Verified assign queue updated to show all 38 tasks across S005, S004, W001.
  3. `[PASS]` `Step 2: Real DOM Card Click Interaction`: Clicked the S005 "Assign Tech" card button in the Manager Queue DOM. Client-side navigation arrived at canonical route `http://127.0.0.1:<port>/samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign`.
  4. `[PASS]` `Step 3: SampleDetail loaded cleanly without Application Error`: Verified DOM is free of `Application Error`, `ReferenceError`, and `ArrowRight is not defined`. Verified both canonical ID `GTM-LAB1` and display ID `S005` are present.
  5. `[PASS]` `Step 4: Primary Action Button rendered with ArrowRight icon`: Button text verified as `"Assign 15 unassigned task(s) to technician"`, containing a valid rendered SVG icon (`<ArrowRight />`).
  6. `[PASS]` `Step 5 & 6: S005 WorkItemsTable renders tasks count`: Verified table rows render S005's operational gates and wet chemistry analyses (17 total rows). Captured high-resolution viewport screenshot.
  7. `[PASS]` `Step 7: Real Back Navigation Click Interaction`: Clicked the "Back to queue" button in SampleDetail DOM. Client-side navigation returned manager back to `http://127.0.0.1:<port>/manager-queue?lane=assign`, and verified Manager Queue DOM re-rendered.
- **Evidence Artifacts**:
  - Screenshot: `artifacts/evidence-journeys/sample_detail_manager_assign_route.png`
  - Evidence JSON: `artifacts/evidence-journeys/sample_detail_manager_assign_evidence.json`

#### Invariants & Constraints
- **Zero Production Database Mutations**: Production database (`46.19.33.37`) and local development database (`server/prisma/dev.db`) remained completely untouched. All browser verification ran against disposable schema-only SQLite databases.
- **Communication Log Preserved**: Contributor entries in `WP/contributor-issues-2026-09/COMMUNICATION-LOG.md` were preserved intact.
- **Issue Reference**: Referenced as `Refs #119` (not auto-closed; Codex handles public comments and closure).

---

### 9. Issue #124 Residual Follow-Up: Result Reports Query/Filter Lifecycle & Truthful No-Match

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
   - `fetchReports` uses stable `useRef` handles (`appliedQueryRef`, `statusFilterRef`), depending strictly on `[paramProjectId]`.
   - Cleanup-safe initialization/scope synchronization effect replaces the one-shot `hasMountedRef` guard:
     - Guarantees resilience to React 18 `StrictMode` setup-cleanup-setup development cycle without refusing replacement requests or leaving development screens blank.
     - Reactively synchronizes `projectId` route scope changes on the same mounted component instance while strictly preserving the user's `appliedQuery` and `statusFilter`.
     - Competing, unfiltered effect dispatches are completely eliminated.
   - Tab switching (`handleStatusFilterChange`) updates `statusFilter` and dispatches `fetchReports(1, appliedQuery, newStatus)`, guaranteeing the applied search (`GTM26-0002`) is strictly preserved.
   - Pagination (`handlePageChange`) dispatches `fetchReports(newPage, appliedQuery, statusFilter)`.
   - Search clear button (`handleClearSearch`) clears both `query` and `appliedQuery`, dispatching an unfiltered search (`q=''`).
3. **In-Flight Cancellation & Stale Response Guard**:
   - Each request increments an internal sequence counter (`requestIdRef.current`).
   - Active in-flight requests are aborted using an `AbortController` signal before a new request begins.
   - When a response resolves, it verifies `requestId === requestIdRef.current`. Stale or delayed responses arriving out of order are dropped immediately without modifying component state or loading flags.

#### Automated Contract & Component Tests (`server/tests/contracts/result_reports_filter_lifecycle.test.js`)
Executed `cmd.exe /c "npx jest tests/contracts/result_reports_filter_lifecycle.test.js"` in `server`:
- **18/18 tests passed** in 1.786s:
  - **1. Component SSR & Static Layout Regression**:
    1. `[PASS]` `Renders page header, search input, and 3 filter tabs with Published active by default`.
    2. `[PASS]` `Renders clear button when initialQuery is provided`.
    3. `[PASS]` `Renders populated reports table rows with version and client badges`.
    4. `[PASS]` `Renders truthful empty state when initialReports is empty`.
  - **2. Synthetic Hook Harness: Component Query/Filter Lifecycle, StrictMode Replay & Scope Transitions**:
    5. `[PASS]` `Initial mount executes exactly 1 query with default PUBLISHED and empty search`.
    6. `[PASS]` `React StrictMode setup-cleanup-setup re-executes mount effect and maintains active surviving request`.
    7. `[PASS]` `Same-instance projectId URL change cancels previous request, dispatches new request with new projectId, and preserves appliedQuery`.
    8. `[PASS]` `Typing in search input updates draft query WITHOUT dispatching requests or resetting table`.
    9. `[PASS]` `Submitting search form dispatches request with trimmed query and sets applied query`.
    10. `[PASS]` `Exact transition: clicking Superseded tab retains applied query and does NOT fire empty-string request` (`q='GTM26-0002'&status='SUPERSEDED'`).
    11. `[PASS]` `Clicking All Versions tab retains applied query and dispatches status ALL`.
    12. `[PASS]` `Clear button resets draft query, resets applied query, and dispatches unfiltered search`.
    13. `[PASS]` `Pagination preserves applied query and status filter on page change`.
  - **3. Synthetic Hook Harness: Stale Response Discard & Reversed Response Ordering**:
    14. `[PASS]` `Aborts in-flight request and drops delayed stale response arriving out of order`.
  - **4. Backend /api/reports/search Scope & Disambiguation Contract**:
    15. `[PASS]` `GTM26-0002 in All Versions returns exactly 1 report (v1 PUBLISHED)`.
    16. `[PASS]` `GTM26-0002 in Superseded strictly returns 0 reports (truthful no-match)`.
    17. `[PASS]` `Unfiltered status=SUPERSEDED returns GTM26-0003 v1 (demonstrating why empty query was a bug)`.
    18. `[PASS]` `GTM26-0003 in All Versions returns both v1 and v2`.

#### Isolated Headless Chrome CDP Browser Journey (`server/scripts/run_result_reports_browser_evidence.cjs`)
Executed against a disposable synthetic SQLite database with active `DB_ISOLATION_REFUSAL` guard:
- **8/8 steps passed (Exit 0)**:
  1. `[PASS]` `Step 1: /result-reports rendered with Published tab active (3 published reports scoped to GTM-SOIL-2026)`.
  2. `[PASS]` `Step 2: "All Versions" tab active with all 5 reports displayed`.
  3. `[PASS]` `Step 3: Search for "GTM26-0002" filtered to exactly 1 report`.
  4. `[PASS]` `Step 4: Exact Transition: Retained "GTM26-0002" input, strictly displayed 0 reports ("No reports found"), and GTM26-0003 did NOT appear`.
  5. `[PASS]` `Step 5: "All Versions" tab restored 1 report matching "GTM26-0002"`.
  6. `[PASS]` `Step 6: Search cleared, input reset to empty, and all 5 reports restored`.
  7. `[PASS]` `Step 7: Same-instance project scope synchronization: dynamic route change to GTM-PILOT-2026 updated reports to GTM26-0004; search "GTM26-0004" applied; dynamic route change back to GTM-SOIL-2026 strictly preserved applied search "GTM26-0004" and rendered truthful empty state without leak; cleared search restored all GTM-SOIL-2026 reports`.
  8. `[PASS]` `Step 8: Saved evidence JSON and high-resolution viewport screenshot`.
- **Evidence Artifacts**:
  - Screenshot: `artifacts/evidence-journeys/result_reports_filter_lifecycle_transition.png`
  - Evidence JSON: `artifacts/evidence-journeys/result_reports_filter_lifecycle_evidence.json`

#### Invariants & Constraints Maintained
- **Zero Production Database Mutations**: Production database (`46.19.33.37`) and local `dev.db` untouched.
- **Backend Integrity**: No backend authorization, report contents, report history, or share links modified.
- **Issue Governance**: StrictMode finding is development-only, not a production replay claim; Codex handles public issue communication and closure.

---

### 10. Production Release & Deployment Evidence: PR #130 & PR #131 (Commit 2032617 — v3.5.18)

Following explicit operator authorization, the reviewed changes from PR #130 (`5ad5012`) and PR #131 (`efc2b9c`) were merged and deployed to production host `46.19.33.37` on 22 September 2026.

#### 1. Release Identification & Invariants
- **Target Commit**: `2032617` (merging PR #130 via `94cf89d` and PR #131 via `2032617` into `main`)
- **Main CI**: [Run 35723028210](https://github.com/yigini/soilfer-lims/actions/runs/35723028210) — **PASSED**
- **Production Container Image**: `soilfer-lims:v3.5.18-2032617` (Image ID `4d39a9bac5f4`)
- **Preserved Rollback Baseline**: `soilfer-lims:rollback-baseline` (`soilfer-lims:v3.5.17-7516f0e`, Image ID `17c1f743ce00`)
- **Ingress Quiescence & Backup**: Mutating methods (`POST|PUT|PATCH|DELETE`) blocked via Apache 503 rewrite; container stopped; WAL checkpoint truncated (`0|0|0`); consistent backup created at `/opt/lims/backups/dev_release_2032617_consistent_20260922_135048.db` (`PRAGMA integrity_check`: ok, foreign keys: 0 errors).
- **Postflight Validation**: Executed under `DISABLE_BACKGROUND_JOBS=true`; all 21 role-based and endpoint checks passed; zero DB mutations detected post-checklist.
- **Production Resumption**: Container restarted in normal mode; Apache proxy restored; public health HTTP 200; ten-domain count/content conservation verified.

#### 2. Independent Acceptance & Issue Closures (Codex)
- **Issue #118 CLOSED**: Verified live legacy rejection display, read-only card, and blank limits without invented SOP thresholds. Closed via [Issue #118 comment 5776124568](https://github.com/yigini/soilfer-lims/issues/118#issuecomment-5776124568).
- **Issue #124 CLOSED**: Verified live multi-field report search, status transitions, superseded report viewer, and request lifecycle without query overwrite. Closed via [Issue #124 comment 5776176422](https://github.com/yigini/soilfer-lims/issues/124#issuecomment-5776176422).
- **Issue #119 OPEN**: Reopened premature auto-closure; live assignment navigation loop identified and isolated for targeted follow-up.

---

### 11. Follow-Up Implementations: PR #132 (Visible Header Help) & PR #133 (Assignment State Integrity)

#### 1. PR #132: Visible Header Help Button Localization (Refs #116, #115)
- **Candidate Head**: `0a7cbde`
- **Scope**:
  - Reorganized navigation menu into canonical laboratory journey sequence in `client/src/navigationConfig.js` (Projects second, Data Results before Reports).
  - Added visible label translations for header Help button (`t('help.help')`) across all 5 locales (`Ayuda` in Spanish, `Aide` in French, `Ajuda` in Portuguese, `Help` in English).
  - Translated dynamic dashboard labels, queue units, and action buttons.
- **Verification**:
  - `localization_and_user_display.test.js`: 18/18 passed; 450 ICU format checks passed.
  - `navigation_order.test.js`: 7/7 passed across all 6 roles.
  - Headless Chrome CDP browser journey (`run_dashboard_i18n_browser_journey.cjs`): verified visible `[ ? Ayuda ]` in header (`dashboard_nav_i18n_spanish_verified.png`).

#### 2. PR #133: Scoped Assignment Controls & State Integrity (Refs #119)
- **Candidate Head**: `b69ab45`
- **Scope**:
  - Eliminated primary action navigation loop on `SampleDetail.jsx` by keeping manager on sample page with focused scoped bulk preview bar ("11 Selected").
  - Required explicit technician selection before enabling "Assign Selected" button; cancel clears selection and technician choice.
  - Added state reconciliation in `SampleDetail.jsx` resetting selections across sample navigation (`useEffect([id])`), auto-pruning ineligible items (`useEffect([workItems])`), and validating current eligible IDs inside `handleBulkAssign` (dispatching 0 network calls if all selected items are ineligible).
- **Verification**:
  - `sample_assignment_manager_route.test.js`: 23/23 passed.
  - React 18 test renderer mounted probe (`pr133-mounted-review.cjs`): verified same-instance sample parameter change (`root.update`), `WORKITEM_CHANGED` partial eligibility refresh, bulk button dispatching only eligible IDs, and all-ineligible control reset.
  - Headless Chrome CDP browser journey (`run_sample_assignment_browser_evidence.cjs`): 11/11 passed (`sample_assign_scoped_controls_verified.png`).

---

### 12. Production Release & Deployment Evidence: PR #132 & PR #133 (Commit c5ed62e — v3.5.19)

Following explicit user authorization on 22 September 2026 at ~13:44 UTC, PR #132 and PR #133 were merged into `main` and deployed to production host `46.19.33.37`.

#### 1. Release Identification & Invariants
- **Target Commit**: [`c5ed62ebbe27fbd59147c77de5fedce8d773fe1d`](https://github.com/yigini/soilfer-lims/commit/c5ed62ebbe27fbd59147c77de5fedce8d773fe1d) (`c5ed62e`)
- **PR #132 Merge Commit**: `54cb2fbaf16bd4c57d0995097306b426bc858b03` (Head: `0a7cbde`)
- **PR #133 Merge Commit**: `c5ed62ebbe27fbd59147c77de5fedce8d773fe1d` (Head: `b69ab45`)
- **Main CI**: [Run 35735896020](https://github.com/yigini/soilfer-lims/actions/runs/35735896020) — **PASSED**
- **Production Container Image**: `soilfer-lims:v3.5.19-c5ed62e` (Image ID `27b53a930167`, size 364.8MB, final start `2026-09-22T13:54:18.717017635Z`)
- **Preserved Rollback Baseline**: `soilfer-lims:rollback-baseline` (`soilfer-lims:v3.5.18-2032617`, Image ID `4d39a9bac5f4`)
- **Zero Country/Project Migrations**: Deployed without database schema changes or data modifications.

#### 2. Ingress Quiescence, Writer Suppression & Backup
- **Ingress Quiescence**:
  - Apache configuration updated with rewrite rules returning HTTP 503 for all mutating methods (`POST|PUT|PATCH|DELETE`).
  - Active check: POST returned 503; GET returned 200.
- **Background Writer Suppression**:
  - Active container stopped, terminating all internal background sync schedulers and workers.
- **WAL Flush & Consistent Backup**:
  - Flushed WAL via `PRAGMA wal_checkpoint(TRUNCATE);` (`0|0|0`).
  - SQLite `.backup` created at `/opt/lims/backups/dev_release_c5ed62e_consistent_20260922_155332.db`.
  - SHA256 Checksum: `8aa1679095f1c9992f5ac477cbb087ea31e8f3c06b48ebaaaa23fc3b9650ac1d`.
  - `PRAGMA integrity_check`: `ok`.
  - `PRAGMA foreign_key_check`: `OK (0 errors)`.
  - Exact Verified Row Counts: Samples=36,878, Projects=5, WorkItems=90, Results=19, Reports=4.

#### 3. Postflight Container Verification
- Started container with `DISABLE_BACKGROUND_JOBS=true`.
- Confirmed zero scheduler logs; all background sync writers suppressed.
- Executed read-only role/route postflight checklist (`/opt/lims/postflight_check.cjs`): **21/21 PASS**.
- Post-checklist DB count verification: Samples=36,878, Projects=5 (0 mutations).

#### 4. Production Resumption & Live Verification
- Restarted container in standard production mode (normal operation, without `DISABLE_BACKGROUND_JOBS`). Container healthy within 3 seconds.
- Restored `/etc/httpd/conf/extra/httpd-lims.conf.live` and reloaded Apache.
- Public Health: `https://lims.yigini.net/api/health` -> HTTP 200 (`{"status":"ok"}`).
- Static Assets: `https://lims.yigini.net/` -> HTTP/2 200.
- Live Database Conservation:
  - Ten-domain content and row counts verified matching cutover checkpoint:
    `Sample`: 36,878, `Result`: 19, `Report`: 4, `ReportShareLink`: 4, `WorkItem`: 90, `Batch`: 6, `Project`: 5, `Lab`: 10, `User`: 49, `AuditLog`: 10,750.
  - 15 server-build-context source files and runtime `dashboardService` hash match accepted sources.

#### 5. Independent Live Acceptance & Issue Closures (Codex)
Codex conducted independent live verification using existing Chrome LAB_MANAGER Carlos Morales in Spanish (Guatemala):
- **Issue #115 CLOSED**: Sidebar navigation order verified matching requested sequence (Dashboard, Projects, Reception, Samples, Manager Queue, QA, Data Results, Reports, Spectral Library, Inventory, Equipment, Staff, My Laboratory, Admin, About). Closed at 14:00:48 UTC via [Issue #115 comment 5777888265](https://github.com/yigini/soilfer-lims/issues/115#issuecomment-5777888265).
- **Issue #116 CLOSED**: Populated live manager dashboard verified showing translated decision tabs, 26 tareas, 0 muestras/excepciones, 2 listas de control, 1 determinación, dynamic row descriptions/actions, and visible header Help button ("Ayuda") and "Plegar". Scientific catalogue labels/history untouched. Closed at 14:00:58 UTC via [Issue #116 comment 5777891149](https://github.com/yigini/soilfer-lims/issues/116#issuecomment-5777891149).
- **Issue #119 CLOSED**: Dashboard TEXTURE link correctly routes to S004 with canonical UUID and method/returnTo preserved. Primary action "Assign 11" remains on sample, activates 11-selected bulk preview with assign button disabled until technician chosen; selecting technician enables button; cancel clears checkboxes and choice; return to queue preserves TEXTURE filter; clearing filter shows 26 = 15 S005 + 11 S004; S005 card opens canonical `GTM-LAB1` with S005 label and 15 tasks; preview starts with technician empty / assign disabled; final approval disabled by prerequisite gates. Zero production assignments or mutations submitted. Closed at 14:01:12 UTC via [Issue #119 comment 5777893938](https://github.com/yigini/soilfer-lims/issues/119#issuecomment-5777893938).

#### 6. Final Status Summary
- **Tracked Issues**: 18
- **Independently Accepted & Closed**: 5 (#115, #116, #118, #119, #124)
- **Open (Fixes Live, Awaiting Individual Acceptance)**: 10 (#121, #122, #128, #123, #125, #117, #113, #120, #114, #126)
- **Open (External / Hardware / Governance)**: 3 (#102 physical mobile devices, #103 user membership reconciliation hold, #104 separate laboratory dashboard investigation)
- **Deployment Status**: Production is clean, healthy, and up-to-date on `v3.5.19` (`c5ed62e`). No further release or restart required.

---

### 13. Production Release & Deployment Evidence: PR #137 & PR #138 (Commit 2f860cf — v3.5.22)

Following explicit user authorization on 23 September 2026 at ~07:08 UTC, PR #137 (Issue #125) and PR #138 (Issue #120) were merged into `main` under repository protections and deployed to production host `46.19.33.37`.

#### 1. Release Identification & Invariants
- **Target Commit**: [`2f860cf3c81d3e251632ef579bcd9d90802dcf13`](https://github.com/yigini/soilfer-lims/commit/2f860cf3c81d3e251632ef579bcd9d90802dcf13) (`2f860cf`)
- **PR #137 Merge Commit**: `39f8f378d3b6de2d69e2900ad3efa9241322c0ae` (Head: `2eaf0a2724cb34b34940b9fce564c709d6409f37`, Refs #125)
- **PR #138 Merge Commit**: `2f860cf3c81d3e251632ef579bcd9d90802dcf13` (Head: `0341151318c7bd417f33f2b9878f568b1f823f26`, Refs #120)
- **Main CI**: [Run 35830294886](https://github.com/yigini/soilfer-lims/actions/runs/35830294886) — **PASSED** (Test & Build in 3m57s)
- **Production Container Image**: `soilfer-lims:v3.5.22-2f860cf` (Image ID `45b51395458d`, Digest `sha256:45b51395458dbd06c7b149f35f44e96a648103c9827615c96e99e02d1c7a4a79`, container ID `d96a9707aa0f0d1d15107051ea372a2b31c70a5021111d5b61fc699cf09fb4b4`, started `2026-09-23T07:18:22.603431587Z`)
- **Preserved Rollback Baseline**: `soilfer-lims:rollback-baseline` and `soilfer-lims:rollback-af7d5ac` (`soilfer-lims:v3.5.21-af7d5ac`, Image ID `d13c5b81d4ee`, Digest `sha256:d13c5b81d4ee5b5dd5c7d7a39e1dc9c8c2fd9f1119652168e1083d374c498251`)
- **Zero Country/Project Migrations**: Deployed without database schema changes or data modifications.

#### 2. Ingress Quiescence, Writer Suppression & Backup
- **Ingress Quiescence**:
  - Apache configuration updated with rewrite rules returning HTTP 503 for all mutating methods (`POST|PUT|PATCH|DELETE`).
  - Active check: POST returned 503; GET returned 200.
- **Background Writer Suppression**:
  - Active container stopped, terminating all internal background sync schedulers and workers.
- **WAL Flush & Consistent Backup**:
  - Flushed WAL via `PRAGMA wal_checkpoint(TRUNCATE);` (`0|0|0`).
  - SQLite `.backup` created at `/opt/lims/backups/dev_release_2f860cf_consistent_20260923_091736.db`.
  - SHA256 Checksum: `8aa1679095f1c9992f5ac477cbb087ea31e8f3c06b48ebaaaa23fc3b9650ac1d`.
  - `PRAGMA integrity_check`: `ok`.
  - `PRAGMA foreign_key_check`: `OK (0 errors)`.
  - Exact Verified Row Counts: Samples=36,878, Projects=5, WorkItems=90, Results=19, Reports=4.

#### 3. Postflight Container Verification
- Started container with `DISABLE_BACKGROUND_JOBS=true`.
- Confirmed zero scheduler logs; all background sync writers suppressed.
- Executed read-only role/route postflight checklist (`/opt/lims/postflight_check.cjs`): **27/27 PASS**.
  - All standard role / health / legacy route checks passed.
  - **PR #137 (#125) Inventory Verification**:
    - `/api/inventory/alerts` returned 200 (39ms). Alert counts: `outOfStock=126`, `lowStock=126`, `expired=2`, `expiredLots=2`, `total=128`.
    - `/api/inventory/items?limit=200` returned 200. Verified all 126 active items evaluate to `isOutOfStock: true` (124 without lots + 2 with expired lots), perfectly aligning summary alerts (126) with table row badges (126).
    - Unique expired items (2) <= expired lots (2) verified.
  - **PR #138 (#120) Operational Views & Manager Queue Verification**:
    - `/api/samples?view=daily` returned 200 (488ms). Excludes `SUBMITTED_FULL`, `APPROVED`, `RECEIVED_REJECTED`, `REJECTED` (0 invalid rows). Daily row count (5) == `views.daily` facet (5).
    - `/api/samples?status=SUBMITTED_FULL,APPROVED` returned 200. Returned 3 completed samples (all strictly `SUBMITTED_FULL` or `APPROVED`). `facets.lifecycle.COMPLETED`: 3.
    - `/api/dashboard/queues/manager.finalApproval` returned 200 (120ms). Successfully queried without 200-item cap.
    - Dashboard Home Response Time: 207ms (< 2000ms threshold).
    - Dashboard Live Response Time: 482ms (< 2000ms threshold).
- Post-checklist DB count verification: Samples=36,878, Projects=5 (0 mutations).

#### 4. Production Resumption, Proxy Correction & Live Verification
- Restarted container in standard production mode (normal operation, without `DISABLE_BACKGROUND_JOBS`). Container healthy within 3 seconds.
- **Proxy Configuration Correction & Ingress Write Resumption**:
  - *Finding*: Post-deployment inspection identified that `/etc/httpd/conf/extra/httpd-lims.conf.live` had been contaminated with the `POST|PUT|PATCH|DELETE -> 503` `RewriteRule` during a rerun of the cutover script, leaving active Apache ingress returning 503 for mutating methods despite the application container being in normal mode.
  - *Remediation*: The contaminated `.live` config was archived to `httpd-lims.conf.live.contaminated`. The clean, original reverse proxy configuration (without `RewriteEngine` / 503 rules) was restored to both `/etc/httpd/conf/extra/httpd-lims.conf` and `/etc/httpd/conf/extra/httpd-lims.conf.live`.
  - *Configuration SHA256*: `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20` (both files identical, 0 rewrite rules present).
  - *Syntax & Reload*: `apachectl configtest` passed (`Syntax OK`) and `systemctl reload httpd` executed cleanly.
  - *Write Resumption Verification*: Verified that the ingress write block is completely cleared:
    - `GET https://lims.yigini.net/api/health` -> HTTP 200 OK (`{"status":"ok"}`)
    - `POST https://lims.yigini.net/api/test-mutation` -> HTTP 404 Not Found (forwarded through proxy to Express container; no 503 rewrite)
    - `POST https://lims.yigini.net/api/auth/me` -> HTTP 404 Not Found (forwarded through proxy to Express container; no 503 rewrite)
- **Live Database Conservation**:
  - Exact verified row counts conserved post-proxy restoration:
    `Sample`: 36,878, `Project`: 5, `WorkItem`: 90, `Result`: 19, `Report`: 4.
  - Zero modifications to production inventory stock or scientific records.

#### 5. Issues Status
- **Issue #120**: Fix deployed and verified on production. Remains **OPEN** pending independent live role acceptance.
- **Issue #125**: Fix deployed and verified on production. Closed following independent live acceptance (2026-09-23T07:36:27Z).

---

### 14. Production Release & Deployment Evidence: PR #139 (Commit 3241d4e — v3.5.23)

Following explicit user authorization and product direction on 23 September 2026, PR #139 (Refs #120) was merged into `main` under repository protections and deployed to production host `46.19.33.37` following the established zero-mutation release sequence.

#### 1. Strategic Product Direction Integration
- **Primary Deliverable**: SoilFER LIMS is established as the principal software deliverable for laboratories in SoilFER countries, architected with a path to broader public use later.
- **Decoupled Architecture**: Kobo is retained strictly as an optional proof-of-concept external intake channel and integration facility, never a blocking dependency for core laboratory workflows (intake, assignment, testing, review, reporting).
- **Zero Disruption**: Existing Kobo connection configurations, explicit mappings, provenance records, and expected-arrival registry items are strictly preserved. No live connections are disconnected, deleted, or disabled.
- **Intake Governance**: Registration of an expected sample via Kobo does not constitute physical receipt in the laboratory. Physical receipt remains gated by the reception compliance workflow.
- **Policy Invariance**: Zero production policies or database structures modified by assumption.

#### 2. Release Identification & Invariants
- **Target Commit**: [`3241d4efdb8562575815328a7396c794ee9c12ac`](https://github.com/yigini/soilfer-lims/commit/3241d4efdb8562575815328a7396c794ee9c12ac) (`3241d4e`)
- **PR #139 Merge Commit**: `3241d4efdb8562575815328a7396c794ee9c12ac` (Head: `1ee1b0b04b57a9f31878f1e3729a6160cbda23ed`, Refs #120)
- **Main CI**: [Run 35845226171](https://github.com/yigini/soilfer-lims/actions/runs/35845226171) — **PASSED** (Test & Build in 4m17s)
- **Production Container Image**: `soilfer-lims:v3.5.23-3241d4e` (Image ID `9b1d62aa3606`, Digest `sha256:9b1d62aa3606c29e6fc63211c6c92970365d5e8197ff831f6ef4f5836ab2db6f`, container ID `751f507c8f12`, started `2026-09-23T10:20:50.829683884Z`)
- **Preserved Rollback Baseline**: `soilfer-lims:rollback-baseline` and `soilfer-lims:rollback-2f860cf` (`soilfer-lims:v3.5.22-2f860cf`, Image ID `45b51395458d`, Digest `sha256:45b51395458dbd06c7b149f35f44e96a648103c9827615c96e99e02d1c7a4a79`)
- **Zero Schema Migrations**: Zero database schema changes or data modifications applied.

#### 3. Ingress Quiescence, Writer Suppression & Backup
- **Ingress Quiescence**:
  - Apache configuration updated with rewrite rules returning HTTP 503 for all mutating methods (`POST|PUT|PATCH|DELETE`).
  - Active check: POST returned 503; GET returned 200.
- **Background Writer Suppression**:
  - Active container stopped, terminating all internal background sync schedulers and workers.
- **WAL Flush & Consistent Backup**:
  - Flushed WAL via `PRAGMA wal_checkpoint(TRUNCATE);` (`0|0|0`).
  - SQLite `.backup` created at `/opt/lims/backups/dev_release_3241d4e_consistent_20260923_122003.db`.
  - SHA256 Checksum: `8aa1679095f1c9992f5ac477cbb087ea31e8f3c06b48ebaaaa23fc3b9650ac1d`.
  - `PRAGMA integrity_check`: `ok`.
  - `PRAGMA foreign_key_check`: `OK (0 errors)`.
  - Exact Verified Row Counts: Samples=36,878, Projects=5, WorkItems=90, Results=19, Reports=4.

#### 4. Postflight Container Verification
- Started container with `DISABLE_BACKGROUND_JOBS=true`.
- Confirmed zero scheduler logs; all background sync writers suppressed.
- Executed read-only role/route postflight checklist (`/opt/lims/postflight_check.cjs`): **28/28 PASS**.
  - All standard role / health / legacy route checks passed.
  - Inventory (#125) checks passed (126 out of stock summary == 126 catalog rows).
  - Operational views (#120) daily / completed / final approval queue passed.
  - **PR #139 (#120) Expected Arrivals View & Deep Link Alignment**:
    - `/api/samples?view=expected` returned 200 (836ms). Returned only expected/collected samples (0 invalid rows). Total expected rows on page: 50.
    - `views.expected` facet (9,891) strictly matches `meta.total` (9,891).
    - `/api/samples?view=expected&expected=true` returns consistent page size (50) and consistent total count (9,891).
    - `/api/samples?view=registry` returned 200, exposing full registry total (9,899).
- Post-checklist DB count verification: Samples=36,878, Projects=5 (0 mutations).

#### 5. Production Resumption, Proxy Correction & Live Verification
- Restarted container in standard production mode (normal operation, without `DISABLE_BACKGROUND_JOBS`). Container healthy within 3 seconds.
- Restored clean reverse proxy configuration `/etc/httpd/conf/extra/httpd-lims.conf` from verified clean baseline (`/etc/httpd/conf/extra/httpd-lims.conf.clean`).
- Restored configuration SHA256 verified: `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20`.
- `apachectl configtest` passed (`Syntax OK`) and `systemctl reload httpd` executed cleanly.
- Ingress write block completely cleared:
  - `GET https://lims.yigini.net/api/health` -> HTTP 200 OK (`{"status":"ok"}`)
  - `POST https://lims.yigini.net/api/test-mutation` -> HTTP 404 Not Found (forwarded through proxy to Express container; no 503 rewrite)
- Static Asset Serving:
  - `GET https://lims.yigini.net/` -> HTTP 200 OK (fresh frontend bundle with client assets).
- Live Database Conservation:
  - Exact verified row counts conserved:
    `Sample`: 36,878, `Project`: 5, `WorkItem`: 90, `Result`: 19, `Report`: 4.
  - Zero modifications to production inventory stock or scientific records.

#### 6. Issue Status
- **Issue #120**: Fix deployed and verified on production (`v3.5.23-3241d4e`). Remains **OPEN** pending independent live role acceptance.





