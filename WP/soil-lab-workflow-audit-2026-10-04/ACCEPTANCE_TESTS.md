# Acceptance tests, migration checks and lab pilot

These are **required future checks**, not claims that the implementation already passes. Existing audit observations are in [probe-results.json](probe-results.json). Use the plan's work-package IDs and findings to track completion.

## Test setup

Use newly created databases with explicit synthetic seeds. Do not copy production or the normal development sample database into test runs. Each test process owns a separate temporary directory and only removes its own artifacts. Exercise actual authenticated routes as well as service functions; controller tests alone will miss alternate endpoint bypasses.

Seed two labs, technicians, managers, reception staff, a restricted external reader and an unassigned/disabled user. Include multiple methods with the same broad property, two method revisions, method-specific material routes, approved and unconfigured QC policies, valid/expired/unsuitable assets and control lots. Include required/optional/cancelled order lines, current/superseded results, partial/complete samples and archived material.

For each command verify both response and committed records, unchanged rejected records, audit events, version numbers and side effects. Use deterministic clocks/IDs where helpful; concurrency tests need real overlapping transactions. Every invariant must hold when the same action is attempted through direct HTTP, bulk paths, compatibility routes and supported imports.

## Critical release and QC regression cases

| ID | Scenario | Expected result |
|---|---|---|
| AT-01 | Lab A manager attempts legacy review of Lab B work; repeat for canonical and bulk routes. | Scope rejection; no status/decision/audit-success mutation. |
| AT-02 | Manager accepts ASSIGNED/unsubmitted work or work without execution evidence. | Rejected consistently through every review route. |
| AT-03 | Duplicate review request or stale reviewed evidence version. | Idempotent receipt for identical retry; conflict for changed/stale evidence; no duplicated decision. |
| AT-04 | Reproduce P07: SUBMITTED_FULL sample, SUBMITTED work, OPEN QC, generate report. | No publication, report row marked published, share token or release timestamp. Useful blocker returned. |
| AT-05 | Review/release with MISSING, PENDING, NOT_EVALUABLE or unconfigured required QC. | Blocked; approved NOT_APPLICABLE is separately tested and cannot be supplied by arbitrary client payload. |
| AT-06 | Directly set accepted/approved/published status through update routes. | Cannot bypass authoritative transition service or required evidence. |
| AT-07 | QC failure, intake hold or order amendment races with final approval/report creation. | At most a release based on an unchanged authorized version; stale transaction rejected/retried. No mixed snapshot. |
| AT-08 | Approved complete result selection with valid QC and scope. | Positive control: release/report succeeds and contains exactly selected values/evidence. |
| AT-09 | Open a new QC form, switch runs, reload drafts and submit without measurements. | No example measurements; no carryover from another run; missing evidence cannot pass. |
| AT-10 | Required control count is two but only one control is measured. | Identifies missing instance/position and blocks acceptance. |
| AT-11 | Correct number of control types but wrong source sample, analyte, material lot, run segment or unit. | Coverage/identity rejection; count alone insufficient. |
| AT-12 | Short final batch, interval boundary, added late sample and run interruption. | Policy-defined rounding/bracketing requirements generated correctly; no uncovered unknowns. |
| AT-13 | Reproduce P11: previously PASS batch receives failing observations plus close command. | Failing new state governs; cannot close as an acceptable run without the required current disposition. |
| AT-14 | Inject failure after observation write but before evaluation/flags/closure commit. | All changes roll back together; no partial evidence or false success. |
| AT-15 | C01/C02/C03 existing safeguards: null blank, evaluate closed batch, force PASS without evidence. | Preserve appropriate rejection/non-pass behavior. A deliberate correction uses a new controlled revision. |
| AT-16 | Submit execution while required final control is still pending. | If policy permits submission, it enters “waiting for QC”; technical acceptance and release remain blocked. |

## Scientific calculations and identity

| ID | Scenario | Expected result |
|---|---|---|
| AT-17 | Same readings evaluated as pH and as an approved concentration method. | Each uses its own configured metric/units; no generic rule leakage. |
| AT-18 | Duplicate pair +1/−1, zero/zero, near-LOQ, `<LOQ` and mixed units. | No divide-by-zero false PASS. Apply approved domain-specific rule or NOT_EVALUABLE; preserve qualifiers. |
| AT-19 | Values exactly at, just within and just outside each limit. | Unrounded comparison and inclusive/exclusive semantics match approved policy; display rounding does not change outcome. |
| AT-20 | Missing/nonfinite target, invalid recovery denominator, wrong assigned-value basis or unsuitable control. | Explicit invalid/not-evaluable result; no manufactured recovery. |
| AT-21 | Method/policy/assigned-value revision changes after run start. | Existing run retains pinned interpretation; a deliberate re-evaluation records a new revision and impact review. |
| AT-22 | Method permits blank correction versus method prohibits it. | Correct formula and lineage in first case; no silent subtraction in second. Original readings always retained. |
| AT-23 | `6,85`, `6.85`, empty, whitespace, `6.85abc`, ambiguous separators and exponent input across bench/QC/import. | Consistent documented parsing; no silent truncation; invalid/ambiguous input cannot be committed as another number. |
| AT-24 | New ordinary numeric, texture and spectral execution. | All create/link the correct WorkAttempt, method revision, material and raw/result evidence. |
| AT-25 | Retry attempt creation/save after network timeout. | One logical attempt/save receipt; no duplicate result or consumed material. |
| AT-26 | Two users create the next attempt simultaneously. | Unique attempt sequence and explicit result; no duplicate attemptNo or overwritten parent. |
| AT-27 | Re-read same extract versus independently re-extract. | Different typed relationships and required material/QC evidence; correct occupancy. |
| AT-28 | Correct typo in a draft, then correct an accepted result. | Draft behavior preserves versions; accepted correction creates a controlled revision and invalidates stale approval. |
| AT-29 | Historical result has no trustworthy attempt/method revision. | Explicit legacy/unknown classification; migration and UI do not invent “rev1.” |
| AT-30 | P08b: two current replicates for the same parameter. | Both identifiable; scalar output only through explicit approved selection/reducer. |
| AT-31 | Same sample has two different phosphorus methods or pH media. | Separate identities, review selections and reporting; neither overwrites the other. |
| AT-32 | Superseded and current values returned in different database orders. | Deterministic result/selection; superseded value never becomes current by iteration order. |
| AT-33 | Mean or selected repeat includes a failed, censored or unreviewed contributor. | Reject unless a specific approved rule legitimately handles it; selection reason and contributors retained. |

## Runs, preparation and the physical bench

| ID | Scenario | Expected result |
|---|---|---|
| AT-34 | P10: allocate the same work to a second run. | Reject or explicit atomic transfer before execution; no divergent active JSON/relational membership. |
| AT-35 | Two users allocate the last position; duplicate scan adds same container twice. | Unique occupancy; predictable conflict; no double count. |
| AT-36 | Move/delete an occupied position after run start or after readings exist. | Frozen history preserved; controlled sequence revision/new attempt required where appropriate. |
| AT-37 | QC result correction races with review, selection or report generation. | Evidence revisions prevent stale acceptance; old evaluation and impacted decisions remain traceable. |
| AT-38 | Mix method revisions, unsuitable assets or incompatible preparation into one run. | Server rejects incompatible allocation regardless of UI. Manual methods have an explicit valid pathway. |
| AT-39 | One preparation batch feeds multiple instrument runs/analytes. | Correct many-to-many lineage and per-analyte coverage; no assumption one rack equals all QC scope. |
| AT-40 | Sample requires routine prepared material and another approved distinct material route. | Independent portions/readiness; no forced universal drying or grinding. |
| AT-41 | Insufficient quantity, shared extraction, QC reserve, later extra test. | Material plan correctly counts unique uses; explicit partial-order/hold choice; no negative quantity. |
| AT-42 | Preparation fails or contaminates one portion after descendants are planned. | Relevant descendants held; unaffected siblings remain available. |
| AT-43 | Label reprint, relocation, split/merge where permitted, incorrect parent scan. | Stable traceable identity; lineage cannot cycle; wrong associations blocked. |
| AT-44 | Select dry-matter basis without required moisture evidence. | Cannot imply a correction occurred; block calculation/reporting or retain the valid original basis. |
| AT-45 | Moisture correction performed with approved source and formula. | Reconstructable result with original data, factor, units and formula revision. |
| AT-46 | Import solution concentration needing mass/volume/dilution conversion. | No unit-only mg/L to mg/kg conversion; required amounts and propagated reporting limit included. |
| AT-47 | Rack40, plate96, tube24 and approved custom layout with control frequencies. | Correct dynamic labels/capacity/positions; reject out-of-bounds or duplicate reserved slots. |
| AT-48 | Execute a full tray with keyboard only and then scanner. | Correct focus order, stable row identity, no duplicate submission or accidental completion. |
| AT-49 | New assignments/remote saves arrive while a technician types. | Active row does not move; other changes are visible without losing input. |
| AT-50 | Save failure, timeout with unknown outcome, reload and retry. | Accurate row save status; preserved input; idempotent reconciliation; no false global “saved.” |
| AT-51 | Two operators edit the same observation versus different rows. | Same-row conflict explicitly resolved; distinct-row edits preserved; correct actor attribution. |
| AT-52 | Touch mode/gloves, narrow station screen, 200% zoom and keyboard focus. | Core identity/actions usable; no color-only errors; minimum targets/spacing and focus meet agreed accessibility target. |
| AT-53 | Paste 40 values with a missing/duplicate identifier, blank row and wrong unit. | Preview detects mismatches; position mapping explicit; commit result identifies every saved/rejected row. |
| AT-54 | Global queue has 300 samples × illustrative eight determinations plus historical work. | Bounded query/rendering; correct counters/filters; active run remains stable. Measure performance, do not infer it from DOM size. |

## Repeats, reporting, quality and terminal handling

| ID | Scenario | Expected result |
|---|---|---|
| AT-55 | One analyte fails a multi-analyte instrument check. | Hold only defined affected coverage initially; investigator can widen scope with evidence. |
| AT-56 | Repeat one test from an otherwise completed sample. | New attempt for selected order line; other accepted results preserved; no duplicate accession. |
| AT-57 | Failed initial attempt followed by passing repeat and selection. | Original failure retained; disposition/selection explicit; report references chosen evidence. |
| AT-58 | Queue/worksheet/report renders a missing or changed method revision. | No fabricated revision; pinned execution revision displayed consistently. |
| AT-59 | Multiple active lab managers; a different authorized person actually releases. | Authorized-by field reflects actual release actor; contact/manager identity is separately labeled. |
| AT-60 | Full, authorized partial and amended reports. | Required omissions/outstanding tests explicit; version links correct; exactly approved selected results used. |
| AT-61 | Report includes censored values, different methods/bases and optional interpretation. | Correct qualifiers/method detail; interpretation only for compatible validated context; no implicit generic conversion. |
| AT-62 | Approved/released sample is stored and later disposed. | Valid retain-then-dispose path; report/review history unchanged; portion quantity/location correct. |
| AT-63 | Attempt disposal with an active hold, retained-period requirement or pending repeat. | Blocked with reason; unauthorized user cannot override. |
| AT-64 | Retrieve stored portion for reanalysis, return remainder to storage/client. | Chain of movement and quantity preserved; correct new attempt lineage. |
| AT-65 | Consignment mismatch, duplicate labels, damaged sample and quantity shortfall during bulk intake. | Independent dispositions, no duplicate accession, accepted subset clearly identified. |
| AT-66 | Expired/wrong control lot or certificate value for another method/analyte. | Use rejected or explicitly handled under approved scientific policy; cannot count as suitable required control. |
| AT-67 | Asset calibration becomes overdue before execution, or expires after a valid past run. | New execution blocked as required; historical validity evaluated at time of use, with later nonconformance handled explicitly. |
| AT-68 | Control/reagent lot consumption and corrected use after retry. | Consumption once per physical use; traceable correction; no negative stock or duplicate decrement. |
| AT-69 | Chart warning/action/trend cases and a new material lot. | Approved rule set applied; correct incident/alert severity; intentional chart transition and historical limits retained. |
| AT-70 | Failed control is corrected, excluded from limit estimation or repeated. | Original point and reasons remain; exclusion cannot silently erase the failure or release impact. |
| AT-71 | Blind PT sample and field duplicate are processed. | Appropriate blinded handling, correct distinct identities; no client-sample inflation or accidental mixing with internal control types. |
| AT-72 | Simultaneous isolated test runs plus interrupted migration rehearsal. | No source-record copying, cross-run cleanup or path collision; migration resumable with explicit reconciliation/restore checks. |

## Additional release/export and recovery matrix

In addition to numbered cases, parameterize existing exchange/report tests for restricted users and API keys: wrong lab, empty lab scope, disjoint project/country, active provenance hold, disabled key, current eligible release, superseded release and approved historical archived/disposed samples. Preserve current valid restrictions. Verify list/detail/search/count/GeoJSON/results/spectra/sync endpoints, not only the primary listing.

Test amendment after delivery: old report snapshot reproducible; current released version discoverable; affected export/retry references correct manifest; downstream notification/delivery requires the configured authorization. A failing external service cannot roll back scientific evidence or cause duplicate releases. Outbox retries are idempotent and observable.

Inject termination/database-lock conditions during allocation, entry, import, QC evaluation, review and report creation. Reconcile the unknown outcome using receipts after restart. Run restore rehearsal and verify record counts, raw hashes, report versions, selected result IDs, active holds and lab scope. No claim of disaster recovery is accepted solely because a backup file exists.

## Practical laboratory pilot

Use the actual laboratory's SOPs, instrument exports and permitted handling conditions. Start with synthetic/water/test materials and non-operational records as appropriate; then use a controlled shadow pilot approved by the laboratory. Avoid perturbing client reporting during evaluation.

Suggested participants: reception operator, at least two technicians covering different stations, technical reviewer/quality lead, and the person responsible for reports. If staffing differs, record which roles were covered. The software author should observe rather than coach through every step.

1. **Arrival exercise:** receive a 100-sample manifest with deliberately included duplicate, missing, damaged and insufficient-quantity cases. Print/scan labels and allocate portions; reconcile counts.
2. **Routine tray exercise:** plan a full run with the locally approved controls, perform stage entry, scan several out-of-sequence containers, record a short interruption, save and hand over to the second technician.
3. **QC exercise:** include one missing control, one control failure, one duplicate discrepancy and one unsuitable lot. Confirm clear blockers and affected scope; request justified repeats.
4. **Repeat exercise:** repeat only one determination on selected samples, then re-extract a shared analyte group in a separate case. Reviewer selects reportable results while viewing all attempts.
5. **Review/report exercise:** bulk-review eligible work, reject an exception, issue a complete and an explicit partial report, amend a released result in a controlled fixture, and verify the history.
6. **Outage exercise:** interrupt network access/save response, reload, reconnect and reconcile. Use the agreed paper contingency if offline entry is not part of the delivered scope.
7. **Storage exercise:** retain, retrieve and dispose a permitted portion; reject disposal when a hold applies.
8. **Peak exercise:** repeat planning/entry/review on a 300-sample synthetic workload with the real test mix or a labeled representative mix. Include five concurrent operators as an initial test assumption, adjusted to actual staffing.

Observe wrong-sample selections, control/sample confusion, row-position loss, missed save errors, task completion time, clicks/scans and requests for help. Record actual throughput separately for preparation, measurement, data entry and review. A successful interface pilot does not establish instrument or chemical throughput.

## Proposed performance and usability gates

These are proposed acceptance targets to benchmark on the intended lab computer/network, not measured current performance or universal standards.

| Measure | Initial target |
|---|---|
| Queue/run open at representative peak fixture | p95 ≤2 seconds, excluding an explicitly separate file upload. |
| Focus movement/scan feedback | p95 ≤200 ms locally; no dropped or misrouted characters. |
| Save acknowledgment under normal lab network | p95 ≤2 seconds; longer requests visibly pending. |
| Save/retry/reconnect integrity | Zero lost acknowledged values and zero unintended duplicate commits in test scenarios. |
| Physical identity | Zero undetected sample/portion/control misassociation in the pilot scenarios. |
| Routine entry | One direct reading entry/scan sequence per required observation; no mandatory per-sample navigation/modal sequence. |
| Error recovery | Operator identifies an unsaved/conflicted row and recovers it without developer assistance. |
| Peak duration | Sustain a representative shift-length simulation or agreed accelerated equivalent; report the tested duration and limits. |

If a performance target is missed, record cause, measurement conditions and approved remediation. Do not weaken scientific evidence to achieve a response-time target. Compare usability with the lab's current process and document actual gains; do not promise a percentage improvement before measuring it.

## Existing test suites to extend

Inspect and reuse `server/tests/contracts/qc_batch_evaluation.test.js`, `qc_controls.test.js`, `qc_disposition_release_gate.test.js`, `qc_disposition_flagging.test.js`, `workbench_draft_integrity.test.js`, `workbench_readiness_concurrency.test.js`, `workbench_pipeline_twostep.test.js`, `result_provenance.test.js`, `review_reports_amendments_p6.test.js`, `equipment_qualification_wp_108.test.js`, reception contracts and both exchange suites. Their presence is not evidence that the new scenarios are covered.

After safe fixture isolation, run targeted contracts per package, then the relevant workflow/security/scenario regression suites, client build and existing localization/lint checks. Add browser acceptance tests for the high-risk workflows and validate with actual hardware. Record exact commands, revision, data seed, pass/fail counts and unresolved failures in a delivery evidence file.

## Go-live gate

All P0/P1 integrity scenarios must pass. Every activated method must have approved configuration and suitable control materials. Migration reconciliation and restore must be demonstrated. Lab operators must complete the pilot, and authorized reviewers must sign off representative reports and repeat/QC dispositions. Unresolved cosmetic/P2 work can have owners and dates; unresolved release/evidence defects cannot be treated as cosmetic.

Maintain a checklist with columns: test ID, method/version, implementation revision, environment, evidence path, result, reviewer and follow-up. This document specifies the required evidence; it does not mark any future implementation test complete.
