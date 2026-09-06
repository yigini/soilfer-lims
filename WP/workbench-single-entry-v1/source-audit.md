# Source and live evidence audit

## Scope and provenance

- Local source inspected: `eff4449` (dashboard work committed locally). Worktree initially clean.
- Production image observed on 2026-09-06 during this audit: `soilfer-lims:v3.0.1-cdcc2cb`; image digest `sha256:8aec9ad4bf3766265f5bf58e8126bfbf90b776d0ed6cecb35bb36cadf902680f`; started 15:17:48Z. Do not assume that remains the deployed image when implementing.
- Antigravity was still checking PR #55 CI/image packaging. Its dashboard work and this follow-up must be reconciled on the newest branch.
- Live Sample page was read in the existing Marco tab. A new Workbench tab inherited an intake-officer session and redirected to that role's home page; no fresh Marco Workbench interaction was performed. Workbench behaviours below are source findings and user reports, not an invented live browser reproduction.
- Read-only SQLite inspection at **16:05:09Z** showed W001's gate records. A subsequent read confirmed the literal preparation value and active order codes. No writes. Staff were actively working, so the handoff must re-read versions before any recovery.
- `reproduce-current-defects.cjs` loads actual local controller functions in a VM with mocked in-memory services. Four probes confirm old behaviour. This is not database/concurrency/browser certification and must not be described as four passing fix tests.

## W001 evidence

| Record | Observed stored facts |
|---|---|
| Sample | id/labId W001; assignedLab GTM-LAB1; status SUBMITTED_PARTIAL; reception recorded; dryingStatus and preparationStatus both DONE |
| Drying | work item WI-1788705780375-318; ACCEPTED; v1; complete operational-checklist-v1 JSON, 3 true checks; completed 15:48:22.757Z; submitted 15:48:28.229Z |
| Drying submission | SUB-1788709708246-c19da0 still PENDING_REVIEW, PARTIAL, one linked work item; linked drying item already ACCEPTED |
| Preparation | work item WI-1788705780398-386; COMPLETED; v1; result literal `Done`; completed 15:51:08.540Z; no submissionId, submittedAt or WorkItemDraft |
| Review metadata | No ReviewDecision rows for W001 at the follow-up read; drying reviewedAt null despite accepted status |
| Active order | PLANT_N, PLANT_P, PLANT_K, PLANT_CA, PLANT_MG, PLANT_S, PLANT_FE, PLANT_ZN, PLANT_MN, PLANT_CU, PLANT_B: 11 ACTIVE required lines |
| Assigned scientific tasks | CEC, CLAY, EC, EXCH_CA, EXCH_K, EXCH_MG, EXCH_NA, PH_H2O, P_OLSEN, SAND, SILT, SOC, TN: 13 soil tasks |

The UI showed 11 ordered in the header, 13 Ordered Analyses, 15 Analytical Results (including gates), a plant/soil discrepancy hidden behind counts, and operational evidence presented as `Toggle Status`. Investigate original request, receipt, revisions and task-generation history; this audit has **not established which process produced the plant order** or which request is authoritative. Do not infer that the 11-count is a texture grouping effect.

## Findings and implementation targets

Line references apply to eff4449; search symbols after rebasing. These affected controllers/editors, except WorkbenchShell and Sample projection additions, were unchanged between cdcc2cb and eff4449.

| ID / priority | Evidence and consequence | Required correction |
|---|---|---|
| W01 / P1 | SampleDetail.jsx:236 calls PUT /api/work/:id/status without a client version. WorkItemsTable.jsx:579,610,655 offers Toggle Status, scalar entry, Save & Complete and Mark Done (`result:'Done'`). | Remove technician execution controls from Sample; use a read-only evidence table and an exact Workbench destination. Preserve unrelated controls. |
| W02 / P1 | workItemController.js:1011 persists COMPLETED and `Done`; lines1042–1065 mutate updateData to ACCEPTED **after** the awaited database update, without writing that change. Sample DONE is updated separately. Probe P1 confirms the partial lifecycle. | A single transactional operational command must persist evidence, state, flags, history and receipt together. Do not merely move the auto-accept line or accept `Done`. |
| W03 / P1 | WorkItemsTable.jsx:667 considers completed gates reviewable; workItemController.js:1168 correctly requires SUBMITTED on the generic scientific review path. Probe P2 confirms rejection. | Distinguish operational confirmation/verification from scientific approval; derive UI capabilities from the same command policy. |
| W04 / P1 | workbenchController.js:22 queue includes only ASSIGNED, IN_PROGRESS, REANALYSIS_REQUIRED. COMPLETED work is invisible there. WorkbenchShell review click only setActiveTab; submissionPreview starts null; only the completion path calls handleOpenSubmissionReview. | Separate server-backed Ready to submit / Submitted / Completed views. Fetch each view on direct navigation/reload, independent of current-session completion. |
| W05 / P1 | workbenchController.js:1534 preview and1662 commit select COMPLETED + submissionId null, including gates and bare `Done`. Probe P3 confirms preview accepts missing checklist evidence. Commit submits all eligible tasks for selected samples, not an exact previewed list. | Typed evidence validation, explicit selected attempt IDs/versions and order revision; no gates in scientific bundles; preview/commit parity inside transaction. |
| W06 / P1 | batchSave responds 200 success:true with saved0/errors (P4). WorkbenchShell:220 ignores draft response body; :335 and :381 show success from totals without handling errors. | Report actual per-item results; keep failed edits; never show Saved or Submitted on a refused write. |
| W07 / P1 | WorksheetArea.jsx:296 binds gate checks only to draft?.checks or three false values; draft removed after completion at workbenchController.js:971. Structured currentResult is not rehydrated. Sealed states other than COMPLETED are not consistently rendered as immutable evidence. | Render draft only for editable attempts; display immutable recorded evidence (including checklist revision, author/time) after completion. An absent draft does not mean incomplete work. |
| W08 / P1 | Sample phase route (sampleController.js:522–650) writes DONE → ACCEPTED and `Gate Passed` separately, no checklist. /api/work status/start, /api/results save/submit and spectral imports are further entry routes. | Inventory all writers and callers. Retire generic execution shortcuts or adapt to the same evidence command; protect direct calls, stale clients and imports. |
| W09 / P1 | W001 has an active plant order but soil tasks; sampleWorkspaceService.js:282 takes the newest revision regardless of status and links tasks by analysis code only. | Resolve actual ACTIVE revision, explicit order-line/current-attempt links, matrix/method applicability; quarantine mismatches for audited reconciliation. No inferential remapping across matrices. |
| W10 / P1 | W001 drying item ACCEPTED while its Submission remains PENDING_REVIEW; legacy per-item review writes do not produce the observed canonical decision/closure metadata. | Review commands must reconcile item, immutable decision, submission aggregate, sample coverage and manager counters atomically. Preserve old reviews in recovery. |
| W11 / P1 | WorkbenchShell fetchQueue replaces all groups; debounce captures stale groups, no pending-save barrier/discard cancellation; saved pill depends on last response, not all pending writes. Deep-link effect reruns on every groups edit/fetch. | Per-item edit sequence/acknowledgement, cancel or drain pending saves, conflict UI, latest-request protection; resolve URL intent once per navigation. |
| W12 / P1 | New workEligibility.canRecord/canSubmit are defined but not used by Workbench command controller/readiness; several policies coexist. | Audit call sites, consolidate actual command and read projection policies, not merely introduce another helper. Preserve hold, receipt, scope, assignment, equipment and QC checks. |
| W13 / P1 | getQueue reads Result rows by sample+param without isCurrent filtering/attempt/replicate selection and last-map-wins. Spectral query groups at sample+modality. Batch texture completion also has a later separate derivation pass. | Typed current-attempt evidence selection; no wrong replicate, superseded result or unrelated scan. One atomic grouped texture derivation tied to exact source versions. |
| W14 / P2 | Sample projection and SampleDetail hardcode Air Drying(40°C), 2mm, SOP-PREP rev2 and constant weight although actual stored checklist revision is operational-checklist-v1. | Render actual configured SOP/method evidence. Never invent temperature, preparation fraction, revision or endpoint. |
| W15 / P2 | Workbench grouping by analysis code; queue omits methodologyId in item response while new deep link searches it. initialWorkItemId searches i.id but response uses workItemId; group fallback selects first group when exact target absent. | Stable run/method/revision/matrix/basis grouping and matching response fields; exact deep link including history/recorded work; explicit target unavailable instead of wrong worksheet. |
| W16 / P2 | All queue tasks feed Review & Submit badge; task suffix labels collide; names/method STD and history dates may mislead. | Count eligible entities with named units, readable parameter/method names, proper parsed evidence dates; internal identifiers in details only. |
| W17 / P1 | batchSave P2025 fallback returns early after partial item transactions, omitting the normal event/receipt path; notifications patch guessed result/status from request rather than canonical committed evidence. | One well-defined batch atomicity policy, durable idempotent receipts for every committed unit and after-commit invalidation on every success path. |

## Laboratory basis

The recommendation is a product/workflow design decision, not a claim that all labs use one approval policy. GLOSOLAN describes preparation as a controlled procedure intended to obtain representative material before analysis. Implement preparation steps from the lab's actual procedure. [FAO preparation guidance](https://www.fao.org/global-soil-partnership/resources/events/detail/en/c/1456188/).

WHO's quality framework distinguishes controlled procedures from the records produced when work occurs. That supports retaining the executed checklist revision and keeping evidence retrievable after the draft disappears. Its laboratory information checklist also requires result review before release. These are general quality-management references, not soil-lab accreditation certification. [WHO documents and records](https://www.who.int/tools/quality-management-system-for-non-laboratory-settings/pillar-5-documents-and-records), [WHO laboratory information checklist](https://extranet.who.int/lqsi/checklist/2/14?order=title&sort=desc).
