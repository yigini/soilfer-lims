# Contributor Issues Implementation & Verification Evidence Matrix

Work Package: `WP/contributor-issues-2026-09`  
Repository: `https://github.com/yigini/soilfer-lims`  
Implementation Lead: Antigravity  
Review & Communication Lead: Codex  
Baseline Commit: `762c46e`  
Current Production Release: `v3.5.29` (`e5d5ebdf9fa54a29fcbd4424d566eda8036920bd`)  
Production Serving Image: `soilfer-lims:v3.5.29-e5d5ebd` (sha256:`fe6b64efc4f046635a830f5568773fefa52e95e975444c1f61dff14800679c1b`)  
Rollback Baseline Image: `soilfer-lims:rollback-baseline` / `soilfer-lims:v3.5.28-2ef64cd` (sha256:`cf3d71a49ef38be3834db6d9abc105a3447af10c485e274a1f52eb8ec54a489b`)  
Date: 2026-09-26  

Status Summary:
- **Total Tracked Issues**: 19
- **Independently Accepted & Closed**: 8 (#115, #116, #118, #119, #122, #124, #125, #126)
- **Open**: 11 (8 with fixes deployed/live awaiting individual workflow acceptance: #113, #114, #117, #120, #121, #123, #128, #146; 3 external/device/governance items: #102, #103, #104)

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
| **#128** | 2 | Workbench deep links broken for specific workItemId and sampleId | Reproduced & Implemented Locally | `db09aaa` (PR #142) | `workbench_deep_link.test.js` (20/20 passed), isolated browser journey (5/5 passed, `workbench_verification_evidence.json`), final action-click interaction journey (`run_workbench_interactions_journey.cjs` 5/5 passed, `workbench_interactions_evidence.json`), client build (`vite build` clean in 15.30s) | `dcc4706` (v3.5.25) | Central authorization precedes diagnostic checks; canonical sample ID resolution across column collisions; rejects contradictory cross-column sample collisions with 400 CONTRADICTORY_IDENTIFIERS; technician assignment validation (fail closed); outside-default-page status resolution (COMPLETED); cross-lab access rejected with 403 without leaking details; non-existent items/samples return 404; `WorkbenchShell` `activeTargetRef` retains target context across subsequent fetches without recursive retry loops; `WorksheetArea` highlights selected work item. Verified with genuine CDP pointer click from Sample Workspace Analysis table into target resolution, Worksheet tab selection, contextual inspector display, reload survival, and history back/forward navigation. Zero application defects. | Forbidden items return 403 without leaking other labs' data. | Released to Production (`dcc4706` / v3.5.25); final interaction evidence package complete. Strictly OPEN (`Refs #128`) |
| **#123** | 2 | Workbench search input and pagination issues | Reproduced & Implemented Locally | `db09aaa` (PR #142) | `workbench_search.test.js` (12/12 passed), isolated browser journey (6/6 passed, `workbench_verification_evidence.json`), final keyboard interaction journey (`run_workbench_interactions_journey.cjs` 6/6 passed, `workbench_interactions_evidence.json`), client build (`vite build` clean in 15.30s) | `dcc4706` (v3.5.25) | Multi-field search across canonical UUID, sample lab ID, original field ID, analysis code, analysis display name, methodology name, and methodology standard; truthful no-match state; clearing search restores full authorized queue; cross-lab search isolation strictly excludes other labs' items; default queue `labScopeCondition` updated to include specimen `labId` work items via `assignedLab: user.labId`; in-memory post-filters enforce authoritative facility scope. Verified with genuine CDP keyboard `Input.dispatchKeyEvent` typing and Backspace clearing for specimen code, field ID, methodology standard, beyond-initial-window target (Y=1396 -> Y=374), truthful empty state, and cross-lab item exclusion. Zero application defects. | Server/client dual search filters. | Released to Production (`dcc4706` / v3.5.25); final interaction evidence package complete. Strictly OPEN (`Refs #123`) |
| **#124** | 2 | Result reports search failing across client, project, sample queries; residual query/filter lifecycle race on status tab transition | Reproduced & Implemented Locally | `1ed46ef` + `efc2b9c` (PR #131) | `report_search.test.js` (7/7), `result_reports_filter_lifecycle.test.js` (18/18), local browser CDP evidence (`run_result_reports_browser_evidence.cjs` 8/8 steps exit code 0), client build (`vite build` clean in 7.10s) | `2032617` (v3.5.18) | Fixed Prisma schema relation crash on `projectId` search; multi-field search across client first/surname, project code/name, and sample identifiers (canonical UUID, lab ID, and field original ID); discoverable superseded report versions with `status=SUPERSEDED` and `status=ALL` while defaulting to `PUBLISHED`; UI status filter pills with distinct superseded badge; cross-lab access isolation. Separated draft search input (`query`) from applied query state (`appliedQuery`); cleanup-safe initialization/scope synchronization effect replaces one-shot `hasMountedRef` guard; fully supports React 18 StrictMode setup-cleanup-setup development replay; tracks same-instance `projectId` URL route changes while strictly preserving user's applied search query without unfiltered competing requests; `AbortController` in-flight cancellation; sequence-based stale-response guard (`requestIdRef`) dropping out-of-order delayed responses; strictly preserves applied query across status tab and page changes (`GTM26-0002` + Superseded -> 0 reports, suppressing unrelated `GTM26-0003`); real CDP browser journey (8/8 passed). Independent live acceptance verified on production. | Scoped to authorized projects/labs; zero production or database schema mutations; backend authorization and share links preserved. | **CLOSED** (2026-09-22; [Issue #124 comment 5776176422](https://github.com/yigini/soilfer-lims/issues/124#issuecomment-5776176422)) |
| **#125** | 3 | Inventory aggregation anomalies, expired lots vs usable stock confusion | Reproduced & Implemented Locally | `278d32b` + working tree | `inventory_aggregation.test.js` (12/12 passed), `localization_and_user_display.test.js` (13/13 passed), client build (`vite build` clean in 13.31s) | `7516f0e` | Usable stock strictly aggregates available, non-expired lots; expired lots tracked separately without precedence masking; items at or below reorder threshold flagged as low stock; missing quantities represented truthfully as null (not 0); usableMissingQuantityLotCount tracked so mixed known/unknown lots treat usable stock as a subtotal (`≥ X`, `SUBTOTAL` badge) and distinguish confirmed low stock (`LOW`) from uncertainty (`LOW? (UNCERTAIN)` / `COUNT NEEDED`); GET /api/inventory/alerts is 100% pure (zero DB mutations); FEFO strictly excludes expired lots. UI displays OUT OF STOCK, EXPIRED, and SUBTOTAL badges without mutual masking; inventory subtotal and uncertainty badges localized across all 5 locales (#116). | Display/aggregation fix; zero schema changes. | Code LIVE in `v3.5.19`; Individual live workflow acceptance pending. OPEN |
| **#117** | 3 | Failed reception criterion not persisting or reflecting in UI; Reception TDZ runtime crash before first render | Reproduced & Implemented Locally | `81487b1` | `reception_compliance.test.js` (18/18 passed), `reception_compliance_component.test.js` (12/12 passed), `reception_route_smoke.test.js` (6/6 passed), comprehensive 23-step verification suite (`verify_issues_117_113_reception.cjs` 23/23 passed, `reception_issue117_113_evidence.json`), client build (`vite build` clean) | `7516f0e` | Intake Fail selection stays visually selected and red with `aria-checked="true"` and red badge; non-conformance flow auto-syncs with failed checklist items, displaying non-conformance note and Reject button; cancellation preserves fail state across both discard cancel and manager gate cancel flows; correction back to OK clears failure note and unflags non-conformance; real 10s draft autosave persists fail state, submitter, and notes; draft reload truthfully rehydrates fail selection, notes, and non-conformance flag; DRAFT save button and stored answers reflect authentic fail status and history; sample rejection flow persists checklist and `ncReason` in `receptionData` and metadata, transitioning to `RECEIVED_REJECTED` with audit history. Verified in real Headless Chrome CDP (`reception_issue117_113_verified.png`). | Non-conformance requires explanation note. | Code LIVE in `v3.5.19`; Disposable verification 23/23 passed; Individual live acceptance pending. Strictly OPEN (`Refs #117`) |
| **#113** | 3 | Reception compliance checklist and redundant/unauthorized dispositions | Released & Live | `81487b1` + `429ee38` + `2ef64cd` (PR #145) | `reception_compliance.test.js` (18/18), `reception_compliance_component.test.js` (21/21), 7 mounted React transitions (`pr145-mounted-review-429ee38.cjs`), isolated final controls browser check (4/4 passed, `reception_issue117_113_final_controls.json` + sidecar), client production build (`vite build` clean, `Reception-DcbkS6KK.js`) | `2ef64cd` (v3.5.28) | Routine compliant all-pass automatically derives compliant outcome; routine non-conformance checkbox disabled/unchecked when compliant, accompanied by Routine Compliant Outcome badge; separate "Other problem not covered by checklist" toggle with single unified description textarea; independent problem preserved across checklist corrections and draft reload without clobbering reason; 21/21 contract tests passed; 7/7 mounted React transitions verified; 4/4 isolated browser check passed against measured assets (`Reception-DcbkS6KK.js` sha256:`7f63addebf6a...`); sidecar ledger records metadata corrections and scripted-event attribution limits. Independent Codex functional and evidence acceptance complete. Deployed live to production with write-quiesced consistent backup and 15 postflight suites passing. | None. Application acceptance complete. | Released to Production (`v3.5.28` / `2ef64cd`); Codex independent release verification and closure pending (Refs #113) |
| **#120** | 4 | Dashboard vs manager task list conflation; large field registry overwhelming queues; Kobo notification deep link alignment and search/filter preservation across view switches | Reproduced & Implemented Locally | `3d85181` (PR #141) | `manager_dashboard_overview.test.js` (12/12 passed), `dashboard_manager_views.test.js` (10/10 passed), mounted race suite `verify_realtimedata_lifecycle.cjs` (13/13 passed), isolated browser CDP journeys (6/6 passed), client build (`vite build` clean in 15.05s) | `e3e1482` (v3.5.24) | High-level operational overview separated from actionable Manager Task List; analytical progress denominator excludes non-analytical methods; counts SUBMITTED determinations; authoritative `approvedAt` today; mutually exclusive stage partitioning (Final Approval > Awaiting Review > In Analysis); intake isolation (RECEIVED strictly in Stage 1); Stage 5 Approved / Released strictly counts APPROVED; canonical `canFinalApprove` readiness; scoped continuation links preserve `activeLabId` and destination isolation; ManagerQueue scope lifecycle normalized; delayed-response race guards in `useRealtimeData` and `ManagerQueue`. Production release v3.5.24 verified on host with 28/28 postflight checks. | Kobo remains an optional external intake channel; core laboratory operations decoupled from Kobo availability; provenance and expected-arrival records preserved without data loss. | Released to Production (`e3e1482` / v3.5.24); live visual manager acceptance pending. Strictly OPEN (`Refs #120`) |
| **#114** | 4 | Map centering issues, lack of fullscreen, map layer fallbacks, hardcoded lab coordinates | Fixed in PR #143 & Released | `4a712ca` (PR #143, merged `9b69920`) | `map_view.test.js` (16/16 passed), `reception_map_regression.test.js` (9/9 passed, 25/25 total), comprehensive 16-step verification suite (`verify_issue_114_maps.cjs` 16/16 passed, `map_issue114_evidence.json`), client production build (`vite build` clean, `Reception-CNxGqGES.js`) | `9b69920` (v3.5.26) | Sourced authorized laboratory configuration from schema (`Lab.location`) and auth (`user.lab`, `GET /api/labs/:id`); removed hardcoded dictionaries; guarded HTML5 Fullscreen API with `document.fullscreenEnabled` and denial catch; triggered Leaflet `invalidateSize` on toggle; Esri World Imagery with zero paid keys and official MLA attribution; TileLayer resilience with satellite automatic fallback, 2-error unavailable banner, and retry recovery; read-only `SampleMap` field preview separated from `LocationPicker` intake editor; unconfigured facilities fall back to neutral centroid (`[0, 25]`); deliberate map placement computes zoom uncertainty and assigns `DESK_PIN`; batched sampling updates preserved via functional updaters in `WalkInForm.jsx` preventing stale-closure clobbering; country fallback wired Reception -> WalkInForm -> LocationPicker. Verified in isolated disposable SQLite with exact candidate provenance and attribution integrity: Step 6 accurately attributed as Leaflet dragend handler simulation (genuine pointer-drag acceptance pending); Step 5 logs `fallbackDispatched: false`; `lastIntakeLocation` accurately attributed as client-side intake reuse cache (saved draft restore pending). | Physical printer/GPS field checks pending. | Code LIVE in `v3.5.26` (`9b69920`); Postflight passed; Individual live role acceptance pending. Strictly OPEN (`Refs #114`) |
| **#115** | 4 | Navigation order not reflecting canonical laboratory journey | Reproduced & Implemented Locally | `1ed46ef` + `0a7cbde` (PR #132) | `navigation_order.test.js` (7/7 passed), client production build (`vite build` clean) | `c5ed62e` (v3.5.19) | Reorganized navigation items into canonical laboratory journey sequence via production helper `client/src/navigationConfig.js`: Dashboard (`/`) -> Projects (`/projects`) -> Reception (`/reception`) -> Samples Registry (`/samples`) -> Manager Task List (`/manager-queue`) -> Quality Assurance (`/qa`) -> Data Results (`/results`) -> Result Reports (`/result-reports`) -> Spectral Library (`/spectral`) -> Inventory (`/inventory`) -> Equipment (`/equipment`) -> Staff (`/staff`) -> My Laboratory (`/my-lab`) -> Admin (`/admin`) -> About (`/about`). Order contract tests execute production module directly across all 6 roles. Independent live Spanish LAB_MANAGER verification confirmed sidebar order. | Role permissions unchanged. | **CLOSED** (2026-09-22 14:00:48 UTC; [Issue #115 comment 5777888265](https://github.com/yigini/soilfer-lims/issues/115#issuecomment-5777888265)) |
| **#116** | 4 | Hardcoded English strings in Spanish/multilingual UI | Reproduced & Implemented Locally | `278d32b` + `0a7cbde` (PR #132) | `localization_and_user_display.test.js` (18/18 passed), 450 ICU checks passed, client production build (`vite build` clean) | `c5ed62e` (v3.5.19) | Removed hardcoded English strings across dashboard, manager task list, QA, navigation, and inventory in all 5 supported locales (`en`, `es`, `es-419`, `fr`, `pt`). Standardized manager action terminology to "Lista de tareas" in Spanish/Portuguese and "Manager Task List" in English; localized queue units, map controls, view selector pills, dynamic row descriptions/actions, decision tabs, and newly added inventory subtotal, count needed, confirmed low, and uncertain low stock badges; localized header Help button ("Ayuda" in Spanish, "Aide" in French, "Ajuda" in Portuguese, "Help" in English) across all locales. Scientific codes remain untranslated scientific symbols. Independent live Spanish LAB_MANAGER verification confirmed translated UI, visible "Ayuda" and "Plegar". | Translation files maintain valid JSON syntax. | **CLOSED** (2026-09-22 14:00:58 UTC; [Issue #116 comment 5777891149](https://github.com/yigini/soilfer-lims/issues/116#issuecomment-5777891149)) |
| **#126** | 4 | Raw usernames displayed instead of proper names in messages/tasks | Reproduced & Implemented Locally | `1ed46ef` | `localization_and_user_display.test.js` (12/12 passed), client production build (`vite build` clean) | `7516f0e` | Resolved stored proper display name (`user.name`) with safe username fallback across message lists, conversation threads, notification toasts, task assignment dropdowns, and header drawers; leading/trailing whitespace safely trimmed; historical/deactivated users and missing names fall back gracefully; audit logs and reviewer attributions retain stable immutable username identifiers. | Passwords and private profile data excluded. | Code LIVE in `v3.5.19`; Individual live workflow acceptance pending. OPEN |
| **#102** | 5 | Physical mobile device testing (iOS Safari, Android Chrome) | Open | Pending | Mobile device testing execution sheet (`docs/test-sheets/mobile-device-testing.md`) | `7516f0e` | Real physical device testing sheet established covering touch targets, virtual keyboard pan/zoom, horizontal scrolling, sticky headers, camera permissions, and offline draft sync. Emulation alone is insufficient. | Requires physical device validation on deployed release candidate. | Actual iOS Safari / Android Chrome hardware evidence pending. OPEN |
| **#103** | 5 | User membership reconciliation & country access grants | Open | Pending | Read-only discrepancy ledger (`docs/governance/membership-reconciliation-ledger.md`) | None (Gate) | Governance framework and illustrative archetypes mapped against real Prisma schema (`User.labId`, `User.projects`, `User.countries`, `ProjectLab`); scopeGuard global access rules documented (`SUPER_ADMIN` only); no invented junction tables; production migration hold strictly active. | Under production migration hold. | Reconciliation apply and access expansion NOT performed; governance hold remains. OPEN |
| **#104** | 5 | Separate Laboratory Dashboard sample count discrepancy | Open | Pending | External reconciliation protocol (`docs/governance/external-dashboard-reconciliation.md`) | None (Gate) | Reconciled metric definitions (Field Registry vs Expected vs Active Lab Work); 3,580 distinguished as reporter snapshot (Luis, 15 Sept 2026); external dashboard architecture documented as unknown; protocol marked as preparation framework; synthetic backfill prohibited. | Requires reporter confirmation from Luis. | Separate dashboard discrepancy not established as fixed; investigation/reporter clarification pending. OPEN |
| **#146** | 6 | Ghana Expected Arrivals & Kobo Intake Pipeline; duplicate barcode provenance, reception intake hold guards, bounded ingestion | Reproduced & Implemented Locally | `e5d5ebd` (PR #147) | `kobo_duplicate_provenance.test.js` (18/18), `rehearsal_packaged_wrapper.cjs` (9/9), `rehearsal_docker_boundary.cjs` (5/5 real Docker scenarios), CI Run 36236624897 (green in 7m5s) | `e5d5ebd` (v3.5.29) | Primary source coordinates (`sourceServerUrl`, `sourceFormId`, `depth`) persisted in `compactMeta`; original primary replay is 100% idempotent (0 changes); strict 4-coordinate deduplication; unknown/foreign records protected; durable `AMBIGUOUS_PROVENANCE_HOLD` on intra-submission duplicate depths with complete attachment descriptors; reception intake fail-closed guards return HTTP 409 and block workspace intake; production release executed with stopped-writer pre-operation consistent backup (`dev_pre_issue146_20260926_125855.db`, SHA: `94031034...`); atomic CAS activated KoboConfig for `GHA-LAB1` / `SOILFER-US`; single-writer bounded ingestion from verified snapshot admitted exactly 864 EXPECTED specimens (`receptionDate=null`), 4 placed on durable hold; post-apply DB count: 37,742 (36,878 + 864), integrity `ok`, FK `OK`; live reverse proxy traffic restored cleanly. | Historic public PR objects remain a separate unresolved privacy matter pending repository owner confirmation. Zero production mutations outside canonical runner. | Released to Production (`e5d5ebd` / `v3.5.29`); Ready for Codex Independent Post-Verification (`Refs #146`) |


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

### Phase 3B: Issues #117 & #113 Comprehensive Verification on Isolated Disposable Reception Fixtures
- **Verification Suite**: `server/scripts/verify_issues_117_113_reception.cjs` (1,836 lines)
- **Execution Date**: 2026-09-24 00:47:16 UTC
- **Exact Source Provenance & Client Build**:
  - Source Git SHA: `dcc47066a6805f29ceeacd471fd402134654a460` (v3.5.25 released; `git diff dcc4706 HEAD -- client server` is 0 differences).
  - Working tree commit: `7062542928b1c40032a327b2396592006516e2cb` (release documentation).
  - Client Build: Fresh production build with Vite v5.4.21 at `2026-09-24T00:37:15.000Z` (`client/dist/assets/Reception-D76w_gqE.js`, `client/dist/assets/index-BmIXiAyn.js`, `client/dist/assets/index-C5d3ru5M.css`).
  - Shared Guard: `server/utils/scopeGuard.js` authoritative `assignedLab` facility scope resolution from `db09aaa` (PR #142, merged in `dcc4706`).
- **Environment & Database Isolation**:
  - Headless Google Chrome via Chrome DevTools Protocol (CDP).
  - Production Express server serving compiled production client bundle (`client/dist`).
  - Synthetic isolated disposable SQLite database (`server/.tmp_journey_runner_1790210802100_*/disposable_journey_*.db`) with `journey_db_isolation.cjs` active refusal guard rejecting any working or inherited database paths (`prisma/dev.db`).
  - Ephemeral test principals: Laboratory `LAB-VERIFY-1790210807896_eocyi`, Receptionist `tech.reception.1790210807896_eocyi` (`SAMPLE_RECEPTION`), Manager `mgr.reception.1790210807896_eocyi` (`LAB_MANAGER`), Project `PRJ-VERIFY-1790210807896_eocyi`.
  - Zero queries, mutations, or network traffic to production host `46.19.33.37` (`lims.yigini.net`).
- **Overall Result**: **23/23 steps passed (100% green, exit code 0)**.
- **Evidence Artifacts**:
  - Machine-readable ledger: `artifacts/evidence-journeys/reception_issue117_113_evidence.json` (9,328 bytes, 23/23 passed steps with provenance metadata).
  - Verified visual rendering (All-Pass Browser Flow): `artifacts/evidence-journeys/reception_issue113_allpass_confirmed.png` (103,042 bytes, unobscured "INTAKE CONFIRMED!" with permanent Lab ID `S001`).
  - Verified visual rendering (Walk-in CoC N/A Flow): `artifacts/evidence-journeys/reception_issue113_walkin_na_confirmed.png` (98,859 bytes, unobscured "INTAKE CONFIRMED!" with permanent Lab ID `W002`).
  - Verified visual rendering (Rejection Flow): `artifacts/evidence-journeys/reception_issue117_113_verified.png` (118,120 bytes, verified "NON-CONFORMANCE RECORDED" modal with `RECEIVED_REJECTED` status).

#### 1. Issue #117 Intake Fail Selection, Auto-Sync, Cancellation, Correction, Autosave & Rejection (Steps 1–12)
1. **Step 1: Reception Console First Render**: Verified initial mount of Reception console (`/reception`) without TDZ `checklistData` `ReferenceError` crashes; modes accessible.
2. **Step 2: ComplianceChecklist Mount in Walk-in**: Clicked "Walk-in Sample"; verified `WalkInForm` parent and `ComplianceChecklist` child mounted together with interactive criteria controls.
3. **Step 3: Fail Selection Visual Red State & Badge**: Clicked "Fail" on Container Intact; verified button rendered with `aria-checked="true"`, red styling (`bg-red-600 text-white`), and red "FAIL" badge on the criterion row.
4. **Step 4: Failure Note Entry in Criterion Field**: Entered failure description `"Container torn at top seam with sample spillage"` via React 18 controlled-input value-tracker setter; confirmed value captured in DOM input.
5. **Step 5: Non-Conformance Flow Auto-Sync & Visibility**: Verified non-conformance flag auto-checked (`checked: true`), non-conformance explanation textarea rendered with populated note, and "Reject Sample" button visible.
6. **Step 6: Cancellation Preserves Fail State (Discard Flow)**: Clicked "Discard Form"; verified authentic discard confirmation dialog displayed; clicked "Keep Editing" (Cancel); verified Fail selection (`aria-checked="true"`), failure note, and red badge remained fully intact in DOM.
7. **Step 7: Cancellation Preserves Fail State (Manager Gate)**: Clicked "Complete Intake" under `SAMPLE_RECEPTION` role; verified application displayed "Manager Authorization Required" modal; dismissed modal; verified Fail selection, failure note, and red badge remained completely intact in DOM.
8. **Step 8: Correction Back to OK Clears Note & Unflags NC**: Cleared non-conformance explanation and clicked "OK" on Container Intact; verified OK button received `aria-checked="true"`, Fail button cleared, failure note input removed from DOM, non-conformance flag auto-unflagged, and "Reject Sample" button hidden.
9. **Step 9: Real Timed 10s Autosave Persists Fail & Note**: Entered Submitter `"Alvaro Gutierrez"`, selected Fail on Label Legible with note `"Handwritten label smudged by rain, ID unreadable"`; waited 11.5s for application's actual 10-second `setInterval` autosave timer; asserted draft payload in `localStorage['limsi_intake_autosave']`.
10. **Step 10: Draft Restoration Rehydrates Fail State & Note**: Reloaded `/reception`; confirmed authentic application "Restore Draft?" dialog; clicked "Restore Draft"; verified DOM accurately restored Submitter, Label Fail button (`aria-checked="true"`), failure note, and non-conformance flag.
11. **Step 11: Draft Save Button & Stored Answer Truth**: Clicked "Save as Draft"; confirmed sample created in SQLite with `status: 'DRAFT'`, `receptionData.checklist.items.label: 'FAIL'`, non-conformance note in metadata, and audit log recording `DRAFT`.
12. **Step 12: Non-Conformance Rejection Flow & Audit History**: Filled all 5 checklist criteria (with Container set to Fail and explanation provided), received mass > 0g, and default analysis bundle; clicked "Reject Sample"; verified "Non-Conformance Recorded" result modal rendered with `RECEIVED_REJECTED` status, Sample ID (`SMP-EXP-...`), carrier, and receiving officer attribution. Asserted database state: `status: 'RECEIVED_REJECTED'`, `receptionData.checklist.items.container: 'FAIL'`, `metadata.nonConformance` preserved, and audit history recorded. Captured `reception_issue117_113_verified.png`.

#### 2. Issue #113 Routine Compliant, Walk-in CoC N/A, Omitted/Empty Denial, Guards & Manager Exception (Steps 13–23)
13. **Step 13: Routine Compliant Outcome (All Pass Browser Flow)**: Real reception-role intake executed in Headless Chrome CDP for scheduled project sample (`SMP-ROUTINE-EXP-...`). Marked all 5 criteria OK via "Mark all OK", entered 500g mass, clicked "Complete Intake". Verified DOM: zero "Manager Authorization Required" dialogs, zero compliance error dialogs, "INTAKE CONFIRMED!" rendered with permanent Lab ID `S001`. Verified SQLite: `status: 'ACCEPTED'`, 5/5 PASS items persisted in `receptionData.checklist`, history has `RECEIVED` and 0 `ADMITTED_WITH_EXCEPTION`. Captured `reception_issue113_allpass_confirmed.png`.
14. **Step 14: Walk-in CoC N/A Permitted Policy (Browser Flow)**: Real reception-role intake executed in Headless Chrome CDP for walk-in sample. Filled submitter ("Fatima Al-Mansoor", phone), location ("Chilanga Farm Block", "Near Agricultural Research Station"), depth (`0–20 cm`), purpose (`BASIC_SOIL`), mass 500g. In checklist, clicked "Mark all OK", then clicked "Chain of Custody Present: N/A". Clicked "Complete Intake". Verified DOM: zero manager prompts, "INTAKE CONFIRMED!" rendered with permanent Lab ID `W002`. Verified SQLite: `status: 'ACCEPTED'`, `isWalkIn: true`, `receptionData.checklist.items.coc.status === 'NA'`, other 4 items PASS, history has `RECEIVED` and 0 `ADMITTED_WITH_EXCEPTION`. Captured `reception_issue113_walkin_na_confirmed.png`.
15. **Step 15: Fail-Closed: Incomplete Checklist Blocked**: Intake submitted with unanswered criteria (`condition`, `coc`) rejected with HTTP 400 `INCOMPLETE_COMPLIANCE_CHECKLIST` (`Unanswered compliance checklist items: condition, coc. All items must be assessed before final acceptance.`); verified zero database mutations (sample created: false).
16. **Step 16: Fail-Closed: Empty Checklist Blocked**: Intake submitted with empty checklist items `{ items: {} }` rejected with HTTP 400 `INCOMPLETE_COMPLIANCE_CHECKLIST`; verified zero database mutations.
17. **Step 17: Fail-Closed: Omitted Checklist Blocked**: Intake submitted with `checklist` property completely omitted from the payload rejected with HTTP 400 `INCOMPLETE_COMPLIANCE_CHECKLIST`; verified zero database mutations.
18. **Step 18: Fail-Closed: Prohibited Container N/A Blocked**: Intake submitted with Container Intact marked N/A rejected with HTTP 400 `INVALID_CHECKLIST_NA` (`Not Applicable (N/A) is not permitted for criteria: container`); verified zero database mutations.
19. **Step 19: Fail-Closed: Shipment CoC N/A Prohibited**: Intake submitted with CoC marked N/A on formal shipment (`isWalkIn: false`) rejected with HTTP 400 `INVALID_CHECKLIST_NA`; verified zero database mutations.
20. **Step 20: Fail-Closed: Staff Self-Authorization Prohibited**: Reception staff attempting to self-authorize a failed checklist item with client-supplied `complianceException` and forged authorizer rejected with HTTP 403 `COMPLIANCE_FAILURE_EXCEPTION_REQUIRED`; client-forged authorizer stripped at HTTP boundary; verified zero database mutations.
21. **Step 21: Authorized Manager Exception Admission**: Authorized laboratory manager submits intake with non-conformance exception; sample admitted routinely as `ACCEPTED` (HTTP 200); audit history records `ADMITTED_WITH_EXCEPTION`; metadata records `complianceException.verifiedAuthorizer`.
22. **Step 22: Exception Reason Policy (>= 5 Chars Enforced)**: Manager exception submitted with empty or trivial reason (< 5 characters) rejected with HTTP 403 `COMPLIANCE_FAILURE_EXCEPTION_REQUIRED`; verified zero database mutations.
23. **Step 23: Uncovered-Problem Route Preserves Staff Audit Trail**: Staff documentation of an uncovered problem with notes is rejected for staff self-acceptance (HTTP 403); subsequent manager exception admission with justification ("VOC screening exception") succeeds (HTTP 200); audit trail preserves staff initial notes alongside manager authorization in history.

### Phase 3C: Issue #114 Comprehensive Map Centering, Satellite Layer, Fullscreen & Coordinate Safety Verification
- **Verification Suite**: `server/scripts/verify_issue_114_maps.cjs` (1,072 lines)
- **Execution Date**: 2026-09-24 01:39:23 UTC
- **Exact Source Provenance & Client Build**:
  - Source Git SHA: `dcc47066a6805f29ceeacd471fd402134654a460` (v3.5.25 released; `git diff dcc4706 HEAD -- client server` is 0 differences).
  - Working tree commit: `7062542928b1c40032a327b2396592006516e2cb` (release documentation).
  - Client Build: Fresh production build with Vite v5.4.21 at `2026-09-24T00:37:15.000Z` (`client/dist/assets/Reception-D76w_gqE.js`, `client/dist/assets/index-BmIXiAyn.js`, `client/dist/assets/index-C5d3ru5M.css`).
- **Environment & Database Isolation**:
  - Headless Google Chrome via Chrome DevTools Protocol (CDP).
  - Production Express server serving compiled production client bundle (`client/dist`).
  - Synthetic isolated disposable SQLite database (`server/.tmp_journey_runner_1790213901458_wzkexy/disposable_journey_wzkexy.db`) with `journey_db_isolation.cjs` active refusal guard rejecting any working or inherited database paths (`prisma/dev.db`).
  - Ephemeral test principals: Harare Receptionist `tech.reception.harare.*` (Harare, Zimbabwe `[-17.8292, 31.0522]`), Lusaka Receptionist `tech.reception.lusaka.*` (Lusaka, Zambia `[-15.4167, 28.2833]`), Addis Ababa Receptionist `tech.reception.addis.*` (Addis Ababa, Ethiopia `[9.0300, 38.7400]`), Unconfigured Receptionist `tech.reception.unconfigured.*` (No coordinates/country).
  - Zero queries, mutations, or network traffic to production host `46.19.33.37` (`lims.yigini.net`).
- **Overall Result**: **16/16 steps passed (100% green, exit code 0)**.
- **Evidence Artifacts**:
  - Machine-readable ledger: `artifacts/evidence-journeys/map_issue114_evidence.json` (5,943 bytes, 16/16 passed steps with provenance metadata).
  - Verified visual rendering (Configured Lab Centering with Blank Coordinates): `artifacts/evidence-journeys/map_issue114_harare_blank_coords.png` (184,259 bytes, Harare centered, blank lat/lng inputs, 0 markers).
  - Verified visual rendering (Deliberate Marker Placement & Uncertainty): `artifacts/evidence-journeys/map_issue114_harare_marker_placed.png` (201,371 bytes, blue pin marker, ±500m uncertainty circle, `DESK_PIN` provenance, populated lat/lng/uncertainty inputs).
  - Verified visual rendering (Satellite Layer & Zero-Paid Legal Attribution): `artifacts/evidence-journeys/map_issue114_satellite_attribution.png` (253,303 bytes, Esri World Imagery tiles, exact Esri MLA attribution without paid keys).
  - Verified visual rendering (Project Mode SampleMap Field Preview): `artifacts/evidence-journeys/map_issue114_project_sample_preview.png` (260,305 bytes, read-only `SampleMap` preview with marker at field coordinates `[-17.8100, 31.0400]`).
  - Verified visual rendering (Project Mode Truthful Placeholder): `artifacts/evidence-journeys/map_issue114_no_coords_placeholder.png` (162,829 bytes, truthful placeholder "No coordinates recorded in the field", zero false map markers or misleading lab assignments).

#### 1. Sourced Laboratory Centering & Coordinate Safety (Steps 1–6)
1. **Step 1: Auth Profile Sourced Laboratory Location (Harare)**: Verified Harare receptionist auth profile (`/api/auth/me`) resolves `labLocation: "-17.8292, 31.0522"` and `country: "ZW"`.
2. **Step 2: LocationPicker Mount in Walk-In Console**: Verified interactive Leaflet map container cleanly mounted in `WalkInForm` within the live Reception view.
3. **Step 3: Configured Lab Centering with Blank Sample Coordinates (Harare)**: Verified map viewport cleanly centered at Harare `[-17.8324, 31.0474]`, while Latitude, Longitude, and Uncertainty controlled inputs remain completely blank (`latInput=""`, `lngInput=""`), with 0 markers on the map (`map_issue114_harare_blank_coords.png`).
4. **Step 4: Viewport Movement Coordinate Safety**: Panned and dragged the viewport across the region; verified that viewport motion does NOT silently assign sample coordinates (`latInput=""`, `lngInput=""`, 0 markers).
5. **Step 5: Deliberate Marker Placement, Uncertainty & Provenance**: Clicked explicitly on the map to place a pin; verified marker count = 1 at `[-17.83, 31.05]`, default uncertainty circle rendered (radius 500m, circles = 1), provenance set to `DESK_PIN`, and controlled inputs populated (`map_issue114_harare_marker_placed.png`).
6. **Step 6: Deliberate Coordinate Adjustment & Re-Centering**: Manually adjusted coordinate input fields to `[-17.835, 31.055]`; verified map re-centered and marker updated to new coordinates without duplicate pins.

#### 2. Satellite Layer, Legal Attribution, Fullscreen & Resilience (Steps 7–9)
7. **Step 7: Satellite Layer Switch & Zero-Paid Legal Attribution**: Switched layer toggle from Standard to Satellite; verified map tiles rendered from Esri World Imagery; verified attribution contains legal Esri MLA attribution (`Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community`); verified zero paid Google or proprietary keys required (`map_issue114_satellite_attribution.png`).
8. **Step 8: Fullscreen Capability Guard & Error Handling**: Verified fullscreen toggle button present; verified safe capability guard checking `document.fullscreenEnabled` without uncaught exceptions or UI failure.
9. **Step 9: Tile Error Fallback & Resilience Handling**: Dispatched tile load error event; verified graceful error fallback executes without breaking Leaflet map container or unmounting UI.

#### 3. Multi-Country Laboratory Centering & Neutral Fallback (Steps 10–13)
10. **Step 10: Sourced Laboratory Centering for Zambia (Lusaka Viewport)**: Authenticated as Lusaka receptionist (`tech.reception.lusaka.*`, `labLocation: "-15.4167, 28.2833"`); verified map viewport cleanly centered on Lusaka `[-15.4219, 28.2788]` with blank coordinates and 0 markers.
11. **Step 11: Sourced Laboratory Centering for Ethiopia (Addis Ababa Viewport)**: Authenticated as Addis Ababa receptionist (`tech.reception.addis.*`, `labLocation: "9.0300, 38.7400"`); verified map viewport cleanly centered on Addis Ababa `[9.0262, 38.7378]` with blank coordinates and 0 markers.
12. **Step 12: Unconfigured Laboratory Neutral Centering Fallback**: Authenticated as receptionist in laboratory without configured coordinates or country; verified map viewport safely defaults to neutral African centroid `[0, 20]` with blank coordinates and 0 markers.
13. **Step 13: Existing Sample Coordinates Precedence**: Mounted sample with existing coordinates (Kadoma field site `[-18.3300, 29.9100]`); verified map viewport strictly prioritizes sample coordinates over laboratory location, centering on `[-18.3300, 29.9100]`.

#### 4. Project Mode SampleMap Preview & Architectural Separation (Steps 14–16)
14. **Step 14: Project Mode SampleMap (Pre-Registered Sample With Field Coordinates)**: Looked up project sample pre-registered with field GPS coordinates (`[-17.8100, 31.0400]`); verified "Location Preview" renders `SampleMap` with marker at field site (`map_issue114_project_sample_preview.png`).
15. **Step 15: Project Mode SampleMap (Truthful Missing-Coordinates Placeholder)**: Looked up project sample without field coordinates; verified "Location Preview" renders truthful placeholder `"No coordinates recorded in the field"`, warning banner displayed, zero false map markers rendered, and zero misleading lab coordinate assignment (`map_issue114_no_coords_placeholder.png`).
16. **Step 16: Intake vs Field Preview Map-Editor Wiring Separation**: Confirmed architectural separation—`SampleMap` is a read-only field survey evidence preview component, while `LocationPicker` is the interactive intake coordinate editor (walk-in intake & MetadataEditorModal), preventing silent or false lab coordinate assignment for missing field survey records.

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

---

### 15. Issue #120 Follow-up: Laboratory Manager Dashboard Progress & Bottleneck Overview

Following the v3.5.23 production deployment of PR #139, side-by-side inspection of the live system revealed that while Kobo expected arrivals routing and search/filter preservation are operational, the `LAB_MANAGER` Dashboard (`/`) and scoped System Admin Dashboard still rendered the 5 pending-action queues (`WorkQueue`), duplicating the actionable workbench of the Manager Task List (`/manager-queue`) rather than displaying a high-level operational progress, stage, and bottleneck overview.

A focused correction was implemented on branch `fix/issue-120-manager-dashboard-progress` to complete the architectural separation requested in Issue #120:

#### 1. Architectural Distinction & Component Design
- **Laboratory Manager Dashboard (`/`)**:
  - High-level operational overview for `LAB_MANAGER` and scoped `SUPER_ADMIN` with active laboratory selection (`progressOverview`).
  - **Operational Stage Pipeline**: 5 lifecycle cards showing truthful, set-based counts across the analytical process:
    - *Intake Acceptance*: Samples awaiting physical reception / admission.
    - *In Analysis*: Active specimens undergoing analytical determinations (`ACCEPTED`, `PROCESSING`).
    - *Awaiting Review*: Samples with submissions awaiting manager review (`PENDING_REVIEW`).
    - *Final Approval*: Samples with all analytical determinations completed and ready for authorization.
    - *Completed Today*: Samples authorized/approved today.
  - **Sample Determination Progress Monitor**:
    - Displays active samples undergoing laboratory determinations.
    - Visual progress bars reflecting percentage completion across ordered methods.
    - Honest determination ratio (`completed / total analyses`).
    - Prominent `READY FOR REVIEW` badge when all analytical determinations are complete.
    - Direct drill-down link to sample detail (`/samples/:id`).
  - **Technician Workload & Bottlenecks**:
    - Workload distribution cards per active bench technician showing assigned, completed, and pending determination counts.
    - `High Workload` warning badge when pending determinations exceed threshold (>= 15).
    - Prominent `Unassigned Determinations` warning banner with direct "Assign" action linking to the assignment lane.
  - **Dashboard View Switcher**:
    - Managers and scoped system administrators can toggle between `[ Operational Overview ]` and `[ Pending Work Queue ]` without losing dashboard context.
  - **Direct Continuation Links**:
    - Header button "Open manager task list" linking directly to `/manager-queue`.
- **Manager Task List (`/manager-queue`)**:
  - Remains the dedicated operational execution workbench for taking action on pending queues (QC Exceptions, New Intake, Assign Work, Review Submissions, Final Approvals).

#### 2. Gate Determination Exclusion & Scientific Rigor
- Analytical progress calculations strictly exclude preparation and conditioning gate analyses (`DRYING` and `PREPARATION` in `GATE_ANALYSES`).
- This ensures sample progress bars reflect actual analytical method determinations (e.g. pH, EC, Walkley-Black OC, Hydrometer Texture, Olsen P) rather than gate setup phases.

#### 3. Database & Policy Invariance
- **Zero Schema Migrations**: All metrics and oversight data are computed via pure set-based aggregations in `server/services/dashboardService.js`.
- **Zero Production Mutations**: No production samples, results, work items, or Kobo sync records were created, modified, or deleted.

#### 4. Multilingual Localization (i18n)
- Complete `dashboard.manager` dictionaries added across all 5 supported locales:
  - English (`en.json`)
  - Spanish (`es.json`)
  - Latin American Spanish (`es-419.json`)
  - French (`fr.json`)
  - Portuguese (`pt.json`)
- Dynamic unit pluralization correctly parameterized with `{ count }` supporting ICU format (`samples`, `analyses`).

#### 5. Automated Tests & Headless Chrome CDP Verification
- **Targeted Contract Tests**:
  - `server/tests/contracts/manager_dashboard_overview.test.js` (9/9 passed in 6.25s):
    1. `LAB_MANAGER` dashboard home includes `progressOverview` with analytical oversight and `techWorkload`.
    2. `SUPER_ADMIN` scoped to a lab receives matching `progressOverview`.
    3. Cross-lab isolation: Manager 2 in LAB-HND strictly does not see Manager 1 records or technicians.
    4. Analytical progress denominator excludes closure tasks (`ARCHIVING`) and counts `SUBMITTED` work with `READY_FOR_REVIEW` badge.
    5. Already `ACCEPTED` sample displays `READY_FOR_APPROVAL` badge (not `READY_FOR_REVIEW`) and excludes `DISPOSAL` from denominator.
    6. Mutually exclusive stage partitioning classifies candidates with strict precedence and isolates `RECEIVED` to `pendingIntake`.
    7. `RECEIVED` count-to-destination alignment: sample appears in Stage 1 intake destination and not in In Analysis destination.
    8. Stage 5 Approved / Released population counts authoritative `approvedAt` today, ignoring generic `updatedAt`, and strictly counts `APPROVED` samples.
    9. Approved / Released count-to-destination alignment: Stage 5 route (`/samples?status=APPROVED`) matches card count exactly and omits unapproved `SUBMITTED_FULL` and `COMPLETED`.
- **Client Build**:
  - `npm run build` in `client` passed cleanly without warnings or errors.
- **Side-by-Side Browser CDP Journey** (`server/scripts/run_manager_dashboard_tasklist_side_by_side.cjs`):
  - Executed end-to-end on an isolated disposable database with realistic multi-technician fixture data:
    1. `/` (Dashboard - Operational Overview): Verified h1 "Laboratory overview", Stage Pipeline (5 cards with accurate counts and ICU plurals, including Stage 5 "Approved / Released" with subtext "1 approved today"), Analysis Progress bars (33%, 100% with "Ready for Review" badge, and 100% with "Ready for Approval" badge), Technician Workload cards, and Unassigned Alert banner. Screenshot: `manager_dashboard_overview_verified.png`.
    2. `/` (Dashboard - Pending Work Queue toggle): Verified toggle to work queue table preview with Action buttons. Screenshot: `manager_dashboard_queue_toggle_verified.png`.
    3. `/manager-queue` (Manager Task List): Verified dedicated execution workbench with Assign Work, Review Submissions, Final Approvals, and QC Exceptions tabs. Screenshot: `manager_tasklist_action_verified.png`.
    4. `/?labId=LAB-GTM` (Scoped System Admin Dashboard): Verified scoped overview matching Guatemala lab workload. Screenshot: `super_admin_scoped_dashboard_verified.png`.
    5. `/samples?status=APPROVED` (Stage 5 Destination): Verified navigation from Stage 5 card loads matching approved specimens, and omits unapproved `SUBMITTED_FULL`, non-canonical `COMPLETED`, and `RECEIVED` specimens. Screenshot: `manager_dashboard_stage5_destination_verified.png`.
  - Machine-readable evidence log: `artifacts/evidence-journeys/manager_dashboard_overview_evidence.json` (Status: `VERIFIED`, 5/5 findings passed).

#### 6. Independent Review Feedback Resolution (PR #141 / Comment 5796060402)
- **Gap 1: Analytical Progress Denominator & Lifecycle Badges**:
  - Excluded all `NON_ANALYTICAL` methods (`DRYING`, `PREPARATION`, `ARCHIVING`, `ARCH`, `DISPOSAL`, `DISP`) from the denominator.
  - Counted `SUBMITTED`, `COMPLETED`, and `ACCEPTED` in `completed` bench determinations.
  - Fully `SUBMITTED` sample displays 100% progress with "Ready for Review" (`READY_FOR_REVIEW`) badge.
  - Fully `ACCEPTED` sample displays 100% progress with "Ready for Approval" (`READY_FOR_APPROVAL`) badge, strictly eliminating the post-review "Ready for Review" badge regression.
- **Gap 2: Completed Population, Authoritative Dates & Destination Alignment**:
  - Replaced generic `updatedAt` with authoritative `approvedAt: { gte: dayStart, lt: dayEnd }` for `approvedToday`.
  - Stage 5 card labeled "Completed / Released" with subtext `{count} approved today` and destination route `/samples?status=SUBMITTED_FULL,APPROVED` matching `SamplesFilterBar`.
- **Gap 3: Mutually Exclusive Stage Partitioning**:
  - Partitioned active specimens with strict precedence (`FINAL_APPROVAL` > `AWAITING_REVIEW` > `IN_PROGRESS`), eliminating double-counting across the pipeline cards.

#### 7. Delta Review Feedback Resolution (PR #141 / Comment 5796896939)
- **Gap 1: Intake Isolation & Zero RECEIVED Double-Counting**:
  - `candidates` query in `dashboardService.js` previously queried `status in ['RECEIVED', 'ACCEPTED', 'PROCESSING', ...]`. Since `pendingIntakeCount` separately counted `RECEIVED`, any `RECEIVED` specimen with `receptionDate` fell into the `else` branch of the candidate partition loop (`stageInProgressCount++`), causing it to be double-counted across both Intake and In Analysis cards.
  - Excluded `RECEIVED` from `candidates` and strictly gated `stageInProgressCount` to active bench statuses (`['ACCEPTED', 'PROCESSING', 'SUBMITTED_PARTIAL'].includes(s.status)`). This cleanly isolates `RECEIVED` specimens to Stage 1 (`pendingIntake`), preserves candidate evaluation for final approval, and prevents `RECEIVED` or non-active specimens from appearing in analytical oversight or `inProgress`.
  - Verified with Contract Tests 6 & 7: `pendingIntake === 1`, `inProgress === 1`, `sampleReceived` is absent from `oversight`, present in `/samples?status=RECEIVED,COLLECTED`, and absent from `/samples?status=ACCEPTED,PROCESSING`.
- **Gap 2: Completed Population & Destination Route Parity**:
  - `completedCount` in `dashboardService.js` previously queried `status: { in: ['APPROVED', 'COMPLETED', 'SUBMITTED_FULL'] }`, whereas the released Samples Quick Filter and route `/samples?status=SUBMITTED_FULL,APPROVED` omits `COMPLETED` (in the SoilFER-LIMS schema, `COMPLETED` applies strictly to work items, not sample states).
  - Aligned `completedCount` strictly to `status: { in: ['APPROVED', 'SUBMITTED_FULL'] }`, ensuring 100% parity between card count and destination query without modifying released filter components.

#### 8. Delta Review Feedback Resolution: Approved / Released Mutual Exclusivity (PR #141 / Comment 5797994081)
- **Stage 4 & Stage 5 Non-Overlapping Partition**:
  - `SUBMITTED_FULL` specimens with accepted work were properly counted in `stageCounts.finalApproval` (Stage 4), but `stageCounts.completed` also counted all `SUBMITTED_FULL` specimens, causing specimens ready for final authorization to be double-counted in both Stage 4 and Stage 5. `SUBMITTED_FULL` represents bench-complete analytical work awaiting final approval, not approved or released work.
  - In `server/services/dashboardService.js`, updated `completedCount` to strictly query `status: 'APPROVED'` (and `approvedAt: { gte: dayStart, lt: dayEnd }` for `approvedToday`).
  - In `client/src/components/dashboard/ManagerProgressOverview.jsx`, aligned the fifth card to "Approved / Released" (`dashboard.manager.stageCompleted`), pointing directly to destination route `/samples?status=APPROVED`. Updated localization in all 5 languages (`en`, `es`, `es-419`, `fr`, `pt`).
  - Added dedicated contract fixture `sampleSubmittedFullAccepted` (`status: 'SUBMITTED_FULL'` with `ACCEPTED` work items):
    - Counted in Stage 4: `stageCounts.finalApproval === 2` (`sampleApproval` + `sampleSubmittedFullAccepted`).
    - Strictly excluded from Stage 5: `stageCounts.completed === 2` (`sampleApprovedToday` + `sampleApprovedPast`).
    - Excluded from Stage 5 destination: `/samples?status=APPROVED` contains only the 2 approved specimens and omits `sampleSubmittedFullAccepted`.
  - Zero double-counting across all 5 stages: `pendingIntake (1) + inProgress (1) + awaitingReview (1) + finalApproval (2) + completed (2) = 7`.

#### 9. Review Feedback Resolution: Canonical Final-Approval Eligibility for Readiness & Scoped Continuation Links (PR #141 / Comment 5801965350)
- **Gap 1: Canonical Final-Approval Eligibility for Overview Readiness**:
  - Previously, the sample determination overview assigned `READY_FOR_APPROVAL` based solely on existing analytical items being completed/accepted, which could prematurely flag a specimen as "Ready for Approval" even if required ordered analyses were missing or prerequisite operational gates (e.g. drying/preparation) were still incomplete.
  - Reused the canonical final-approval evaluation engine (`canFinalApprove` from `services/workflowContract.js`) directly in `server/services/dashboardService.js`:
    - Evaluates required ordered analyses from `orderLines` or `sample.requiredAnalyses` (excluding `NON_ANALYTICAL` and `GATE_ANALYSES`).
    - Adjusts progress denominator to `Math.max(analyticalWork.length, allAnalyticalCodes.size)` so missing ordered analyses factor into progress calculation rather than falsely showing 100%.
    - Counts `WAIVED` work items alongside `ACCEPTED` determinations (`['SUBMITTED', 'COMPLETED', 'ACCEPTED', 'WAIVED'].includes(w.status)`).
    - Gates `readiness = 'READY_FOR_APPROVAL'` strictly when `canFinalApprove(sample, workItems, orderLines, user).allowed` is `true`.
    - Samples with pending prerequisite gates or missing ordered work remain in `IN_ANALYSIS` (`isReady: false`) until all gates pass and all required analyses are accepted or waived.
    - Verified with Contract Test 5b:
      - `sampleMissingRequired` (accepted pH, missing required EC, pending drying gate): `total: 2`, `completed: 1`, `progress: 50%`, `readiness: 'IN_ANALYSIS'`, `isReady: false`, with blockers `PREREQUISITE_GATE_INCOMPLETE` and `ORDER_LINE_INCOMPLETE`.
      - `sampleAcceptedWaived` (accepted pH + waived EC, completed gates): `total: 2`, `completed: 2`, `progress: 100%`, `readiness: 'READY_FOR_APPROVAL'`, `isReady: true`.
- **Gap 2: Scoped-Admin Continuation Link Lab Preservation & Destination Real-Link Checks**:
  - `ManagerProgressOverview.jsx`: Added helper `buildRoute` to preserve `labId=${encodeURIComponent(activeLabId)}` across all rendered stage continuation links (`/manager-queue?lane=intake`, `/samples?view=daily`, `/manager-queue?lane=review`, `/manager-queue?lane=approve`, `/samples?status=APPROVED`), the unassigned tasks alert (`/manager-queue?lane=assign`), and the overview task list button (`/manager-queue`).
  - `DashboardShell.jsx`: Preserved `selectedLabId` on the header task list button (`/manager-queue?labId=...`).
  - `ManagerQueue.jsx`: Preserved `labId` from search parameters across queue tab navigation (`handleTabChange`) and included `params.labId` in all manager queue data requests (`/api/samples`, `/api/work`, `/api/submissions`, `/api/dashboard/queues/*`).
  - `workItemController.js` and `submissionController.js`: Added support for filtering by `labId` (`{ OR: [{ labId }, { assignedLab: labId }] }` and `assignedLab = labId` for `SUPER_ADMIN`), ensuring scoped administrators remain strictly isolated to the selected laboratory.
  - Replaced test descriptions of invented destination URLs with real-link checks:
    - Contract Test 7 validates real component rendered routes: `/manager-queue?lane=intake&labId=...` calls `/api/samples?status=RECEIVED,COLLECTED&labId=...` (returns Guatemala sample, omits bench sample and Honduras foreign lab sample); `/samples?view=daily&labId=...` calls `/api/samples?view=daily&labId=...` (returns active specimens, omits approved/released, unapproved completed, and Honduras sample).
    - Contract Test 9 validates Stage 5 destination parity for Manager (implicit lab scope) and Scoped Admin (explicit `labId` parameter) to exactly 2 approved samples in `stageLab`, strictly omitting Honduras sample `sampleOtherLabApproved`, while verifying that unscoped Admin destination returns both labs.
    - Contract Test 10 validates the pure route builder preserving `activeLabId` when scoped and returning clean paths when unparameterized.
  - Isolated Headless Chrome CDP Browser Verification:
    - Added second lab fixture (`LAB-HND`, Honduras) with approved sample `SMP-HND-001`.
    - Step 4 verified Scoped System Admin on `/?labId=LAB-GTM` renders continuation links containing `labId=LAB-GTM`:
      - Stage 1: `/manager-queue?lane=intake&labId=LAB-GTM` (`preservesLabIdInStage1Link: true`)
      - Stage 2: `/samples?view=daily&labId=LAB-GTM` (`preservesLabIdInStage2Link: true`)
      - Stage 5: `/samples?status=APPROVED&labId=LAB-GTM` (`preservesLabIdInStage5Link: true`)
      - Task List: `/manager-queue?labId=LAB-GTM` (`preservesLabIdInTaskListLink: true`)
    - Step 5 verified Stage 5 destination navigates to `/samples?status=APPROVED`, displays approved specimens for Guatemala, and strictly omits Honduras foreign sample `SMP-HND-001` (`omitsForeignLabSample: true`).
  - Machine-readable evidence log: `artifacts/evidence-journeys/manager_dashboard_overview_evidence.json` (Status: `VERIFIED`, 5/5 findings passed).

#### 10. Review Feedback Resolution: Lab-Scope Lifecycle Normalization & Scoped Admin Continuation Verification (PR #141 / Comment 5802734888)
- **Gap 1: ManagerQueue Scope Lifecycle & Re-render Normalization**:
  - In `ManagerQueue.jsx`, `fetchQueueData` previously closed over `searchParams` without `selectedLabId` in its `useCallback` dependency array `[activeTab, selectedAnalysis]`. A same-mounted navigation from `?lane=intake&labId=LAB-A` to `?lane=intake&labId=LAB-B` did not recreate the callback or trigger refetching, and the `Refresh queue` button re-invoked the stale closure with the initial lab ID.
  - Normalized `selectedLabId = (searchParams.get('labId') || searchParams.get('labs') || '').trim()` outside the callback.
  - Added `selectedLabId` to `fetchQueueData` dependencies `[activeTab, selectedAnalysis, selectedLabId]`, ensuring React recreates the callback upon scope changes and triggers `useEffect([activeTab, fetchQueueData])`.
  - Added `prevLabIdRef` and stale-data clearing effect (`useEffect(() => { if (prevLabIdRef.current !== selectedLabId) { prevLabIdRef.current = selectedLabId; setData([]); } }, [selectedLabId]);`) to clear stale data immediately on scope switch without race conditions.
  - Guarded asynchronous data commits with `activeRequestIdRef`: tagged each dispatch with `const requestId = ++activeRequestIdRef.current` and aborted commits where `requestId !== activeRequestIdRef.current`, discarding delayed in-flight cross-lab responses.
  - Scoped badge and auto-lane data source `liveEndpoint` to `selectedLabId ? '/api/dashboard/live?labId=' + encodeURIComponent(selectedLabId) : '/api/dashboard/live'`, preserving live badge accuracy and role authorization.
  - Guaranteed `Refresh queue` button (`aria-label="Refresh queue"`) dispatches with the normalized `selectedLabId`.
- **Gap 2: Backend Live Endpoint Scoping for Scoped Admin**:
  - In `server/app.js`, `/api/dashboard/live` was updated to read `qLabId = (req.query.labId || req.query.labs || '').trim()`.
  - Defined `effectiveLabId = (user.role === 'SUPER_ADMIN' && qLabId) ? qLabId : (user.role !== 'SUPER_ADMIN' ? user.labId : null)`.
  - Scoped `sampleWhere`, `workWhere`, `subWhere`, `techs`, and `recentLogs` queries using `effectiveLabId` for `SUPER_ADMIN`, aligning the live adapter with `getDashboardHome`.
- **Gap 3: Contract Test Labeling & Live Scoping Contract**:
  - In `server/tests/contracts/manager_dashboard_overview.test.js`, labeled Test 10 accurately as a pure route-builder logic contract and noted that mounted component lifecycle and browser execution are verified via `work/pr141-scope-mounted-review.cjs` and browser CDP execution.
  - Added Test 11 validating `GET /api/dashboard/live?labId=...` for `SUPER_ADMIN` returns scoped KPIs and logs, strictly isolating completed-today counts to the target laboratory.
  - Both focused suites pass 22/22 (`dashboard_manager_views.test.js` + `manager_dashboard_overview.test.js`).
- **Gap 4: Independent Mounted Component Test**:
  - Ran `work/pr141-scope-mounted-review.cjs` (mocked router/API/context, no production access): verified initial request dispatches `labId: "LAB-A"`, mounted URL change dispatches `labId: "LAB-B"`, and `Refresh queue` button dispatches `labId: "LAB-B"`, with scoped live URLs (`["/api/dashboard/live?labId=LAB-A", "/api/dashboard/live?labId=LAB-B"]`).
- **Gap 5: Scoped Admin Browser Continuation Journey & Same-Mounted Scope Lifecycle**:
  - Added second-lab intake fixture `SMP-HND-REC` in `LAB-HND`.
  - Step 5: Maintained scoped admin identity (`adminToken`), followed actual rendered Stage 5 link (`/samples?status=APPROVED&labId=LAB-GTM`), and verified destination URL, presence of Guatemala approved specimens, and omission of foreign Honduras specimen (`SMP-HND-001`).
  - Step 6: Followed rendered Manager Queue continuation link as Scoped Admin (`/manager-queue?lane=intake&labId=LAB-GTM`), asserting Guatemala intake sample (`SMP-GTM-REC`) present and Honduras sample omitted.
  - Step 6b: Executed same-mounted lab switch to `labId=LAB-HND`, triggered `Refresh queue` button, asserting Honduras intake sample (`SMP-HND-REC`) present and Guatemala sample omitted.
  - Step 6c: Executed browser history back navigation to `LAB-GTM` and forward navigation to `LAB-HND`, asserting specimen isolation across mounted browser navigation.
  - Machine-readable evidence: `artifacts/evidence-journeys/manager_dashboard_overview_evidence.json` (Status: `VERIFIED`, 6/6 findings passed).
  - Recorded screenshots: `manager_queue_scoped_gtm_verified.png`, `manager_queue_scoped_hnd_verified.png`.

#### 11. Review Feedback Resolution: Bounded Delayed-Response Race Protection & Catch/Finally Request Guards (PR #141 / Comment 5803213112)
- **Problem & Reproduction**:
  - Review at head `a746a8b68a461df9eb891561de15a8b275d39737` noted that `useRealtimeData` lacked a request generation/URL guard. If a request for `LAB-A` is dispatched, scope changes to `LAB-B` (which resolves `pendingIntakes=2`), and then the delayed `LAB-A` response arrives with `pendingIntakes=91`, the delayed response overwrote the `LAB-B` badge counts.
  - In `ManagerQueue.jsx`, the `catch` and `finally` blocks lacked the request generation guard present in the success path: a late `LAB-A` failure set the component's `error` state, and late `LAB-A` completion could end the `loading` spinner prematurely for `LAB-B`.
  - Deterministic React reproduction: `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/pr141-live-race-review.cjs`.
- **Bounded Remediation**:
  1. `client/src/hooks/useRealtimeData.js`:
     - Added `activeRequestIdRef` counter and `currentUrlRef` tracking.
     - Implemented render-level scope transition guard: when `prevUrl !== url`, `setPrevUrl(url)`, `setData(null)`, `setDataHash('')`, `setLoading(true)`, `setError(null)`, `setIsStale(false)`, and `activeRequestIdRef.current++` immediately clears and withholds previous-scope counts during transition.
     - Added unmount lifecycle tracking: `mountedRef.current = false` and `activeRequestIdRef.current++` upon unmount, clearing pending intervals and timeouts.
     - In `fetchData`:
       - Success path checks `if (!mountedRef.current || requestId !== activeRequestIdRef.current || requestUrl !== currentUrlRef.current) return;`
       - Diff detection uses `dataHashRef.current` to prevent stale closure dependencies and unnecessary interval resets.
       - Catch block guards error updates: `if (!mountedRef.current || requestId !== activeRequestIdRef.current || requestUrl !== currentUrlRef.current) return;`
       - Finally block guards loading completion: `if (mountedRef.current && requestId === activeRequestIdRef.current && isInitial) setLoading(false);`
       - Live indicator timeout is guarded by active request generation and mounted status.
       - Same-scope `refresh()` preserves current data while fetching and updates on response.
  2. `client/src/pages/ManagerQueue.jsx`:
     - Added `isMountedRef` with unmount cleanup (`isMountedRef.current = false; activeRequestIdRef.current++;`).
     - Success path checks `if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return;`
     - Catch block checks `if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return;` so delayed cross-lab network errors never trigger error alerts on a newer active scope.
     - Finally block checks `if (isMountedRef.current && requestId === activeRequestIdRef.current) setLoading(false);` so delayed cross-lab completions never terminate the active scope's loading spinner.
- **Verification**:
  - Independent reproduction script `work/pr141-live-race-review.cjs` passed cleanly: `afterNewResponse` and `afterLateOldResponse` both report `{ lab: "LAB-B", kpis: { pendingIntakes: 2 } }`.
  - Independent mounted component test `work/pr141-scope-mounted-review.cjs` passed 100%.
  - Dedicated mounted race suite `work/pr141-race-mounted-suite.cjs` passed **10/10 tests** covering:
    - `useRealtimeData`: delayed A success after B success, delayed A error after B success, delayed A success while B is pending, delayed A error while B is pending, and unmount cleanup.
    - `ManagerQueue`: delayed A error while B is in flight, delayed A error after B success, delayed A success after B success, delayed A completion loading guard, and unmount cleanup.
  - Focused HTTP contracts: `server/tests/contracts/manager_dashboard_overview.test.js` (12/12) and `dashboard_manager_views.test.js` (10/10) passed **22/22** in 16.26s.
  - Browser CDP suite `run_manager_dashboard_tasklist_side_by_side.cjs`: passed all 6 steps with verified scope retention, same-mounted switch, queue refresh, and back-forward navigation.
  - Production client build `npm run build`: built cleanly in 15.05s.

#### 12. Review Feedback Resolution: Overtaking Refresh Loading Clearance & Lifecycle Overlap Tests (PR #141 / Comment 5803474139)
- **Problem & Reproduction**:
  - Independent replay at head `dbb23e61824ce7ba5b15a113a82949edb8048993` confirmed that all 10 race tests and late-A response discards passed.
  - A narrow regression was identified: `useRealtimeData`'s `finally` block previously required `isInitial` in addition to `requestId === activeRequestIdRef.current`. If an initial fetch (`isInitial = true`, request 1) was still pending when a manual `refresh()` or polling request (`isInitial = false`, request 2) was dispatched, the newer request settled with `isInitial = false` and did not clear `loading`, while the initial request was discarded as stale (`1 !== 2`). Consequently, `loading` remained `true` indefinitely after all requests settled.
  - Reproduction script: `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/pr141-refresh-loading-review.cjs`.
- **Bounded Remediation**:
  - In `client/src/hooks/useRealtimeData.js`:
    - Updated `finally` block to clear `loading` upon completion of the current active request:
      ```javascript
      finally {
          if (mountedRef.current && requestId === activeRequestIdRef.current) {
              setLoading(false);
          }
      }
      ```
    - Preserved unmount protection (`mountedRef.current`), stale-request discard (`requestId === activeRequestIdRef.current`), and ordinary background refresh non-flashing (since `isInitial = false` does not set `loading = true` during background fetch).
- **Verification**:
  - `work/pr141-refresh-loading-review.cjs`: passed cleanly with `afterRefresh.loading: false` and `afterAllSettled.loading: false`.
  - Added initial-plus-refresh overlap tests (success, failure, ordinary refresh data retention) to `work/pr141-race-mounted-suite.cjs` (**13/13 passed**).
  - Retained the complete mounted lifecycle suite in the repository at `server/scripts/verify_realtimedata_lifecycle.cjs` (**13/13 passed**).
  - Production client build `npm run build`: built cleanly in 8.87s.

#### 13. Issue Status
- **Issue #120**: Remains **OPEN** (`Refs #120`). PR #141 was deployed to production as `v3.5.24` (`e3e1482`); Issue #120 remains open awaiting live visual manager acceptance.

#### 14. PR #142 Production Release Execution & Live Verification (v3.5.25 — `dcc4706`)

Following explicit independent acceptance by Codex at exact head `db09aaa519f6299d1fa05a8e8ec44b87aae6ec5f` ([PR #142 comment 5804765211](https://github.com/yigini/soilfer-lims/pull/142#issuecomment-5804765211)), the release was merged and executed on host `46.19.33.37` (`lims.yigini.net`) under the established write-quiesced zero-downtime release protocol.

##### A. Merge & CI Verification
- **Merged PR**: PR #142 merged into `main` as merge commit `dcc47066a6805f29ceeacd471fd402134654a460`.
- **Target Release Version**: `v3.5.25` (`dcc4706`).
- **Merged CI Run**: GitHub Actions CI Run **35934898057** on `main` passed 100% green (`✓ Test & Build in 3m53s`).

##### B. Release Ledger & Artifact Summary
- **Target Docker Image**: `soilfer-lims:v3.5.25-dcc4706`
  - Image ID: `d1d0271c78d3`
  - Digest: `sha256:d1d0271c78d35c4ad69155cc296edb2bf9a4323b25864847d62c4aefc27a668a`
- **Rollback Baseline Preserved**:
  - Image Tags: `soilfer-lims:rollback-baseline` & `soilfer-lims:rollback-e3e1482`
  - Image ID: `b7dfc7242563`
  - Digest: `sha256:b7dfc72425633b7305726be6f953af6b518eb0fdc5c80e91998c2fd230ed6293`
- **Pre-Release Log Preservation**:
  - Container logs preserved prior to shutdown: `/opt/lims/pre_release_e3e1482_20260924_014845.log`
- **Write Quiescence & Ingress Protocol**:
  - Enforced Apache 503 rewrite rule for mutating HTTP methods (`POST|PUT|PATCH|DELETE`). Verified `POST -> 503`, `GET -> 200`.
  - Active container stopped; background sync writers terminated.
  - WAL truncate checkpointed to zero pages (`PRAGMA wal_checkpoint(TRUNCATE)`: `0|0|0`).
- **Consistent Backup (Zero Writers)**:
  - Backup File: `/opt/lims/backups/dev_release_dcc4706_consistent_20260924_014845.db`
  - Backup SHA256: `4667b402059333920f94ef21941acf84945e517766f23dc7de9499456d6e9387`
  - Integrity Check: `ok`
  - Foreign Key Check: `OK (0 errors)`
  - Exact Row Counts: Samples=36878, Projects=5, WorkItems=90, Results=19, Reports=4.
- **Zero Schema Migrations**: No schema alterations performed.
- **Postflight Verification Suite (Background Jobs Suppressed)**:
  - Container started with `DISABLE_BACKGROUND_JOBS=true`. Verified zero `KOBO_SCHEDULER` logs.
  - Executed `/opt/lims/postflight_check.cjs` with 15 test suites covering all roles and historical regressions.
  - Result: `=== POSTFLIGHT RESULT: ALL CHECKS PASSED ===`.
  - Post-check database counts: Samples=36878, Projects=5 (zero mutation).
- **Service Restoration & Write Resumption**:
  - Production container started in full production mode (started at `2026-09-23T23:49:34.561795465Z`, status: healthy).
  - Clean Apache reverse proxy configuration restored (SHA256: `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20`, configtest OK, httpd reloaded).
  - Write resumption verified: `POST /api/test-mutation` returns 404 from Express (not 503 from Apache proxy).
  - Public health verified: `GET https://lims.yigini.net/api/health` returns `{"status":"ok","uptime":3.25880343}`.
- **Issue Lifecycle Status**:
  - **Issue #128**: Strictly **OPEN** (`Refs #128`) awaiting independent role acceptance on released code.
  - **Issue #123**: Strictly **OPEN** (`Refs #123`) awaiting independent role acceptance on released code.
  - **Issue #120**: Strictly **OPEN** (`Refs #120`) awaiting separate live visual acceptance of manager dashboard/overview.
  
#### 15. Issue #114 Map Centering, Fullscreen, Satellite Layers & Coordinate Safety Verification and Evidence Remediation

##### A. Evidence Review & Bounded Objectives
Following Codex's independent evidence review (`C:/Users/yigin/Documents/Codex/2026-09-21/se/work/issue114-evidence-review-20260924.md` and [Issue #114 comment 5808262204](https://github.com/yigini/soilfer-lims/issues/114#issuecomment-5808262204)), the verification suite (`server/scripts/verify_issue_114_maps.cjs`) was updated to eliminate simulated React fiber callbacks and execute authentic browser journeys on disposable fixtures:
1. **Steps 5 & 6 (Authentic Map Interaction & Draft Persistence)**: Eliminated React fiber `memoizedProps.onChange` / `onLocationSourceChange` / `onPositionalUncertaintyChange` injections. Replaced with authentic CDP mouse click events, Leaflet `map.fire('click')` map event handling, Leaflet marker `dragend` events, and controlled numeric inputs; asserted resulting displayed inputs, marker presence, uncertainty circle (`Circle`), and draft-persisted state (`localStorage['lastIntakeLocation']`).
2. **Step 4 (Actual Viewport Movement Safety)**: Proved viewport pan actually shifted coordinates (`beforeCenter: [-17.8324, 31.0474]` to `afterCenter: [-19.0829, 32.3657]`) before asserting that sample coordinates remain strictly blank (`latInput=""`, `lngInput=""`) with zero marker placement.
3. **Step 8 (Fullscreen Capability Guard & Activation)**: Dispatched authentic browser fullscreen toggle; verified `document.fullscreenEnabled` guard, confirmed enter and exit lifecycle (`entered: true, exited: true`), and verified zero unhandled rejections or exceptions.
4. **Step 9 (Subscribed TileLayer Failure & Resilience)**: Exercised tile failure at the actual `TileLayer` event boundary (not the `Map` instance), asserting:
   - Satellite tile error triggers automatic fallback to Standard (OSM) layer (`satelliteFallbackPassed: true`).
   - Consecutive standard tile errors display the "Map temporarily unavailable" warning banner and "Retry map" button (`bannerPassed: true`).
   - Clicking "Retry map" clears the warning banner and recovers the `TileLayer` (`recoveryPassed: true`).
5. **Step 12 (Neutral Centroid Fallback)**: Asserted that unconfigured facilities resolve to the neutral African centroid (`[0, 25]` / `COUNTRY_CENTERS.DEFAULT`) within floating tolerance, keeping sample coordinates strictly blank.
6. **Step 13 (Controlled Coordinate Precedence)**: Used controlled numeric inputs (`input[placeholder="Latitude"]`, `input[placeholder="Longitude"]`) to verify sample field coordinate precedence over laboratory location.

##### B. Concrete Application Bugs Identified & Remediated
During authentic browser interaction replay, two concrete defects were uncovered in released code:
1. **`WalkInForm.jsx` Stale Closure Race Condition on Map Click**:
   - *Defect*: `WalkInForm.jsx`'s `handleChange` helper used object spread over current render state (`if (section === 'sampling') setSampling({ ...sampling, [key]: value })`). When clicking the map, `LocationMarker` called `onPositionalUncertaintyChange(500)`, `onLocationSourceChange('DESK_PIN')`, and `onConfidenceChange('MEDIUM')` sequentially in the same tick. Because each setter captured the same initial `sampling` closure (where `positionalUncertaintyM` was `null`), the subsequent setters clobbered `positionalUncertaintyM` and `locationSource` back to `null`.
   - *Fix*: Refactored `handleChange` in `client/src/components/reception/WalkInForm.jsx` to use functional state updaters:
     ```javascript
     const handleChange = (section, key, value) => {
         if (section === 'submitter') setSubmitter(prev => ({ ...prev, [key]: value }));
         if (section === 'sampling') setSampling(prev => ({ ...prev, [key]: value }));
     };
     ```
2. **`LocationPicker.jsx` Hardcoded Central America (`'GT'`) Default**:
   - *Defect*: `LocationPicker.jsx` defaulted its prop `countryCode = 'GT'`, and `WalkInForm.jsx` did not accept or forward `countryCode`. Consequently, any unconfigured facility without coordinates fell back to Guatemala (`[15.78, -90.23]`) rather than the neutral African centroid.
   - *Fix*: Changed default in `client/src/components/reception/LocationPicker.jsx` to `countryCode = null`, forwarded `countryCode` through `WalkInForm.jsx`, and passed `countryCode={user?.lab?.country || user?.country}` from `client/src/pages/Reception.jsx`. An unconfigured facility now cleanly resolves to `COUNTRY_CENTERS.DEFAULT = [0, 25]`.

##### C. Execution & Results
The candidate suite was compiled (`npm.cmd run build` in `client/`, 7.59s, entry asset `Reception-CNxGqGES.js`) and verified across both automated contract tests and isolated browser CDP journeys:
- **Contract Tests**:
  - `server/tests/contracts/reception_map_regression.test.js`: 9/9 passed (batched functional updater composition, source/uncertainty preservation, country fallback pass-through from `Reception` -> `WalkInForm` -> `LocationPicker`, neutral centroid fallback `[0, 25]` vs Guatemala `[15.78, -90.23]`).
  - `server/tests/contracts/map_view.test.js`: 16/16 passed (centering precedence, Esri MLA terms, OSM tile usage policy, coordinate bounds validation, InvalidateMapSize wiring).
  - Total contract checks: **25/25 passed**.
- **Browser CDP Verification Suite (`server/scripts/verify_issue_114_maps.cjs`)**:
  - Executed on isolated synthetic SQLite database with active refusal guardrails (zero host mutations to `46.19.33.37`).
  - **16/16 steps passed (100% green, exit code 0)** in 39s.
  - Step 1: Harare Auth Profile Sourced Laboratory Location: `user.labLocation="-17.8292, 31.0522"`, `lab.country="ZW"` [PASS]
  - Step 2: LocationPicker Mount in Walk-In Reception Console: `.leaflet-container` mounted [PASS]
  - Step 3: Harare Lab Centering with Blank Sample Coordinates: Viewport `[-17.8324, 31.0474]`, `latInput=""`, `lngInput=""`, markers=0 [PASS]
  - Step 4: Viewport Movement Does Not Silently Assign Sample Coordinates: Center shifted from `[-17.8324, 31.0474]` to `[-19.0829, 32.3657]`; coords remain blank, markers=0 [PASS]
  - Step 5: Deliberate Marker Placement, Uncertainty & Provenance: Marker count=1, Lat=-19.082884, Lng=32.368473, Uncertainty=±2000m, Source=DESK_PIN, Circles=1, fallbackDispatched=false, Client reuse cache: lat=-19.082884, lng=32.368473, uncertainty=±2000m, site="Mutara Farm" (Intake reuse cache verified; actual draft save/restore pending) [PASS]
  - Step 6: Deliberate Coordinate Adjustment & Leaflet Dragend Handler Simulation: Adjusted via marker dragend handler simulation (real pointer-drag acceptance pending): `[-17.835, 31.055]`, markers=1, intake reuse cache: `[-17.835, 31.055]` [PASS]
  - Step 7: Satellite Layer Switch & Zero-Paid-Key Legal Attribution: Esri World Imagery without paid keys, attribution verified [PASS]
  - Step 8: Fullscreen Capability Guard & Error Handling: Fullscreen enter and exit activated successfully in browser (`entered: true, exited: true`) [PASS]
  - Step 9: Tile Error Fallback & Resilience Handling: Satellite-to-standard fallback: true, Unavailable banner displayed: true, Retry recovery: true [PASS]
  - Step 10: Sourced Laboratory Centering for Zambia (Lusaka Viewport): Lusaka Center `[-15.4219, 28.2788]`, sample coords blank, markers=0 [PASS]
  - Step 11: Sourced Laboratory Centering for Ethiopia (Addis Ababa Viewport): Addis Ababa Center `[9.0262, 38.7378]`, sample coords blank, markers=0 [PASS]
  - Step 12: Unconfigured Laboratory Neutral Centering Fallback: Resolved to `[0.0000, 25.0049]`, matches neutral centroid `[0, 25]`, sample coords blank, markers=0 [PASS]
  - Step 13: Existing Sample Coordinates Override Laboratory in Viewport: Kadoma `[-18.3300, 29.9100]` overrides Harare lab location [PASS]
  - Step 14: Project Mode SampleMap: Pre-Registered Sample With Field Coordinates: Rendered `SampleMap` with marker [PASS]
  - Step 15: Project Mode SampleMap: Truthful Missing-Coordinates Placeholder: Rendered truthful placeholder `"No coordinates recorded in the field"`, zero false markers [PASS]
  - Step 16: Intake vs Field Preview Map-Editor Wiring Separation: Confirmed `SampleMap` read-only field preview vs `LocationPicker` authoring separation [PASS]

##### D. Attribution Notes & Evidence Integrity
1. **Dynamic Provenance**: Replaced released `dcc4706` snapshot in evidence ledger with dynamic candidate commit SHA, candidate branch `fix/issue-114-map-fallback-batch-state`, 3 modified files diffstat, and actual production client build hash (`Reception-CNxGqGES.js`, 554,642 bytes).
2. **Handler Simulation Attribution**: Step 6 accurately labeled as Leaflet dragend handler simulation (`marker.setLatLng` + `marker.fire('dragend')`). Genuine pointer-drag event acceptance is explicitly marked pending.
3. **Step 5 Fallback Logging**: Recorded and asserted `fallbackDispatched: false` (confirming CDP mouse event dispatched the map placement directly without fallback execution).
4. **Intake Reuse Cache Attribution**: Formally designated `localStorage.getItem('lastIntakeLocation')` as a client-side intake reuse cache rather than draft persistence. Genuine draft save/restore acceptance is explicitly marked pending.
5. **Batched State Regression Assertions**: Automated contract suite `server/tests/contracts/reception_map_regression.test.js` asserts preservation of `positionalUncertaintyM`, `locationSource`, `locationConfidence`, and `coordinates` through functional state updaters.

##### E. Artifacts Generated
- `artifacts/evidence-journeys/map_issue114_evidence.json` (7,053 bytes, 16/16 passed, complete candidate provenance and attribution notes).
- `artifacts/evidence-journeys/map_issue114_harare_blank_coords.png` (184,489 bytes).
- `artifacts/evidence-journeys/map_issue114_harare_marker_placed.png` (188,589 bytes).
- `artifacts/evidence-journeys/map_issue114_satellite_attribution.png` (317,231 bytes).
- `artifacts/evidence-journeys/map_issue114_project_sample_preview.png` (261,404 bytes).
- `artifacts/evidence-journeys/map_issue114_no_coords_placeholder.png` (163,827 bytes).

##### F. Status Prior to Release
- **Issue #114**: Candidate packaged on `fix/issue-114-map-fallback-batch-state` (commit `4a712ca`) and submitted for review as PR #143.
- **Production Guardrail**: Maintained untouched during candidate review; deployed under authorized release protocol in Section 16 below.

#### 16. PR #143 Production Release Execution & Live Verification (v3.5.26 — `9b69920`)

Following explicit independent acceptance by Codex at exact head `4a712ca90e4319316f7796238d5c3f3ba1668673` ([PR #143 comment 5809389081](https://github.com/yigini/soilfer-lims/pull/143#issuecomment-5809389081)), the release was merged under branch protections and executed on host `46.19.33.37` (`lims.yigini.net`) under the established write-quiesced, stopped-container release protocol.

##### A. Merge & CI Verification
- **Merged PR**: PR #143 merged into `main` as merge commit `9b69920edd6762eba6271a16643d57bdaa316771`.
- **Target Release Version**: `v3.5.26` (`9b69920`).
- **Merged CI Run**: GitHub Actions CI Run **35967711696** (Job ID: `107529972427`) on `main` passed 100% green (`✓ Test & Build in 4m20s`).

##### B. Release Ledger & Artifact Summary
- **Target Docker Image**: `soilfer-lims:v3.5.26-9b69920`
  - Image ID: `4ec614b81c65`
  - Digest: `sha256:4ec614b81c658b40d565967fcdf7fee8ad96b0efcea1952f6f6c21b4b13bf8c8`
- **Rollback Baseline Preserved**:
  - Image Tags: `soilfer-lims:rollback-baseline` & `soilfer-lims:rollback-dcc4706`
  - Image ID: `d1d0271c78d3`
  - Digest: `sha256:d1d0271c78d35c4ad69155cc296edb2bf9a4323b25864847d62c4aefc27a668a`
- **Pre-Release Log Preservation**:
  - Container logs preserved prior to shutdown: `/opt/lims/pre_release_dcc4706_20260924_091458.log`
- **Write Quiescence & Ingress Protocol**:
  - Enforced Apache 503 rewrite rule for mutating HTTP methods (`POST|PUT|PATCH|DELETE`). Verified `POST -> 503`, `GET -> 200`.
  - Active container stopped; background sync writers terminated.
  - WAL truncate checkpointed to zero pages (`PRAGMA wal_checkpoint(TRUNCATE)`: `0|0|0`).
- **Consistent Backup (Zero Writers)**:
  - Backup File: `/opt/lims/backups/dev_release_9b69920_consistent_20260924_091458.db`
  - Backup SHA256: `4667b402059333920f94ef21941acf84945e517766f23dc7de9499456d6e9387`
  - Integrity Check: `ok`
  - Foreign Key Check: `OK (0 errors)`
  - Exact Row Counts: Samples=36878, Projects=5, WorkItems=90, Results=19, Reports=4.
- **Zero Schema Migrations**: No schema alterations performed.
- **Postflight Verification Suite (Background Jobs Suppressed)**:
  - Container started with `DISABLE_BACKGROUND_JOBS=true`. Verified zero `KOBO_SCHEDULER` logs.
  - Executed `/opt/lims/postflight_check.cjs` with 15 test suites covering all roles and historical regressions.
  - Result: `=== POSTFLIGHT RESULT: ALL CHECKS PASSED ===`.
  - Post-check database counts: Samples=36878, Projects=5 (zero mutation).
- **Service Restoration & Write Resumption**:
  - Production container started in full production mode (started at `2026-09-24T07:15:54.618014667Z`, status: healthy).
  - Clean Apache reverse proxy configuration restored (SHA256: `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20`), configtest OK, httpd reloaded.
  - Write resumption verified: `POST /api/test-mutation` returns 404 from Express (not 503 from Apache proxy).
  - Public health verified: `GET https://lims.yigini.net/api/health` returns `{"status":"ok","uptime":5.071517442}`.
- **Attribution Limits & Issue Lifecycle**:
  - Step 6 marker drag in broad suite was a Leaflet handler simulation; implementer-run pointer-drag workflow acceptance (Codex-reviewed) has now been verified via CDP pointer interaction in Section 17 below.
  - `lastIntakeLocation` in `localStorage` is an intake reuse cache; implementer-run draft save and restore workflow acceptance (Codex-reviewed) has now been verified from SQLite database records in Section 17 below.
  - **Issue #114**: Strictly **OPEN** (`Refs #114`) awaiting Codex live role acceptance on released code.

#### 17. Issue #114 Workflow Acceptance: Pointer Marker Drag & Saved Draft Reopen Persistence Verification
Executed the focused workflow acceptance runner (`server/scripts/verify_issue_114_drag_draft.cjs`) in a disposable reception-role browser environment on released code (`v3.5.26-9b69920` / `9b69920edd6762eba6271a16643d57bdaa316771`), reviewed by Codex at 08:15 UTC:

1. **Pointer Marker Drag Acceptance (Test 1: PASS)**:
   - Initial click on map placed pin at `[-17.832374, 31.050114]`, with uncertainty `±2000m` and source `DESK_PIN`.
   - Bounding rect of `.leaflet-marker-icon` targeted at `(523, 410)`. Dispatched 20 sequential CDP `mouseMoved` / pointer drag steps (+120px East, -90px North) to `(643, 320)`, followed by `mouseReleased`.
   - Captured real browser event stream on DOM: `pointerdown`, `mousedown`, `pointermove` (x20), `mousemove` (x20), `marker_dragstart`, `marker_drag` (x18), `pointerup`, `mouseup`, `marker_dragend`.
   - Asserted coordinates changed to `[-16.88866, 32.367516]` (Δlat=0.943714, Δlng=1.317402).
   - Asserted location source strictly preserved as `'DESK_PIN'` and positional uncertainty preserved as `±2000m`. Zero calls to `setLatLng` or `marker.fire('dragend')`.
   - Visual Evidence: `artifacts/evidence-journeys/map_issue114_pointer_drag_verified.png` (179,276 bytes).

2. **Save Draft Persistence & Reopen Form Restoration Acceptance (Test 2: PASS)**:
   - Populated unrelated walk-in fields: Submitter ("Tinashe Moyo", phone `+263771234567`, org "Chitepo Smallholder Coop"), Crops ("Maize", rotation "Sorghum"), Land Use ("Cropland", management "Compound D 200kg/ha"), Depth ("0–20 cm"), Structured Location (Site "Mutara Block B", Village "Goromonzi", District "Mashonaland East", Landmark "Near borehole 4").
   - Clicked UI "Save Draft" button (`handleSubmit('ACCEPTED', true)` -> `POST /api/reception/intake` with `isDraft: true`).
   - Verified sample draft `W001` persisted in isolated SQLite database with `receptionData` and `fieldMetadata`. Dismissed "Draft Saved" success dialog and returned to reception console home.
   - **Client Reuse Cache Decoupling**: Explicitly executed `localStorage.removeItem('lastIntakeLocation')` prior to lookup; verified `localStorage.getItem('lastIntakeLocation') === null` before draft was resumed.
   - Located draft card `W001` in Incomplete Intakes list, clicked card, confirmed "Resume Draft?" modal with "Yes, Open".
   - Verified WalkInForm rehydrated directly from SQLite draft record:
     - Dragged coordinates restored: `[-16.88866, 32.367516]` matching dragged marker location.
     - Marker on map restored: 1 marker at dragged coordinates with `±2000m` uncertainty circle.
     - Location source restored: `'DESK_PIN'`.
     - Positional uncertainty restored: `±2000m`.
     - Unrelated fields restored from SQLite: Submitter ("Tinashe Moyo", `+263771234567`, "Chitepo Smallholder Coop"), Crops ("Maize", "Sorghum"), Land Use ("Cropland", "Compound D 200kg/ha"), Depth ("0–20 cm"), Site ("Mutara Block B", "Goromonzi", "Mashonaland East", "Near borehole 4").
   - Visual Evidence: `artifacts/evidence-journeys/map_issue114_saved_draft_reopened.png` (158,176 bytes).

- **Evidence Ledger**: `artifacts/evidence-journeys/map_issue114_drag_draft_evidence.json` (2,625 bytes, 2/2 passed).
- **Execution & Attribution Limits**:
  - Run is implementer-executed and Codex-reviewed in a disposable local browser environment (not independent browser replay or production role acceptance).
  - Current application source diff against merge commit `9b69920edd6762eba6271a16643d57bdaa316771` is empty.
  - SQLite database fields persisted upon intake; assertions verify restored UI state via DOM controls and decoupled client cache.
  - Zero application defects identified; zero mutations, queries, or deployments to production host.
- **Issue Lifecycle**: Both focused workflow acceptance requirements verified on released application. Issue #114 remains strictly **OPEN** (`Refs #114`) pending independent Codex review and formal issue closure.

#### 18. PR #144 Production Release Execution & Live Verification (v3.5.27 — `d07ad62`)

Following explicit independent acceptance by Codex at exact head `6dce08af8539704b4e72182611d5848cc9b4ebc1` ([PR #144 comment 5811795323](https://github.com/yigini/soilfer-lims/pull/144#issuecomment-5811795323) and `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/pr144-final-review.md`), the release was merged under branch protections and executed on host `46.19.33.37` (`lims.yigini.net`) under the established write-quiesced, stopped-container release protocol.

##### A. Merge & Exact-Main CI Verification
- **Merged PR**: PR #144 merged into `main` via `gh pr merge 144 --merge` as merge commit `d07ad622724703dde53c22a10ed63e26cf108306`.
- **Target Release Version**: `v3.5.27` (`d07ad62`).
- **Exact-Main CI Run**: GitHub Actions CI Run **35983605694** (Job ID: `107581018647`) on `main` passed 100% green (`✓ Test & Build in 4m14s`).

##### B. Release Ledger & Artifact Summary
- **Target Docker Image**: `soilfer-lims:v3.5.27-d07ad62`
  - Image ID: `a092227c6f4a`
  - Digest: `sha256:a092227c6f4a4ab45558f4d32bf8a12eb713894fdb4f8252fc1327a753136242`
  - Build Archive: `source_d07ad62.tar.gz` (SHA256: `40c30055adf493aed27055e0753aa5b844bf74dff308a5c17a91d14814651b85`)
- **Rollback Baseline Preserved**:
  - Image Tags: `soilfer-lims:rollback-baseline` & `soilfer-lims:rollback-9b69920`
  - Image ID: `4ec614b81c65`
  - Digest: `sha256:4ec614b81c658b40d565967fcdf7fee8ad96b0efcea1952f6f6c21b4b13bf8c8`
- **Pre-Release Log Preservation**:
  - Container logs preserved prior to shutdown: `/opt/lims/pre_release_9b69920_20260924_120036.log`
- **Write Quiescence & Ingress Protocol**:
  - Enforced Apache 503 rewrite rule for mutating HTTP methods (`POST|PUT|PATCH|DELETE`). Verified `POST -> 503`, `GET -> 200`.
  - Active container stopped; background sync writers terminated.
  - WAL truncate checkpointed to zero pages (`PRAGMA wal_checkpoint(TRUNCATE)`: `0|0|0`).
- **Consistent Backup (Zero Writers)**:
  - Backup File: `/opt/lims/backups/dev_release_d07ad62_consistent_20260924_120036.db`
  - Backup SHA256: `4667b402059333920f94ef21941acf84945e517766f23dc7de9499456d6e9387`
  - Integrity Check: `ok`
  - Foreign Key Check: `OK (0 errors)`
  - Exact Row Counts: Samples=36878, Projects=5, WorkItems=90, Results=19, Reports=4.
- **Zero Schema Migrations**: No schema alterations performed.
- **Postflight Verification Suite (Background Jobs Suppressed)**:
  - Container started with `DISABLE_BACKGROUND_JOBS=true`. Verified zero `KOBO_SCHEDULER` logs.
  - Executed `/opt/lims/postflight_check.cjs` with 15 test suites covering all roles and historical regressions.
  - Result: `=== POSTFLIGHT RESULT: ALL CHECKS PASSED ===`.
  - Post-check database counts: Samples=36878, Projects=5 (zero mutation).
- **Service Restoration & Write Resumption**:
  - Production container started in full production mode (Container Started At: `2026-09-24T10:01:28.087956645Z`, status: healthy).
  - Clean Apache reverse proxy configuration restored (SHA256: `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20`), configtest OK, httpd reloaded.
  - Write resumption verified: `POST /api/test-mutation` returns 404 from Express (not 503 from Apache proxy).
  - Public health verified: `GET https://lims.yigini.net/api/health` returns `{"status":"ok","uptime":1.97}`.
- **Attribution Limits & Issue Lifecycle**:
  - **Issue #121**: Strictly **OPEN** (`Refs #121`). Native Save-as-PDF filename, Safari/macOS print pagination, and physical thermal printer hardware remain explicitly unverified in production (zero hardware claims).

#### 19. PR #145 Implementation & Verification Evidence: Routine Compliance & Uncovered Problem Separation (Refs #113, #117)

- **PR Reference**: PR #145 (`https://github.com/yigini/soilfer-lims/pull/145`)
- **Target Branch**: `fix/issue-113-routine-compliance-ui`
- **Application Candidate Head**: `429ee38650ce094861a5c1cec8fcfced8d34343a`
- **Exact-Head CI Run**: CI Run `36106785798` (passed 100% green)
- **Modified Component**: `client/src/components/reception/ComplianceChecklist.jsx`
  - Source File SHA256: `749aeb8565af44edbc6c1f7e3d83ba136520474dc1ea802713a6fd30c92c663a`

##### A. Problem Resolution & UX Logic
1. **Routine Non-Conformance Disabling**: When all 5 checklist criteria evaluate to PASS (or 4 PASS + permitted walk-in CoC N/A), `allCompliant` evaluates to true, automatically disabling and unchecking the routine "Flag as Non-Conformance" control.
2. **Prominent Status Feedback**: Renders an explicit "ROUTINE COMPLIANT OUTCOME" badge on compliant checklists.
3. **Independent Problem Separation**: A separate "Other problem not covered by checklist" checkbox (`data-testid="other-problem-checkbox"`) is exposed with a single unified description textarea (`data-testid="unified-nc-description"`).
4. **Correction Lifecycle Integrity**: Marking items PASS or clicking "Mark all OK" / "Reset all" preserves any independently recorded problem (`otherProblem: true` and `reason`), while routine-only failures clean up correctly.

##### B. Automated Verification Ledger
- **Node Component Contracts**: 21/21 PASS (`server/tests/contracts/reception_compliance_component.test.js`)
  - Evaluates all-pass, permitted N/A, single fail, multiple fails, unanswered items, quick actions, legacy draft retention, and correction lifecycle without database dependencies.
- **Mounted React Transitions**: 7/7 PASS (`work/pr145-mounted-review-429ee38.cjs`)
  - Verified by Codex against immutable candidate: legacy draft preservation, subsequent FAIL/correction, routine-only UI/state agreement, one explicitly combined description, Reset all, Mark all OK, and serialized-state remount.
- **Client Production Build**: `npm run build` (Vite v5.4.21, clean 0 errors).
  - Measured served assets on disk (`client/dist/assets/`):
    - `Reception-DcbkS6KK.js`: SHA256 `7f63addebf6a98165a91dc1b0c01db6633633dffd78cefb2eeb9a12abf1b8ef3`
    - `index-DTEVE5HW.js`: SHA256 `5e3e9c94817b8cc093211a15a1999b8ac58e59d0bad55f07013522651a427761`
    - `index-DvT2i1qH.css`: SHA256 `2932e810bde9bc01eb66f53c6ed74ff95437eaae841954d4444334a2ee76d315`
- **Isolated Browser Final Controls Journey**: 4/4 PASS (`server/scripts/verify_isolated_controls.cjs` at `2026-09-25T08:01:17.505Z`)
  - Report: `artifacts/evidence-journeys/reception_issue117_113_final_controls.json`
  - Step 1: Reception Console & Walk-in Form Mounted (PASS)
  - Step 2: All-pass/permitted NA disables routine NC (PASS)
  - Step 3: Single combined description rendered for other problem (PASS)
  - Step 4: Independent problem survives item correction (PASS)
- **Evidence Sidecar Ledger**: `artifacts/evidence-journeys/reception_issue117_113_final_controls_sidecar.json`
  - Explicitly records metadata corrections (releaseVersion v3.5.25 is inherited constant; receptionFilesDiffVsReleased measures working-tree status relative to HEAD; builtAt is filesystem mtime).
  - Details interaction model (scripted DOM clicks and native React 18 `_valueTracker` property setters via `window.setCheck`).
  - Records attribution limits: no full browser reload or real keyboard/pointer hardware interaction claimed; diagnostic props extraction reflects initial empty component state; form correction and serialized remount lifecycle are authoritative established by the 21 contract tests and 7 mounted transitions.
- **Preserved Old-Build Root Cause Evidence**: `artifacts/evidence-journeys/reception_issue117_113_final_controls_old_build.json`
  - Report from 07:59:35Z preserving 2/4 pass when served bundle was stale `Reception-vMhN-pX1.js` (SHA256: `9576e28a56e552ca3f391c71af0fff7c4b82e71466243a299c11cc2c440d6192`). Confirms stale-build root cause without treating it as an app regression.
- **Security & Authorization Integrity**: Zero changes to server policy, permission gates, or manager exception enforcement (`403 COMPLIANCE_FAILURE_EXCEPTION_REQUIRED`).

##### C. Independent Acceptance & Status
- **Independent Codex Review**: Accepted ([PR #145 comment 5829161361](https://github.com/yigini/soilfer-lims/pull/145#issuecomment-5829161361), [PR #145 comment 5829340422](https://github.com/yigini/soilfer-lims/pull/145#issuecomment-5829340422), and `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/pr145-final-review.md`).
- **Issue Lifecycle**: Issue #113 acceptance criteria fully satisfied; candidate verified and approved for safe release.

##### D. PR #145 Production Release Execution & Live Verification (v3.5.28 — `2ef64cd`)

Following explicit independent acceptance by Codex at exact head `30daeee1d07cd20354fdb5338ec569589177cc85` ([PR #145 comment 5829340422](https://github.com/yigini/soilfer-lims/pull/145#issuecomment-5829340422) and `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/pr145-final-review.md`), the release was merged under branch protections and executed on host `46.19.33.37` (`lims.yigini.net`) under the established write-quiesced, stopped-container release protocol.

###### 1. Merge & Exact-Main CI Verification
- **Merged PR**: PR #145 merged into `main` via `gh pr merge 145 --merge` as merge commit `2ef64cd01d8e91a0764156ebfbc1add5442e5c15`.
- **Target Release Version**: `v3.5.28` (`2ef64cd`).
- **Exact-Main CI Run**: GitHub Actions CI Run **36113116688** (Job ID: `108000875908`) on `main` passed 100% green (`✓ Test & Build in 4m00s`).

###### 2. Release Ledger & Artifact Summary
- **Target Docker Image**: `soilfer-lims:v3.5.28-2ef64cd`
  - Image ID: `cf3d71a49ef3`
  - Digest: `sha256:cf3d71a49ef38be3834db6d9abc105a3447af10c485e274a1f52eb8ec54a489b`
  - Build Archive: `source_2ef64cd.tar.gz` (SHA256: `0aeb446fbc5b5ad019e1b08fb5a764ad4645780c618152d11ef39d3fd50a32d3`)
- **Rollback Baseline Preserved**:
  - Image Tags: `soilfer-lims:rollback-baseline` & `soilfer-lims:rollback-d07ad62`
  - Image ID: `a092227c6f4a`
  - Digest: `sha256:a092227c6f4a4ab45558f4d32bf8a12eb713894fdb4f8252fc1327a753136242`
- **Pre-Release Log Preservation**:
  - Container logs preserved prior to shutdown: `/opt/lims/pre_release_d07ad62_20260925_103354.log`
- **Write Quiescence & Ingress Protocol**:
  - Enforced Apache 503 rewrite rule for mutating HTTP methods (`POST|PUT|PATCH|DELETE`). Verified `POST -> 503`, `GET -> 200`.
  - Active container stopped; background sync writers terminated.
  - WAL truncate checkpointed to zero pages (`PRAGMA wal_checkpoint(TRUNCATE)`: `0|0|0`).
- **Consistent Backup (Zero Writers)**:
  - Backup File: `/opt/lims/backups/dev_release_2ef64cd_consistent_20260925_103354.db`
  - Backup SHA256: `d9f6e333419650dfcd3f4cff14d46e94d2e2505e43f21336d3e79318870ba81c`
  - Integrity Check: `ok`
  - Foreign Key Check: `OK (0 errors)`
  - Exact Row Counts: Samples=36878, Projects=5, WorkItems=90, Results=19, Reports=4.
- **Zero Schema Migrations**: No schema alterations performed.
- **Postflight Verification Suite (Background Jobs Suppressed)**:
  - Container started with `DISABLE_BACKGROUND_JOBS=true`. Verified zero `KOBO_SCHEDULER` logs.
  - Executed `/opt/lims/postflight_check.cjs` with 15 test suites covering all roles and historical regressions.
  - Result: `=== POSTFLIGHT RESULT: ALL CHECKS PASSED ===`.
  - Post-check database counts: Samples=36878, Projects=5 (zero mutation).
- **Service Restoration & Write Resumption**:
  - Production container started in full production mode (Container Started At: `2026-09-25T08:34:48.736806007Z`, status: healthy).
  - Clean Apache reverse proxy configuration restored (SHA256: `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20`), configtest OK, httpd reloaded.
  - Write resumption verified: `POST /api/test-mutation` returns 404 from Express (not 503 from Apache proxy).
  - Public health verified: `GET https://lims.yigini.net/api/health` returns `{"status":"ok","uptime":3.55}`.
- **Attribution Limits & Issue Lifecycle**:
  - **Issue #113**: Released live to production. Codex independent verification and closure pending (`Refs #113`).

### Phase 2: Issues #128 & #123 Final Browser Interaction Journey & Provenance Verification (2026-09-25)

Following Codex guidance in `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/workbench-final-interactions-20260925.md`, executed a dedicated isolated browser interaction journey (`server/scripts/run_workbench_interactions_journey.cjs`) on disposable SQLite fixtures and measured current released client assets to verify genuine pointer and keyboard automation:

#### 1. Measured Provenance & Runtime Environment
- **Measured Source Commit**: `7808532f864f33b3f5488a650433ac21bc13beba` (Documentation head; released application code identical to `2ef64cd`).
- **Target Release Version**: `v3.5.28` (`2ef64cd`).
- **Browser & Platform**: Google Chrome (Headless, CDP) on Windows (`win32`).
- **Measured Served Client Assets**:
  - `index-DTEVE5HW.js` (SHA256: `5e3e9c94817b8cc093211a15a1999b8ac58e59d0bad55f07013522651a427761`)
  - `TechWorkbench-BHLISD0_.js` (SHA256: `bdf61f757ca937bc149d2592ab9b04044f4ff333c1b100a9ce45f9cfd8e70222`)
  - `index-DvT2i1qH.css` (SHA256: `2932e810bde9bc01eb66f53c6ed74ff95437eaae841954d4444334a2ee76d315`)
- **Input Mechanisms & Attribution**:
  - Pointer automation: CDP `Input.dispatchMouseEvent` (`mousePressed` and `mouseReleased` at bounding rect center). No synthetic DOM click dispatch or direct URL bypass.
  - Keyboard automation: CDP `Input.dispatchKeyEvent` (`keyDown` and `keyUp` per character, native Backspace key events). No synthetic DOM `.value` setters, no React `onChange` synthetic event injection.
  - Database: Disposable synthetic SQLite database in unique runner directory (`server/.tmp_journey_runner_*`) via `journey_db_isolation.cjs` with refusal guards. Zero production credentials, accounts, or writes.

#### 2. Journey 1 (Issue #128): Sample Workspace Action-Click, Navigation, Context, Reload, and History
- **Principal**: `tech_gtm_1` (`usr-tech-gtm-1`, lab `GTM-LAB1`).
- **Initial Location**: Sample Workspace at `/samples/GHA0816-1-1C-S` (`Work & results` tab).
- **Step 1.1 — Rendered Action**: Verified rendered action button inside Analysis table row (`WI-1789634536044-167`, Total Nitrogen): `button[title="Open task in Technician Workbench"]` (`Open in Workbench →`). Screenshot: `workbench_issue128_sample_workspace_action_rendered.png`.
- **Step 1.2 — Action Pointer Click**: Dispatched CDP mouse click at button coordinates. Client router navigated to `/workbench?workItemId=WI-1789634536044-167&sampleId=GHA0816-1-1C-S`. Verified Worksheet tab active, target row highlighted with `sf-selected`, and contextual inspector displaying `GHA0816-1-1C-S`. Screenshot: `workbench_issue128_action_click_target_resolved.png`.
- **Step 1.3 — Reload Survival**: Executed CDP `Page.reload`. Verified complete survival of active worksheet tab, selected work item row, and sample inspector. Screenshot: `workbench_issue128_reload_survived.png`.
- **Step 1.4 — History Back**: Executed `window.history.back()`. Verified return to Sample Workspace (`/samples/GHA0816-1-1C-S?tab=work`) with Analysis table intact. Screenshot: `workbench_issue128_history_back_sample_workspace.png`.
- **Step 1.5 — History Forward**: Executed `window.history.forward()`. Verified restoration of Workbench target selection and contextual inspector. Screenshot: `workbench_issue128_history_forward_workbench_restored.png`.
- **Prior HTTP Contracts**: Reused existing verified contracts (contradictory 400, cross-lab 403, missing 404) without redundant matrix rerun.

#### 3. Journey 2 (Issue #123): Genuine Keyboard Queue Search, Beyond-Window Target, Empty State, Clear, and Lab Scope
- **Principal**: `tech_gtm_2` (`usr-tech-gtm-2`, lab `GTM-LAB1`).
- **Initial Location**: Workbench Queue (`/workbench`).
- **Step 2.1 — Default Queue & Beyond-Window Target**: Initial queue rendered 15 authorized items. Target item 15 (`FIELD-PLOT-015`, `S015`) measured at `rect.top = 1396px`, strictly outside initial visible viewport (`viewportHeight = 860px`). Cross-lab items absent (`HND-999`, `FIELD-HND-999`). Screenshot: `workbench_issue123_interaction_default_queue.png`.
- **Step 2.2 — Focus Input**: Clicked search input via CDP mouse click (`mousePressed` + `mouseReleased`).
- **Step 2.3 — Specimen Code Search**: Typed `"S003"` via `Input.dispatchKeyEvent`. Visible input value: `"S003"`. Table filtered to matching row (`totalVisibleRows: 1`, `matchCount: 1`, `allRowsMatch: true`). Screenshot: `workbench_issue123_interaction_search_sample.png`.
- **Step 2.4 — Clear Search**: Backspaced 4 times via `Input.dispatchKeyEvent`. Visible input value: `""`. Full queue restored (`rowsCount: 15`).
- **Step 2.5 — Field ID Search**: Typed `"FIELD-PLOT-002"` via `Input.dispatchKeyEvent`. Visible input value: `"FIELD-PLOT-002"`. Table filtered to matching row (`totalVisibleRows: 1`). Screenshot: `workbench_issue123_interaction_search_field_id.png`.
- **Step 2.6 — Methodology Search**: Backspaced to clear; typed `"ISO 10390"`. Visible input value: `"ISO 10390"`. Table filtered to matching method (`Soil pH in Water`). Screenshot: `workbench_issue123_interaction_search_methodology.png`.
- **Step 2.7 — Beyond-Initial-Window Target Search**: Backspaced to clear; typed `"FIELD-PLOT-015"`. Visible input value: `"FIELD-PLOT-015"`. Table filtered to target item 15 (`singleMatch: true`), bringing it from `rect.top = 1396px` to `rect.top = 374px`, now inside the visible viewport (`viewportHeight = 860px`). Screenshot: `workbench_issue123_interaction_search_beyond_initial_window.png`.
- **Step 2.8 — Truthful Empty State**: Backspaced to clear; typed `"NONEXISTENT_XYZ_999"`. Visible input value: `"NONEXISTENT_XYZ_999"`. Truthful empty state rendered: `No work items match "NONEXISTENT_XYZ_999".` Screenshot: `workbench_issue123_interaction_search_empty.png`.
- **Step 2.9 — Final Clear & Cross-Lab Exclusion**: Backspaced to clear. Full queue restored (`rowsCount: 15`, `hasForeignLabItem: false`). Screenshot: `workbench_issue123_interaction_search_cleared.png`.

#### 4. Artifact Ledger & Disposition
- **Evidence Ledger**: `artifacts/evidence-journeys/workbench_interactions_evidence.json` (mirrored to conversation artifacts directory).
- **Preserved Old Reports**: Prior evidence ledger `artifacts/evidence-journeys/workbench_verification_evidence.json` and existing screenshots preserved without alteration.
- **Application Defect Evaluation**: Zero defects reproduced. Both action-click deep-link navigation and keyboard search filtering behave correctly on released source/build. No code changes or new PR required; evidence-only deliverable.


### Phase 6: Priority Issue #146 Ghana Expected Arrivals & Bounded Kobo Ingestion Release Execution (v3.5.29 — `e5d5ebd`)

Following technical acceptance by Codex at exact head `c01527afa7aedc8f6d90703ce48d75756218f118` ([PR #147 comment 5845560003](https://github.com/yigini/soilfer-lims/pull/147#issuecomment-5845560003) and `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/pr147-final-review-c01527a.md`), PR #147 was squash merged into `main` with head-commit protection, verified through exact-main CI, and executed on host `46.19.33.37` (`lims.yigini.net`) under the established write-quiesced, stopped-container release and bounded apply protocol.

#### 1. Squash Merge & Exact-Main CI Verification
- **Merged PR**: PR #147 squash merged into `main` via `gh pr merge 147 --squash --match-head-commit c01527afa7aedc8f6d90703ce48d75756218f118`.
- **Merge Commit on `main`**: `e5d5ebdf9fa54a29fcbd4424d566eda8036920bd` (Single parent `90b0abd8fafbbd95adb2ae382b34a169fce3ed99`; clean tree strictly identical to accepted `c01527a`).
- **Target Release Version**: `v3.5.29` (`e5d5ebd`).
- **PR Branch Preservation**: PR branch `fix/ghana-expected-arrivals-146` strictly preserved intact; no force-push, no history rewrite, no branch deletion (awaiting separate repository owner authorization for privacy remediation).
- **Exact-Main CI Run**: GitHub Actions CI Run **36236624897** (Job ID: `108389461816`) on `main` passed 100% green in 7m5s (`✓ Test & Build`).

#### 2. Release Ledger & Container Artifacts
- **Target Docker Image**: `soilfer-lims:v3.5.29-e5d5ebd`
  - Image ID: `fe6b64efc4f0`
  - Digest: `sha256:fe6b64efc4f046635a830f5568773fefa52e95e975444c1f61dff14800679c1b`
  - Build Context Archive: `source_e5d5ebd.tar.gz` (SHA256: `1c4b8ad7ed8204da7d622fb319fcb1a1bb2a5252c5ddf239f6d0cfcfee1d3f40`)
- **Rollback Baseline Preserved**:
  - Image Tags: `soilfer-lims:rollback-baseline` & `soilfer-lims:rollback-2ef64cd`
  - Image ID: `cf3d71a49ef3`
  - Digest: `sha256:cf3d71a49ef38be3834db6d9abc105a3447af10c485e274a1f52eb8ec54a489b`
- **Pre-Release Log Preservation**: Container logs preserved prior to shutdown: `/opt/lims/pre_release_2ef64cd_20260926_125533.log`.
- **Application Container Runtime Binding**: Container `soilfer-lims` deployed with immutable image `soilfer-lims:v3.5.29-e5d5ebd` (`sha256:fe6b64efc4f0...`), mounted to volumes `lims_lims-data:/app/server/prisma` and `lims_lims-assets:/app/server/uploads`.

#### 3. Write Quiescence & Pre-Operation Consistent Backup
- **Ingress Write Quiescence**: Enforced Apache 503 rewrite rule (`httpd-lims.conf.quiesce`). Mutating HTTP requests blocked with 503; read-only requests permitted.
- **Application Writer Exclusion**: Active application container `soilfer-lims` stopped (`docker stop -t 10`). Confirmed zero running writers across application and runner containers via `assert_no_writers_running`.
- **WAL Checkpoint & Consistent Backup**:
  - WAL checkpoint executed (`PRAGMA wal_checkpoint(TRUNCATE)`: `0|0|0`).
  - Consistent Backup File: `/opt/lims/backups/dev_pre_issue146_20260926_125855.db`
  - Backup SHA-256: `940310341dd20a98c679f06853734c3d1f055d765aed35be6b3ccff704ad84a3`
  - Baseline Integrity: `ok`
  - Baseline Foreign Key Check: `OK (0 errors)`
  - Baseline Sample Count: 36,878 specimens (36,878 non-Ghana, 0 Ghana in `SOILFER-US`).

#### 4. Guarded Canonical Ghana Apply Execution
- **Execution Script**: `/opt/lims/execute_release_pr147.sh` invoking canonical `/app/server/scripts/execute_ghana_apply_146.cjs`.
- **Verified Private Fixtures**:
  - Snapshot: `/opt/lims/private_kobo/ghana_kobo_snapshot_40747.json` (SHA-256: `33db90cdcab60ccf4801a7754d8444893c0b6ee25f269a65366d6fed5046292f`)
  - Manifest: `/opt/lims/private_kobo/ghana_kobo_manifest_40747.json` (SHA-256: `e43d490366eda0e325b1f1639c743b57105a6256e0f406df6f7e1d87514adaed`)
  - High-Water Cursor: `40747` (459 submissions).
- **Dry-Run Validation**:
  - Operation ID: `GHANA_APPLY_2026-09-26T105916457Z_28cfdcaf`
  - Verified 868 occurrences, 864 distinct candidate IDs, 2 intra-submission duplicates, 2 cross-submission duplicate events.
  - Candidate collision projection: 0 collisions against 36,878 existing specimens.
  - CAS simulation: OK, 0 rows modified in DB.
- **Guarded Apply Execution**:
  - Operation ID: `GHANA_APPLY_2026-09-26T105917970Z_c1e8c9c1`
  - Atomic CAS succeeded: KoboConfig `25731264-f02a-4172-8ef1-75512b7607a5` activated (`isActive=1`, `projectCode='SOILFER-US'`, `lastSubmissionId='40747'`).
  - Single-writer bounded ingestion result: `{"newSamples":864,"skipped":4,"lastSubmissionId":"40747"}`.
  - Admitted specimens: exactly 864 specimens created with status `EXPECTED` and `receptionDate = null`. Zero physical receptions recorded.
  - Durable Provenance Holds: exactly 4 specimens placed on `AMBIGUOUS_PROVENANCE_HOLD`:
    - `12282486-d172-438d-8acd-c293de93816c` (`GHA0288-3-1C-T`): `INTRA_SUBMISSION_DUPLICATE_DEPTH` (Field surveyor assigned identical barcode to D1 and D2)
    - `e98b5911-3392-4add-a0ad-cc31eaaa4c34` (`GHA0417-2-1G-T`): `INTRA_SUBMISSION_DUPLICATE_DEPTH` (Field surveyor assigned identical barcode to D1 and D2)
    - `a65a2d2f-0a79-417f-919a-f9a616e7a240` (`GHA0922-2-1G-S`): `CONFLICTING_FIELD_SUBMISSIONS` (Multiple field submissions claimed this barcode)
    - `9ecae931-c24c-469f-832c-340191ff12dc` (`GHA0922-2-1G-T`): `CONFLICTING_FIELD_SUBMISSIONS` (Multiple field submissions claimed this barcode)
  - Clean Unambiguous Specimens: exactly 860.
  - Transactional Audit Entries Logged:
    - `ENABLE_GHANA_KOBO_MAPPING`: 1
    - `CREATE_KOBO_SYNC`: 864
    - `KOBO_INTRA_SUBMISSION_DUPLICATE`: 2
    - `KOBO_CONFLICTING_PROVENANCE`: 2

#### 5. Post-Apply Verification, Health & Ingress Restoration
- **Post-Apply WAL Checkpoint & Integrity**:
  - `PRAGMA wal_checkpoint(TRUNCATE)`: `0|0|0`
  - Integrity Check: `ok`
  - Foreign Key Check: `OK (0 errors)`
  - Total Sample Count: `37,742` (Baseline 36,878 + Admitted 864 = 37,742). Baseline samples intact.
- **Other Country Configurations Preserved**:
  - Kobo configurations for GTM-LAB1, HND-LAB1, KEN-LAB1, MOZ-LAB1, TUN-LAB1, TUR, and ZMB-LAB1 remain completely unchanged.
- **Application Container Health**:
  - Container `soilfer-lims` restarted with image `soilfer-lims:v3.5.29-e5d5ebd`.
  - Container healthy at attempt 4 (`GET http://localhost:3000/api/health` -> HTTP 200 `{"status":"ok"}`).
- **Ingress Restoration & Write Resumption**:
  - Apache reverse proxy configuration restored from clean `.live` file (SHA256: `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20`), verified via `systemctl reload httpd`.
  - Write resumption verified: `POST /api/test-mutation` returns HTTP 404 from Express (not 503 from Apache proxy).
  - Public health verified: `GET https://lims.yigini.net/api/health` returns `{"status":"ok"}`.
- **Execution Log**: Saved on host at `/opt/lims/logs/apply_issue146_20260926_125855.log`.
- **Status & Handoff**: Release complete and live. Codex independent read-only post-verification pending prior to closing Issue #146 (`Refs #146`).



