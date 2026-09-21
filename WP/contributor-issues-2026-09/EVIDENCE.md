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
| **WP-2 Country/Kobo v2** | 0 | Country project separation, Kobo explicit mapping, 0-to-0 preservation risk, client exception spoofing, operation binding | Reproduced & Validated | `e2fff7e`, `5f66781`, pending | `project_policy_v2.test.js` (21/21), `kobo_explicit_mapping.test.js` (25/25), `soilfer_country_migration.test.js` (3/3), `programme_readers_and_rollups.test.js` (9/9) | Pending | Populated Result/QC/Report fixtures verified (35,197 samples, 4 results, 3 QC batches, 3 reports); report checksums intact; HTTP exception verification enforced with strict operation binding (sample, project, lab, non-empty reason). | Production migration hold remains active. | Pending Phase 0 closure |
| **#118** | 1 | QC batch inspection link disconnect, unhandled QC disposition, failed QC bypassing release gates | Reproduced & Verified | Pending commit | `qc_disposition_release_gate.test.js` (6/6), client production build (`vite build` clean in 8.93s) | Pending | Canonical batch inspection returns actual control values, affected work items with canonical sample ID, original ID, lab ID, run profile, and notes. Unresolved failed QC strictly blocks sample approval (409) and report generation (409). Manager disposition override (PROCEED_WITH_WARNING) is atomic, audited in transaction, idempotent on retry, and clears resolved batch from pending exception counts while preserving history. | Historical released results remain immutable. | Verified locally; ready for Phase 1 commit |
| **#119** | 1 | Confusion between canonical, lab, and original IDs; 26-task fixture truncation; derived fractions vs ordered tasks | Reproduced | Pending | `sample_assignment_identity.test.js` | Pending | Stable canonical keys; honest task pagination; explicit order vs derived work; server-side readiness enforcement. | Manual assignment requires manager authority. | Pending Phase 1 |
| **#121** | 2 | Label print dialog issues, printable content isolation, title/filename handling | Open | Pending | `tests/contracts/label_print.test.js` | Pending | Standard and vial format isolation, readable barcodes, correct dimensions. | Browser-controlled print filename is best effort. | Open |
| **#122** | 2 | LabMethods defaults failing or silently falling back across labs | Open | Pending | `tests/contracts/lab_method_defaults.test.js` | Pending | Scoped loading/saving for target lab; honest empty states; no cross-lab fallback. | Requires lab manager/admin scope. | Open |
| **#128** | 2 | Workbench deep links broken for specific workItemId and sampleId | Open | Pending | `tests/contracts/workbench_deep_link.test.js` | Pending | Resolves exact work item and sample; retains queue context; handles unresolved country records without guessing. | Forbidden items return 403. | Open |
| **#123** | 2 | Workbench search input and pagination issues | Open | Pending | `tests/contracts/workbench_search.test.js` | Pending | Multi-page search across field ID, lab ID, canonical ID, method display names. | Authoritative server pagination. | Open |
| **#124** | 2 | Result reports search failing across client, project, sample queries | Open | Pending | `tests/contracts/report_search.test.js` | Pending | Aligned queries with country/programme rollup support; discoverable superseded versions; no cross-lab leak. | Scoped to authorized projects/labs. | Open |
| **#125** | 3 | Inventory aggregation anomalies, expired lots vs usable stock confusion | Open | Pending | `tests/contracts/inventory_aggregation.test.js` | Pending | Distinct usable stock, expired lots, reorder thresholds; missing values treated distinctly from zero. | Display/aggregation fix; no silent stock adjustments. | Open |
| **#117** | 3 | Failed reception criterion not persisting or reflecting in UI | Open | Pending | `tests/contracts/reception_nonconformance.test.js` | Pending | Authoritative saved state reflects OK/N/A/Fail; non-conformance linked; cancellation handled cleanly. | Non-conformance requires explanation. | Open |
| **#113** | 3 | Reception compliance checklist and redundant/unauthorized dispositions | Open | Pending | `tests/contracts/reception_compliance.test.js` | Pending | Clear checklist-derived outcomes; routine passing avoids redundant gate; exceptions require authorized actor. | Staff cannot self-authorize exceptions. | Open |
| **#120** | 4 | Dashboard vs manager task list conflation; large field registry overwhelming queues | Open | Pending | `tests/contracts/dashboard_manager_views.test.js` | Pending | Daily lab queue defaults to physically received/in-process; expected/field registry separated; true pending counts. | Provenance and Kobo records preserved. | Open |
| **#114** | 4 | Map centering issues, lack of fullscreen, map layer fallbacks | Open | Pending | `tests/contracts/map_view.test.js` | Pending | Sample coordinates precedence -> lab location -> neutral fallback; fullscreen; compliant tile fallback. | No unsolicited device geolocation; no paid tile keys. | Open |
| **#115** | 4 | Navigation order not reflecting laboratory journey | Open | Pending | `tests/contracts/navigation_order.test.js` | Pending | Journey order: Reception -> Workbench -> QA -> Reporting; role-aware; preserves paths and deep links. | Role permissions unchanged. | Open |
| **#116** | 4 | Hardcoded English strings in Spanish/multilingual UI | Open | Pending | `tests/contracts/localization_integrity.test.js` | Pending | Extracted strings in en, es, es-419, fr, pt; domain term consistency ("Lista de tareas"); plural rules. | Scientific codes remain standard. | Open |
| **#126** | 4 | Raw usernames displayed instead of proper names in messages/tasks | Open | Pending | `tests/contracts/user_display_name.test.js` | Pending | Proper name with username fallback; historical audit attribution preserved. | Passwords/private profile data excluded. | Open |
| **#102** | 5 | Physical mobile device testing (iOS Safari, Android Chrome) | Open | Pending | Mobile test execution sheet | Pending | Real-device testing required for workspace tabs, sticky headers, virtual keyboard, camera permissions. | Emulation alone is insufficient. Remains open for real device checks. | Open (Human/Hardware) |
| **#103** | 5 | User membership reconciliation & country access grants | Open | Pending | Read-only reconciliation ledger | Pending | Aligned with country migration; explicit owner junctions separated from central programme servicing. | Subject to production migration hold & reviewed change-set. | Open (Governance) |
| **#104** | 5 | Separate Laboratory Dashboard sample count discrepancy | Open | Pending | Verification report & reporter confirmation | Pending | Historical count confirmed (3,580 on 15 Sept); read-only inspection; external pipeline coordination with Luis. | Separate external application; no auto-backfill into LIMS. | Open (External/Reporter) |

---

## Detailed Acceptance Records

### Phase 0: Acceptance Reconciliation & Operation Binding
- **Tests Executed**:
  - `server/tests/contracts/soilfer_country_migration.test.js` (3/3 passed): 35,197 samples, 4 results, 3 QC batches, 3 reports, zero orphaned results, SHA-256 report checksum conservation.
  - `server/tests/contracts/project_policy_v2.test.js` (21/21 passed):
    - Client-supplied `isStoredApprovalVerified` booleans strictly stripped at HTTP trust boundary.
    - Direct manager self-authorization verified.
    - Stored approval verified against persisted `SampleAmendment`.
    - Cross-sample mismatch fails closed (`APPROVAL_SAMPLE_MISMATCH`).
    - Cross-project mismatch fails closed (`APPROVAL_PROJECT_MISMATCH`).
    - Cross-lab mismatch fails closed (`APPROVAL_LAB_MISMATCH`).
    - Empty reason rejected (`APPROVAL_EMPTY_REASON`).

### Phase 1: Issue #118 QC Batch Inspection, Disposition & Release Gates
- **Tests Executed**:
  - `server/tests/contracts/qc_disposition_release_gate.test.js` (6/6 passed):
    1. `GET /api/qc/batches/:id` returns canonical batch with actual control values, affected items, run profile, and enforces lab scope (cross-lab returns 403).
    2. Unresolved `QC_FAIL` batch strictly blocks downstream sample approval (409) and report publication (409 with code `QC_BATCH_FAILED`).
    3. `POST /api/qc/batches/:id/disposition` enforces manager role, scope, non-empty justification reason, logs transactional audit entry (`action: 'QC_DISPOSITION'`), and appends to batch history.
    4. Resending identical manager disposition is idempotent and does not create duplicate audit entries.
    5. Manager disposition override (`PROCEED_WITH_WARNING`) unblocks sample approval and report publication eligibility.
    6. Dispositioned batch clears from actionable pending exception queues (`manager.exceptions`, `audit.qc`, `master.exceptions`) while remaining permanently in history.
- **Client Build**:
  - Production build via `npm run build` (`vite build`) passed in 8.93s with 0 errors.
  - New component: `client/src/components/qc/BatchInspectionModal.jsx`.
  - Integrated into `client/src/pages/QADashboard.jsx` and `client/src/pages/ManagerQueue.jsx` via `?batchId=` URL search param and row Inspect actions.
