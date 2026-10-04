# Workflow findings and evidence

Inspected revision: `878e894472708076228f590e58bd35ba2a8ecbfa`. File locations below are relative to repository root; line numbers refer to this revision. Findings describe the current checkout, not a production incident. **R** = reproduced against synthetic data; **S** = source-confirmed behavior/gap; **U** = targeted browser observation; **D** = proposed operational improvement requiring lab validation.

Priorities: **P0** release/evidence integrity repairs first; **P1** needed for dependable routine operation; **P2** operational improvement after the core model is sound. A source-confirmed risk is not counted as a runtime reproduction.

## Coverage from reception to final disposition

| Stage | Existing foundation observed | Issue or next requirement |
|---|---|---|
| Request/intake | Package/order handling, lab/project identity, consignment and reception records. | Confirm local method choice, deadlines, requested material routes, sufficient quantity, and amendment behavior. |
| Reception | Physical acceptance/rejection, identifiers, labels, custody information, reception checks. | Material portions and shared-extraction mass accounting are needed; insufficient material must lead to an explicit partial-service decision. |
| Preparation | Drying/preparation operational tasks and checklists. | Gates are broadly sample-wide; methods requiring different material conditions need separate routes. |
| Assignment | Method-aware work items, equipment qualification support, work queues. | Method revisions, assignment ownership, and physical batch identity must remain consistent across execution. |
| Bench execution | Bulk worksheet, paste preview, drafts, conflict UI, completion/submission steps. | Use a physical run as the main unit, provide typed repeat lineage, visible controls, and stage-specific records. |
| QC | Rack profiles, blank/duplicate/control evaluation, dispositions and flags. | Prefilled measurements, missing required-slot checks, generic thresholds, replaceable evidence, and closure bypass. |
| Technical review | Canonical review decisions and bulk review. | Older endpoint bypasses scope/status; canonical paths do not consistently block pending QC. |
| Final approval | Existing eligibility logic includes stronger approval checks. | Other entry points do not consistently reuse that logic. |
| Reports | Versioned report snapshots, share links, amendments. | Publication bypass, scalar/replicate selection, and apparent signatory attribution need repair. |
| External exchange | Explicit lab/project/country restrictions and held-sample exclusions. | Preserve these controls; attach release/result lineage and amendment versions rather than create a second gate. |
| Storage/retention | Archive/disposal operations and storage movement recording. | Physical retention followed by disposal must be supported independently of analytical approval state. |
| Quality system | Equipment, inventory, audit records, and many contract tests. | Link lots and qualifications to actual attempts; add method policy approval, chart history, nonconformance and PT workflows. |

## Prioritized register

### F01 · P0 · Legacy review bypasses laboratory scope and submission state · R/S

**Observed:** a manager from AUDIT-A posted ACCEPT to `/api/reviews/foreign-wi` for an ASSIGNED item in AUDIT-B. Response 201; persisted status ACCEPTED (P05). The route is mounted and the controller checks the role but not the laboratory relationship or submitted evidence.

**Evidence:** `server/controllers/reviewDecisionController.js:11`, `server/routes/reviewRoutes.js`, `server/app.js:303`.

**Impact:** review authority and the evidence trail can be bypassed through an alternate endpoint, even if the main screen is correct.

**Repair:** route every review through the same scoped command service, or retire this endpoint with an explicit error. Require submitted attempt/version, decision evidence, and consistent audit records. Cover every role and route alias with negative tests. WP-01; AT-01–03.

### F02 · P0 · Publication permits an unapproved sample with pending QC · R/S

**Observed:** `/api/reports/generate/publish-pending` returned 200 and created a PUBLISHED report for a SUBMITTED_FULL sample, a SUBMITTED work item, and an OPEN QC batch (P07).

**Evidence:** `server/services/workEligibility.js:331` (canPublish, allowed status set around 365), `server/controllers/reportController.js:73` (generate), `server/services/reportAssembly.js:18`.

**Impact:** final approval is not a reliable release boundary. A published report is an externally usable artifact, regardless of whether a separate exchange API would still block it.

**Repair:** a publication transaction must verify an approved release snapshot and its selected accepted results, method/QC evidence, scope, and active holds. No report, share token, or published status may be created on failure. WP-01/WP-09; AT-04–08.

### F03 · P0 · QC entry is prefilled with plausible passing measurements · R/S/U

**Observed:** QC form opens with blank 0.02, target 7.00, measured control 7.03, duplicate 6.85/6.87. Submitting the equivalent unchanged payload produced QC_PASS (P04). The browser screenshot shows these values before entry.

**Evidence:** `client/src/components/workbench/BatchModal.jsx:29`, [QC screenshot](evidence/soil-qc-defaults.png).

**Impact:** example data can be mistaken for actual observations. Expected control values are manually editable without a material/lot identity.

**Repair:** initialize measured values empty; read assigned values from an authorized method/material lot; record author and source. Clear draft context safely when switching runs. Fixtures/examples belong in isolated demo mode only. WP-01/WP-05; AT-09.

### F04 · P0 · QC type presence substitutes for required control coverage · R/S

**Observed:** RACK_40 reserves two duplicate positions, but one blank, one control, and one duplicate pair passes (P01/P04). The evaluator builds a set of present types instead of checking each required control and count.

**Evidence:** `server/controllers/qcController.js:82`, `server/services/qcService.js` (evaluateBatchQc), `BatchModal.jsx` QC form has one pair.

**Impact:** occupied QC slots and adequate scientific QC are disconnected. The missing second duplicate position is not rejected; no linked source sample proves that a duplicate was performed.

**Repair:** planned control instances with physical positions, pair identity, analytes and exact coverage; evaluation must identify each missing requirement. In containment, enforce the current profile's complete requirements and prevent unsupported profiles from being released. WP-01/WP-05; AT-10–12.

### F05 · P0 · A request can close a batch while newly evaluated QC fails · R/S

**Observed:** PUT with blank 10 and status CLOSED against a previously QC_PASS batch returned 200, persisted CLOSED, stored QC_FAIL, and had no disposition (P11). The closing branch checks the old batch status.

**Evidence:** `server/controllers/qcController.js:324`, `:386`, `:418`.

**Impact:** batch lifecycle and QC outcome disagree; downstream code treating CLOSED as acceptable can lose the failure.

**Repair:** evaluate the proposed new state in one transaction, keeping lifecycle state separate from analytical outcome. Closure is not scientific acceptance. Reject conflicting commands and require a current authorized disposition where appropriate. WP-01/WP-05; AT-13–15.

### F06 · P1 · Pending QC is not consistently a review blocker · R/S

**Observed:** the canonical `/api/work/:id/review` accepts a SUBMITTED item in an OPEN batch (P06). Its explicit QC guard checks QC_FAIL. Similar fail-only logic appears in bulk/submission review paths; those additional paths were inspected, not separately exercised.

**Evidence:** `server/controllers/workItemController.js:1275`, `:1639`; `server/controllers/submissionController.js:371`; compare stronger `canFinalApprove` in `workEligibility.js:165`.

**Repair:** distinguish saved, completed, submitted, technically accepted, and released. Pending/missing/not-evaluable QC cannot count as passing; a visible “waiting for QC” submission queue can still support productive work. WP-01/WP-09; AT-05/16.

### F07 · P1 · Generic QC calculations are scientifically unsuitable for all methods · R/S

**Observed:** the current evaluator defaults to blank limit 0.05, duplicate RPD 10%, control recovery 90–110%. Calls supply a run profile rather than a method-specific policy. A duplicate pair +1/−1 returns RPD 0 and PASS because the average is zero (P02).

**Evidence:** `server/services/qcService.js` (evaluateBlank/evaluateDuplicate/evaluateControl); `qcController.js:324` and `:462`; [research R02–R08](RESEARCH.md).

**Impact:** a sensible rule for one measurement may be meaningless for another. Near-zero, negative or censored results need explicit treatment. The +1/−1 example is a calculation counterexample, not a realistic pH sample.

**Repair:** versioned method policies, unit/basis/range validation, appropriate absolute/relative metrics, and NOT_EVALUABLE outcomes. Remove universal fallback scientific limits from operational release. WP-05; AT-17–22.

### F08 · P1 · QC parsing disagrees with determination parsing · R/S

**Observed:** the form's `parseFloat('6,85')` yields 6; the workbench parser normalizes the same string to 6.85 (P03). QC inputs are text inputs. This audit reproduced the parsing expressions, not a complete locale-specific browser submission.

**Evidence:** `BatchModal.jsx:132`; `server/services/workbenchValidationService.js`.

**Repair:** one strict parser for all scientific entry and imports; preserve original input, normalize approved decimal formats, reject ambiguous thousands separators and trailing junk. WP-01/WP-07; AT-23.

### F09 · P1 · Routine numeric saves bypass the existing attempt model · R/S

**Observed:** recording a numeric pH determination through `/api/workbench/batch-save` saved one Result and zero WorkAttempts (P09). Texture has a separate attempt path with attemptNo 1 and a fixed material string.

**Evidence:** `server/controllers/workbenchController.js:1252` versus `:1274`; `server/prisma/schema.prisma:1121`.

**Impact:** the schema's execution lineage is not uniformly populated; rerun reason, source portion, instrument run, and review cannot reliably identify one execution.

**Repair:** extend and use WorkAttempt for all method types, with monotonic identity, parent/reason, material and result links. Do not create a competing attempt model. WP-02/WP-07/WP-08; AT-24–29.

### F10 · P1 · Replicates collapse into a single displayed value · R/S/U

**Observed:** two current results for the same sample/parameter (replicate 1 = 6.2, replicate 2 = 6.8) produce the scalar queue value 6.8 (P08b), shown in the worksheet. The map keys by sample and parameter only. One draft per WorkItem also limits independently identified concurrent replicate drafts.

**Evidence:** `workbenchController.js:432–440`, `:579`; schema WorkItemDraft `:293`, Result `:836`.

**Important boundary:** P08, the superseded-result experiment, returned the correct 6.2 in this fixture. **A stale 9.9 result was not reproduced.** Missing current/method/replicate filtering and deterministic selection remain source risks.

**Repair:** select by order line/attempt/replicate group; show all contributors and the explicit reportable selection. Never infer a scientific result from last iteration order. WP-02/WP-08/WP-09; AT-30–33.

### F11 · P1 · Batch reassignment can leave conflicting membership · R/S

**Observed:** allocating one item to old-batch, then new-batch, returns 200 twice. The work item's batchId becomes new-batch, while old-batch's stored workItemIds still contains it (P10).

**Evidence:** `server/controllers/qcController.js:501`; schema Batch workItemIds and WorkItem batchId/rackPosition.

**Repair:** one authoritative normalized membership, unique physical position constraints, explicit transactional move before run start, and immutable run membership thereafter. Retain old memberships as history rather than active occupancy. WP-01/WP-04; AT-34–36.

### F12 · P1 · QC evidence can be replaced and partially synchronized · S

**Observed:** typed QC rows are deleted/recreated when synchronizing; batch update, row synchronization, and result flagging are separate operations. Synchronization catches/logs errors. This is a source-confirmed atomicity risk; no injected database failure was run.

**Evidence:** `qcController.js:17–79`, `:418–429`, evaluation route around `:444`.

**Repair:** append observations/evaluation revisions; correction supersedes with reason. Persist evidence, coverage, outcome and impact decisions atomically; use an outbox for post-commit notifications. WP-05; AT-14/37.

### F13 · P1 · Batch identity does not pin the scientific method and policy · S

**Observed:** batches store analysis, profile and instrument text but not immutable method revision, QC policy version, matrix/basis, or explicit preparation/run relationships. Allocation checks analysis aliases, not full method identity. Profile inference includes instrument-name text.

**Evidence:** schema `:319`; `qcController.js:120`, `:138`, `:501`.

**Repair:** physical container capacity, preparation/extraction batch, instrument sequence and QC policy must be distinct concepts. Compatibility must be verified by stored identity, never a model-name substring. WP-02/WP-04/WP-05; AT-38–39.

### F14 · P1 · Material routing is too sample-wide · S/D

**Observed:** ordinary non-post-analytical work uses sample-level drying and preparation gates. There is no first-class physical-portion relation in WorkAttempt; materialAliquot is a string. Current operational checklist language already permits SOP-specific instructions; do not regress that improvement.

**Evidence:** `server/services/workbenchReadinessService.js:65`; schema Sample/WorkAttempt; `server/data/operationalChecklists.json`.

**Repair:** a method determines the required material state. Introduce traceable portions for as-received, fine-earth, finely ground and intact material when needed; a failed preparation affects its descendants. WP-03; AT-40–43.

### F15 · P1 · Basis selection can imply a correction without its evidence · S/U

**Observed:** the inspector offers “Oven-dry (105°C moisture-corrected)”; numeric save accepts basis labels. That path does not establish a linked moisture measurement and mass-basis calculation.

**Evidence:** `WorkbenchInspector.jsx:160`; `workbenchController.js:1109` and numeric result write path.

**Repair:** separate preparation condition from reporting basis. A dry-matter conversion requires an applicable recorded moisture factor/formula and source portion; pH should not acquire a fictitious concentration correction. WP-03/WP-07; AT-44–46.

### F16 · P1 · QC and instrument defaults misrepresent the actual bench · S/U

**Observed:** create-run defaults to Metrohm 914 and RACK_40. Allocation summary labels positions 1/2/20/40 and subtracts four slots even though other profiles exist. An instrument qualification selector elsewhere is a separate concern.

**Evidence:** `BatchModal.jsx:22`, allocation display around `:349`; browser walkthrough.

**Repair:** choose an eligible real asset or a documented manual method; render the selected layout/policy from server data. Calculate unknown capacity with required QC and reserves, not a fixed subtraction. WP-04/WP-06; AT-38/47.

### F17 · P1 · Worksheet organization is weak for physical tray work · S/U/D

**Observed:** 102 ready items in the synthetic fixture appear in a single method worksheet, including items with different batch context. QC is entered in a separate modal. At the captured 1280×720 viewport, the page chrome and side inspector leave only about three full data rows visible initially, and the inspector extends toward the right edge. This is a specific viewport observation, not a general device survey.

**Evidence:** [worksheet screenshot](evidence/soil-workbench-desktop.png); `WorksheetArea.jsx:274–300`; `WorkbenchShell.jsx`; queue findMany `workbenchController.js:282` has no bounded paging.

**Repair:** queue for planning, focused run worksheet for execution, compact mode, optional inspector, sticky identity/save/QC status, scanner support and printable rack map. Virtualize/paginate the global queue; preserve physical order in the active run. WP-06; AT-48–54.

### F18 · P1 · Repeat and control semantics are underspecified · S/D

**Observed:** UI replicate selector says primary/quality duplicate/triplicate, while WorkAttempt lineage is incomplete. QC duplicate values do not identify a source portion or the stage independently repeated. Batch disposition can mark reanalysis required without creating a complete new attempt lineage.

**Evidence:** `WorkbenchInspector.jsx:165`; `qcController.js:752`; schema WorkAttempt/BatchQcResult.

**Repair:** distinguish field duplicate, preparation duplicate, analytical duplicate, repeated reading, and new attempt. Provide scoped repeat requests and preserve all original evidence. WP-02/WP-05/WP-08; AT-24–33/55–57.

### F19 · P1 · A method revision can be displayed without recorded provenance · S

**Observed:** queue response uses `item.methodRevision || 'rev1'`; WorkItem has no corresponding methodRevision field in the inspected schema. OrderLine and WorkAttempt contain stronger revision concepts.

**Evidence:** `workbenchController.js:573`; schema `:236`, `:1098`, `:1121`.

**Repair:** derive from a pinned execution/order revision. Show historical unknown explicitly; never manufacture a revision during migration or display. WP-02; AT-58.

### F20 · P1 · Report assembly lacks explicit scientific selection and signatory binding · S

**Observed:** assembly includes current valid results with replicate numbers rather than an approved reportable-selection object. Its signedBy name uses the first active laboratory manager before falling back to the requesting user. Approval metadata exists separately.

**Evidence:** `server/services/reportAssembly.js:18`, `:38`, `:100`, `:199`.

**Repair:** report exactly the approved result selection and methods. Distinguish prepared by, reviewed by, authorized by and institution contact. A signature label must identify the person who actually authorized this release. WP-09; AT-59–61.

### F21 · P1 · Release checks and snapshot construction can race · S

**Observed:** report eligibility/assembly occur before the write transaction. A concurrent hold, QC revision or amendment could change the evidence between check and publication; no concurrency reproduction was attempted.

**Evidence:** `reportController.js:86–123`.

**Repair:** versioned release manifest plus transaction-time validation; compare all critical revisions, retry safely, and block stale decisions. WP-01/WP-09; AT-07/37.

### F22 · P1 · Stored material cannot naturally progress from archive to disposal · S/D

**Observed:** direct archive and disposal controllers require APPROVED; they also reject an existing active/completed opposite task. That obstructs a normal retain-then-dispose lifecycle.

**Evidence:** `server/controllers/sampleController.js:2330`, `:2445`.

**Repair:** retain physical-material disposition independently of result approval/release. Permit storage, retrieval, return and later disposal subject to retention/holds and authorized records. Preserve release history. WP-10; AT-62–64.

### F23 · P2 · Reception quantity estimates need material-aware planning · S/D

**Observed:** intake estimate uses requested analysis sampleMassRequired with a fallback and retention buffer. It does not model actual portions, shared extraction, consumed quantities and repeat reserve as a material ledger.

**Evidence:** `server/controllers/receptionController.js` mass-estimation/validation path; schema Sample reception fields.

**Repair:** calculate from unique preparation/extraction requirements, method controls, minimum usable portion, archive quantity and repeat reserve. Let a manager choose a documented partial order when quantity is insufficient. WP-03; AT-41/65.

### F24 · P1 · Inventory/control lots and QC observations lack end-to-end linkage · S/D

**Observed:** InventoryLot and equipment qualification models exist, but BatchQcResult does not link a control material, assigned-value version, position, source attempt, unit, or per-analyte coverage. Existing models should be extended rather than replaced.

**Evidence:** schema `:340`, `:503`, `:607–681`.

**Repair:** bind lot use and qualification snapshots at execution; distinguish calibration standard, independent check standard, CRM, other reference material and in-house control. WP-05/WP-07; AT-66–68.

### F25 · P2 · Control charts, nonconformance and external QC need a connected workflow · D

**Evidence basis:** current batch-level QC design plus research R05–R11. This is a target capability recommendation, not a claim that every related screen is absent.

**Repair:** material/method-specific charts with approved limits, investigated failures, affected-result tracing, corrective actions and blind PT handling. A passing repeat must not remove the original failure from trend data. WP-11; AT-69–71.

### F26 · P1 · Audit/test isolation needs improvement before broad verification · S

**Observed:** the default server test setup plain-copies `server/prisma/dev.db`; teardown enumerates and unlinks shared test temporary files. That is unsuitable for this audit's data-isolation requirement and risky for parallel test sessions.

**Evidence:** `server/tests/globalSetup.js`, `server/tests/globalTeardown.js`.

**Repair:** seed schema-only dedicated fixtures, isolate paths per invocation, scope teardown to that invocation, and test migrations from explicit sanitized fixture versions. WP-00/WP-12; AT-72.

## Safeguards that already work and must be preserved

- Null blank evidence did not pass (C01).
- Direct evaluation of a CLOSED batch was rejected (C02).
- Setting QC_PASS without measurement evidence was rejected (C03).
- The scalar superseded-result probe returned the current value in its particular fixture (P08).
- Canonical review includes scope checks and decision records; final-approval policy is stronger than some alternate routes.
- Existing equipment qualification checks, optimistic work-item versions, conflict comparison, reception holds, report versioning and external exchange scoping are valuable foundations.
- The bench supports decimal normalization, paste preview, drafts, and keyboard-oriented entry. These should be retained and tested within the new physical-run model.

## Verification record and limits

[probe-results.json](probe-results.json) contains P01–P11, P08b, and C01–C03: 15 recorded checks. P01/P02 are service calculations; P03 compares parser expressions; P04–P11/P08b and C01–C03 exercise authenticated HTTP paths. The script is an audit harness, not an assertion suite claiming a green build.

The browser loaded current React source against a new synthetic database containing 100 bench samples plus small counterexample fixtures. It inspected My Work, worksheet, run creation, QC entry, and the determination inspector. A decimal-comma entry/reload was exercised, but no comprehensive browser persistence/concurrency acceptance result is claimed from that exploratory step. Screenshots document the initial worksheet and prefilled QC form. WebSocket notifications were not connected by this fixture, so its notification errors are excluded as application defects.

No production data was copied or changed. No scanner, balance, printer, instrument integration, wet procedure, real technician session, or 300-sample performance test was run. Server/client full suites were not run. Those are explicit delivery checks in [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md), not completed audit claims.
