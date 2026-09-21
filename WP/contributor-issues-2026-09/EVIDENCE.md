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
| **#118** | 1 | QC batch inspection link disconnect, unhandled QC disposition, failed QC bypassing release gates | Reproduced & Verified | Current | `qc_disposition_release_gate.test.js` (10/10), client production build (`vite build` clean in 15.78s) | Pending | Canonical batch inspection returns actual control values, affected work items with canonical sample ID, original ID, lab ID, run profile, and notes. Unresolved failed QC strictly blocks sample approval (409) and report generation (409). Permitted disposition schema enforced; manager disposition override is atomic inside transaction, updates result flags while preserving non-QC invalidity flags (`MANUAL_INVALID`) and immutable released/superseded records; REANALYZE_BATCH updates work items to REANALYSIS_REQUIRED; audit.qc queue counts only unresolved batches. | Historical released results remain immutable. | Verified locally; ready for release verification |
| **#119** | 1 | Confusion between canonical, lab, and original IDs; 26-task fixture truncation; derived fractions vs ordered tasks | Reproduced & Verified | Current | `sample_assignment_identity.test.js` (8/8), client production build (`vite build` clean in 15.78s) | Pending | Disambiguated canonical UUID (`sampleId`), sample lab ID (`labId`), and field ID (`originalId`); honest task pagination (26-task fixture exposes all 26 tasks with honest pagination metadata); bidirectional texture equivalence (`TEXTURE` satisfied by 3 fractions `SAND, SILT, CLAY`, and composite `TEXTURE` satisfies fractions); independent gate evaluation respecting SKIPPED/WAIVED; sampleWorkspace extracts linked QC batches to gate final approval; unassignedCount calculated across all work items; ManagerQueue routes assign to `?tab=work` and review to `?tab=review`. | Manual assignment requires manager authority. | Verified locally; ready for release verification |
| **#121** | 2 | Label print dialog issues, printable content isolation, title/filename handling | Reproduced & Verified | Current | `label_print.test.js` (5/5), client production build (`vite build` clean in 15.78s) | Pending | Dual standard (101x54mm) and compact (50x25mm) thermal label formats; 100% offline QR code generation via `qrcode`; portal to `#label-print-portal` at `document.body` with print CSS isolation hiding all standard web UI; dynamic `document.title = Label-${sanitizedSampleId}` with `afterprint` restoration; autoPrint trigger support; intake rejection gate (`canPrintLabel: false`). | Browser-controlled print filename is best effort. | Verified locally; ready for release verification |
| **#122** | 2 | LabMethods defaults failing or silently falling back across labs | Open | Pending | `tests/contracts/lab_method_defaults.test.js` (Planned) | Pending | Scoped loading/saving for target lab; honest empty states; no cross-lab fallback. | Requires lab manager/admin scope. | Open |
| **#128** | 2 | Workbench deep links broken for specific workItemId and sampleId | Open | Pending | `tests/contracts/workbench_deep_link.test.js` (Planned) | Pending | Resolves exact work item and sample; retains queue context; handles unresolved country records without guessing. | Forbidden items return 403. | Open |
| **#123** | 2 | Workbench search input and pagination issues | Open | Pending | `tests/contracts/workbench_search.test.js` (Planned) | Pending | Multi-page search across field ID, lab ID, canonical ID, method display names. | Authoritative server pagination. | Open |
| **#124** | 2 | Result reports search failing across client, project, sample queries | Open | Pending | `tests/contracts/report_search.test.js` (Planned) | Pending | Aligned queries with country/programme rollup support; discoverable superseded versions; no cross-lab leak. | Scoped to authorized projects/labs. | Open |
| **#125** | 3 | Inventory aggregation anomalies, expired lots vs usable stock confusion | Open | Pending | `tests/contracts/inventory_aggregation.test.js` (Planned) | Pending | Distinct usable stock, expired lots, reorder thresholds; missing values treated distinctly from zero. | Display/aggregation fix; no silent stock adjustments. | Open |
| **#117** | 3 | Failed reception criterion not persisting or reflecting in UI | Open | Pending | `tests/contracts/reception_nonconformance.test.js` (Planned) | Pending | Authoritative saved state reflects OK/N/A/Fail; non-conformance linked; cancellation handled cleanly. | Non-conformance requires explanation. | Open |
| **#113** | 3 | Reception compliance checklist and redundant/unauthorized dispositions | Open | Pending | `tests/contracts/reception_compliance.test.js` (Planned) | Pending | Clear checklist-derived outcomes; routine passing avoids redundant gate; exceptions require authorized actor. | Staff cannot self-authorize exceptions. | Open |
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
- **Client Implementation**:
  - `client/src/components/common/LabelPrintDialog.jsx`:
    - Portal rendering to `#label-print-portal` at `document.body` outside modal tree with `@media print` CSS isolation hiding all standard web UI.
    - 100% offline QR code generation via `qrcode` (no third-party network dependency).
    - Dual format toggle: Standard (101×54mm / 4"×2") and Vial/Tube Compact (50×25mm).
    - Batch checklist with "Accepted Only" filter and individual checkboxes.
    - Dynamic print title management (`Label-${sanitizedSampleId}` or `Labels-Batch-${count}`) restored on `afterprint`.
    - Auto-print trigger support.
