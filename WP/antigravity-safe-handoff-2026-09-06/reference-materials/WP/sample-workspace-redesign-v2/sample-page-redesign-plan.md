# Sample workspace redesign — implementation specification, revision 2

Revised 6 September 2026 after a second source audit and the controls-preservation review. This is the current implementation specification; it supersedes the earlier plan's incomplete interaction coverage. Planning only; no application changes or production test mutations were performed by this review. Source baseline: `460598a`, with concurrent branding/permission and approval edits in the working tree inspected and left untouched. Production was previously inspected through the technician UI; its commit identity was not verified. Findings distinguish visible evidence from source analysis; no approval exploit was executed against production.

**Completion contract:** implement all mandatory behaviors in this document and pass the companion [delivery acceptance checklist](sample-workspace-acceptance-checklist.md). The earlier interactive sketch illustrates selected scientific states; its missing utilities, training fixtures and simplified local interactions are not implementation defaults. This specification governs where it is more detailed. No placeholder screen, inert control, bypassing legacy endpoint or untested migration may be described as finished.

**Scope boundary:** repair the complete sample workflow and the existing callers that can change or present its state. Reuse the current workbench, reception, spectral ingestion, inventory and reporting foundations. Do not rebuild those systems wholesale, add universal instrument support, or expand admin privileges as a shortcut. No software plan guarantees zero defects; release requires demonstrable conformance and zero unresolved critical/high defects within this scope.

## 1. Decision

Replace the sample detail page with a **sample workspace**: one trustworthy view of identity, physical material, ordered work, evidence, review, released reports, and history. Keep method-specific entry shared with the workbench. First fix server command rules; then replace the interface. A visually disabled button is never an approval control.

Four separate concepts must remain visible:

1. **Intake accepted** — material/request accepted into the laboratory.
2. **Result reviewed** — a particular submitted result version or spectral attempt accepted by an authorized reviewer.
3. **Report released** — an authorized, immutable report version made available.
4. **Material archived/disposed** — a physical custody event, independent of the scientific record.

Do not expose a general status dropdown or a universal “Approve selected” operation. Use specific commands with explicit evidence requirements.

## 2. What the supplied sample actually shows

Example: [S003](https://lims.yigini.net/samples/697b6508-94dd-4de7-ae2f-a9389fb5e131), observed as Marcos A., LAB_TECHNICIAN.

- Header: ACCEPTED; progress: ANALYSIS, 60%; “Gates Done”, “5/6 Submitted”, “5/6 Approved”.
- Default “My Assignments” gives “Analytical results (0)” and an empty table. Switching to All reveals eight tasks, including two preparation gates.
- Drying and preparation: ACCEPTED, unassigned, result “–”.
- Zn, Fe, Cu, Mn and B: ACCEPTED, unassigned, result “–”.
- pH: NOT ASSIGNED, result “–”.
- Audit: intake at 00:02; seven bulk work-item acceptances at 00:03; pH added at 00:11. One event renders “Generated analytical work item: undefined”.

This establishes a visible evidence gap, not proof that no physical testing occurred. Preserve these records and investigate; never fabricate results or infer submission timestamps from accepted status. The new design must show **“Historical approval — evidence needs verification”** for such records, rather than depicting them as fully reviewed.

## 3. Verified source findings and priorities

Paths are relative to repository root. Line anchors refer to the inspected baseline and may move. P0 items are prerequisites for deploying the redesign, not reasons to stop planning.

**Concurrent-change qualification:** at the final revision check, uncommitted edits in `WorkItemsTable.jsx` and `workItemController.js` added single/bulk acceptance guards. They reject some unstarted work, but still allow **COMPLETED without SUBMITTED**, and exempt archiving/disposal tasks from those state checks. They do not implement the common evidence/scope/QC/transaction service required here. S01/S02/S12 describe the audited baseline; their acceptance cases remain unresolved until the strengthened rules pass. Rebase implementation work on these edits instead of overwriting them. Their production deployment and runtime tests were not verified in this planning turn.

| ID | Priority | Evidence | Consequence and required correction |
|---|---|---|---|
| S01 | P0 | `workItemController.js:1334` bulk review; `workRoutes.js` review routes | Bulk review has a role gate but no per-item lab scope, submitted-state, result-evidence or QC checks in the handler. It writes requested status; it lacks the single handler's allowed-status whitelist. Validate every ID and every transition before any mutation. |
| S02 | P0 | `workItemController.js:1092` single review | Single review allows accepted/reanalysis/waived without requiring current SUBMITTED state or evidence. No per-item scope check appears in the handler. Share the same review service as submissions and bulk review. |
| S03 | P0 | `SampleDetail.jsx:324` final approval; `sampleController.js:398`; `workflowContract.js:28` | UI calls generic `/status`, not `/approve`. ACCEPTED → APPROVED exists in the graph; generic status handler checks graph/permissions but not analytical evidence. Close the alternate route. The service still validates the graph, so do not describe the local manager-override branch as bypassing every transition. |
| S04 | P0 | `sampleController.js:1790` | Dedicated approval treats COMPLETED as acceptable, passes an empty work-item list, and lacks sample scope in this handler. It also rejects WAIVED although other calculations accept it. Require current order coverage and accepted submitted evidence; distinguish authorized omission from accepted result. |
| S05 | P0 | `sampleController.js:1832`; `workItemController.js:1175,1395` | Approval cascades to multiple pending/validated spectra by sample or lab sample code. MIR review can affect unrelated NIR/other attempts. Only review exact linked current scan IDs and selected attempts. |
| S06 | P0 | `reportController.js:25`; `reportAssembly.js:96` | Generate immediately publishes, without approval eligibility or sample scope checks in these functions. Assembly filters current/valid results but does not require accepted result versions. A “current” value is not necessarily reviewed. Separate preview and release, enforce scope, and bind release to reviewed versions. |
| S07 | P0 | `resultsController.js:101,205`; `resultsRoutes.js` | Legacy write/submit paths have role guards but lack the read handlers' sample scope checks. Saving can change sample submission status; submit checks some results, not complete ordered work or immutable submission membership. Route these through canonical execution/submission services. |
| S08 | P1 | `sampleController.js:1707` | Edit analyses can reopen APPROVED/ARCHIVED/DISPOSED whenever nonempty analyses are supplied, not only genuinely added analyses. Reconciliation occurs separately from sample update. Introduce order revision, physical availability checks, atomic changes and no-op detection. |
| S09 | P1 | `sampleController.js:1852` undoApproval | Resets all ACCEPTED items and deletes post-analytical tasks; allows disposed material to return to processing. Replace with targeted amendment/recall. Preserve custody and historical acceptance. |
| S10 | P1 | `SampleDetail.jsx:223`; `submissionController.js:283` | UI sends `{status,note}` to a handler expecting `{decisions:[...]}`. “Accept all” submission UI is contract-incompatible. Build a typed command client and integration test the real payload. |
| S11 | P1 | `SubmissionPanel.jsx:14`; `submissionController.js:27,67` | UI's completed eligibility omits ownership and operational gates; full-submission backend includes non-post gates and requires selected work owned by the caller. “Submit all eligible (Full)” can promise an impossible action. Show eligible owned work and server-computed remaining coverage. |
| S12 | P1 | `WorkItemsTable.jsx:264,629` | Bulk approval selection has broader behavior than per-row readiness; per-row review also permits a result-bearing task without submission. Remove parallel policy calculations. |
| S13 | P1 | `reportController.js:37` | Version uses count of currently published reports, which can repeat version 2 on later releases. Existing reports are superseded before successful assembly/create. Allocate monotonic version under transaction and publish/supersede atomically. |
| S14 | P1 | `reportAssembly.js:34,77,112` | Assembler selects a lab manager/default method rather than solely recorded authorization and executed method revision. Snapshot actual signatory and method revision used; never infer signature from current staffing. |
| S15 | P1 | `workflowEngine.js:339` | Submitted and approved counters are inferred from status strings, including WAIVED. S003 therefore looks submitted without demonstrated submission records. Derive evidence/review coverage separately; show omitted counts explicitly. |
| S16 | P1 | `sampleController.js:995` | GET detail performs background assignment repair. Make reads side-effect-free; move repair into audited migration/maintenance commands. |
| S17 | P2 | `roles.js:75`; page and submission role arrays | MASTER_USER and SUPER_ADMIN behavior differs among routes and UI; global privilege is conflated with scientific review authority. Centralize capabilities, resource scope and reviewer authorization. |
| S18 | P2 | Live sample page | Duplicate identity/project blocks, large header, results below fold, nested table scrolling, mixed Spanish/English, generic STD methods, hidden other analysts' work and audit “undefined”. Fix information hierarchy and localization. |
| S19 | P0 | `workbenchController.js:1328` commitSubmissions | Alternate workbench submit writes submission, tasks and sample separately, has no explicit sample scope check here, broadens manager selection beyond own work, and writes legacy sample status `SUBMITTED` for full submissions. Reuse a transactional submission service with exact previewed evidence membership and canonical status projection. |
| S20 | P1 | `submissionController.js:412` | A decisions subset marks the entire submission REVIEWED. Undecided items can become stranded because later review requires PENDING_REVIEW. Derive package state from item decisions; retain partial review and undecided items. |
| S21 | P1 | `SampleDetail.jsx:132`; `NotificationContext.jsx:250`; spectral/work-item event emitters | Detail requires `sampleIds`; many emitters send singular `sampleId`. NotificationContext fans out event names but does not normalize this payload. `SUBMISSION_CREATED` is not handled by this switch. Define and normalize one committed-event envelope; test actual emitters and consumers together. |
| S22 | P1 | `SampleDetail.jsx:139` | Draft broadcasts patch the `result` field, allowing provisional values to be interpreted by legacy result-bearing checks. Keep draft values separate from scientific evidence and apply draft visibility rules. |
| S23 | P1 | `SampleDetail.jsx:58,80`; `useSampleWorkflow.js:34` | Fetches have no request identity/version guard for fast sample navigation; report failures collapse to no report. Prevent late response A from populating sample B; differentiate absent, forbidden, unavailable and stale data. |
| S24 | P1 | `reportController.js:107,138,265,333,360` and routes | Inspected report detail/latest/share/list-links/revoke handlers do not validate resource scope; route authentication/role checks alone do not provide it. Latest lookup falls back to any report state. Scope through report → sample; return explicit released, draft, superseded and withdrawn records. |
| S25 | P1 | `WorkItemsTable.jsx:138,169,179` | Evidence viewer selects an approved/first sample-modality scan rather than the task's exact attempt; fallback chart values become zero when missing. Open exact linked evidence; invalid or missing series must not become fabricated data. |
| S26 | P1 | `LabelPrintDialog.jsx:46,129,195` | “Accepted Only” means `status !== REJECTED`, including expected and other rejected-state names. Branding fetch uses admin settings. Use canonical label eligibility and a minimal readable branding projection without broadening admin settings access. |
| S27 | P1 | `IntakeRequestCard.jsx:10,87` | Missing/nontrue nonConformance displays CONFORMING; missing checks are hidden. Derive conforming only from a complete applicable checklist; unknown is Not assessed. |
| S28 | P1 | `AnalysisUpdateModal.jsx:19,27,53` | Incoming sample changes can reset an open form; selected group can survive reopening when no group exists; bundle replacement drops selections before impact review. Reset on sample/order identity, protect edits, and distinguish add bundle from explicit replace preview. |
| S29 | P1 | `receptionController.js:616`; sample accept/generation paths | Reception acceptance and work generation are separate; failed generation is caught after intake state persists. Commit order and generated tasks atomically where possible; otherwise expose an explicit generation-failed blocker with an idempotent repair command, never Ready. |
| S30 | P2 | `sampleController.js:1586` metadata update | Field overwrites record current editor provenance but audit lacks value-level before/after. Preserve original source values and append attributed corrections, including report impact. |
| S31 | P2 | `ContextPanel.jsx` | Imported legacy panel contains hard-coded custody location “Lab Storage - B2”. It is not established as mounted on this page. Remove any reachable placeholder; do not reintroduce it while reusing components. |

Security conclusions are source-level findings, not production penetration-test results. The endpoint/caller contracts below cover these paths; verify the final implementation at HTTP and transaction level. Presence of permission middleware alone does not prove resource isolation.

## 4. Proposed interface

### Always-visible header

Breadcrumb → **S003** → field ID → project and owning lab. Human sample identifier is primary; UUID only in technical details/copy control. Distinguish `sampleCode` from `owningLabId` in the API; preserve legacy storage names through an adapter initially.

One operational summary: “Intake accepted · 6 ordered analyses · 0 verified results · review blocked”. No artificial percent. A contextual next action identifies the actual blocker and responsible role. Show material state separately, with aliquot/container, remaining quantity, storage location and custody where known; display “Not recorded” honestly.

Five sections:

1. **Work & results** (default): required analyses, method revision, assignee, execution state, evidence summary, QC, review state, next action. Preparation appears as its own compact prerequisite section, not analytical results.
2. **Review**: submitted packages and immutable evidence, decisions, unresolved QC and release readiness. Empty state says what is missing.
3. **Sample & request**: reception condition, client request, field metadata, order revisions, assignments, material containers and custody. Changes use context-specific commands.
4. **Reports**: preview, released version(s), amendments, authorized omissions, distribution history and recipient links.
5. **History**: immutable events grouped by work, order, custody, review and report; before/after, actor, time, reason, related entity. Unknown legacy actor stays unknown.

Keep workflow map as a contextual navigation link. Use the same readiness response as the map, registry, my-work and workbench. Opening sample detail from a queue preserves queue context and offers previous/next eligible sample without resetting filters.

### Role-aware behavior

Technician sees the whole authorized sample and their assigned work highlighted. “My work” is a clearly labeled filter with “0 assigned to you; 8 total”, not a misleading zero results heading. Open worksheet uses the same editor as workbench, scoped to this sample/task. A manager's priority is pending submitted evidence; reception's priority is acceptance conditions and request completeness.

Ineligible actions: show their reason when relevant to the user's role; hide actions outside their authority. Do not flood technicians with disabled administrative commands. Keyboard focus, visible labels, 44px touch targets on coarse devices, readable supporting text, persistent draft feedback and no hover-only explanations.

## 5. Canonical scientific workflow

### Result attempt

`Unassigned → Assigned → In progress → Recorded → Submitted → Accepted`

Recorded is validated technician completion, not reviewer approval. Draft is separately saved and is not a result state. Submission freezes evidence versions. A returned result requires a reason and opens a new evidence revision; physical reanalysis creates a new acquisition attempt, while a transcription correction explicitly reuses the preserved source acquisition. A technician may withdraw an entirely unreviewed owned submission with an audit event; a package with any reviewer decision must use targeted return/amendment. No editing evidence underneath a reviewer.

Package review is `Pending → Partly reviewed → Reviewed`; each submitted item has its own undecided/accepted/returned/authorized-omission outcome. Reviewing one of three items leaves two reviewable. Saving a draft review records reviewer notes only; committing decisions applies exactly the explicitly selected decisions. No preselected acceptance decisions. Bulk review never includes operational gates, invisible rows, old attempts or already decided items implicitly.

### Review eligibility — mandatory server checks

For each decision, within the same transaction:

- Caller authenticated, action permitted, owning lab/project scope allowed, active reviewer authorization for method/domain valid.
- Exact task belongs to requested sample, current order revision and submission item.
- Selected attempt is SUBMITTED, evidence versions match the submission snapshot, and none was superseded after reviewer loaded it.
- Required acquisition/result fields exist; zero is valid only when actually recorded; empty/placeholder is missing.
- Applicable preparation, method, instrument qualification and QC evidence satisfies the executed method revision. Missing/failed QC blocks; unknown/error is not pass. Warning acceptance needs authorized disposition and reason according to policy.
- No open nonconformance, stale derived calculation or relevant upstream change blocks the attempt.
- Reviewer is independent of the result author by default. Staff may hold both analyst and reviewer authorizations, but cannot review their own authored evidence under this default. If the lab needs an exception, implement a separately configured, audited authorization policy; a super-admin role must not silently remove scientific requirements. Report release may be performed by the same authorized reviewer who accepted the evidence; do not impose an unnecessary third signatory.
- Store reviewer, decision, reason, evidence IDs/hash, timestamp and policy version together. Emit notifications after commit via an outbox.

Bulk review uses exactly this service. Validate all requested IDs, reject duplicates/unknowns and return per-item blockers. Default all-or-nothing; let the user explicitly choose the eligible subset in a preview. Never silently approve a partial selection while announcing all succeeded.

### Whole-sample readiness

Evaluate the current active order lines, not whichever work items happen to exist. Each required line must resolve to accepted current evidence or an explicit authorized omission/cancellation with report consequence. Missing generated tasks are blockers. Zero ordered tests means no analytical certificate; use an administrative closure document if appropriate.

Preparation completion is assessed against applicable methods; do not force every method through generic drying/preparation defaults. A completed acquisition can count toward acquisition coverage but does not mean a predicted chemistry result exists.

Full release requires all required covered lines, resolved QC/nonconformance, authorized report content and exact accepted versions. Optional partial release must be an explicit laboratory policy: selected accepted results only, prominent “Partial report”, outstanding tests and scope listed. Partial review/submission is routine and does not itself release anything. A canceled/omitted test is never counted as a measured or accepted result. An all-omitted order cannot create an analytical certificate; use a separately labeled administrative closure record.

Receipt, execution, review, release and material are separate facts in the read model. Keep legacy `Sample.status` as a controlled compatibility projection during migration, not an independently editable field. Define one projection function and test every canonical state, including ACCEPTED, PROCESSING, SUBMITTED_PARTIAL, SUBMITTED_FULL, APPROVED, ARCHIVED, DISPOSED and RECEIVED_REJECTED. Never write legacy `SUBMITTED`. Preserve historical raw values alongside migration mappings; ambiguous cases are integrity issues rather than auto-corrections.

## 6. Safe result entry and spectroscopy

Share one method-aware editor between sample and workbench. It receives task ID, order line, attempt/version, method revision and capabilities. Never maintain two result-entry rule sets.

- Numeric: unit and reporting basis fixed by method; decimal locale handled; distinguish not tested, missing, zero and `<LOQ`; show raw vs calculated/reportable values. Validate domain and method limits with actionable text.
- Multi-analyte instruments: import a run/batch, preview sample mapping and method, identify duplicates and unmatched labels. Commit mapped evidence atomically; preserve original export/checksum and provenance.
- MIR/NIR: upload/link original spectrum export; preview axes, units, instrument, acquisition time, replicates, QC and exact sample/task/attempt. Show “Spectrum recorded”, not a scalar reflectance field. A source file without a successful parse cannot complete acquisition. Unsupported proprietary format is an explicit blocker/export instruction, not guessed support.
- Spectral library is a view of linked acquisitions and curated datasets. Scientific review of one task must not approve every scan sharing a sample code. Dataset curation approval and sample-result review remain distinct decisions.
- Predictions are separate outputs with model/version, preprocessing, applicability/out-of-domain diagnostics, uncertainty where supported and parent scan. No model means no predicted analytes. Review the prediction evidence before reporting it as PREDICTED.
- File uploads can be resumable/retried with idempotency, malware/type/size validation and durable storage; do not autosubmit results when upload completes.

Draft feedback: Saving → Saved at time → Offline/failed. Keep unsaved text on validation failure, navigate only after a deliberate save/discard decision. Refresh after remote changes must not overwrite a draft. Show a conflict comparison and retain both edits until resolved.

## 7. Orders, corrections and amendments

Never reopen physical disposal. Never reset every accepted analysis to fix one result.

| Situation | Allowed operation | Preservation rule |
|---|---|---|
| Before intake acceptance | Reception edits draft request | Record request change; no scientific history to rewrite |
| Accepted, no affected work started | Authorized order revision | Add/cancel lines with reason and dependency preview; retain canceled lines |
| Affected work started or evidence exists | Manager approves order change | Preserve work/evidence; cancel future work or add a new line/attempt; resolve cost/material impact |
| Submitted result needs correction | Withdraw if allowed, otherwise return for correction | Freeze old submission and review; new attempt/version |
| Accepted result needs correction, report unreleased | Targeted amendment | Invalidate only affected current acceptance/derived dependencies; retain historic acceptance |
| Released report contains an error | Report amendment/recall | Keep old snapshot; mark superseded or withdrawn with reason; release new version and track notifications |
| New test requested after report release | Supplemental order | Prior valid report stays valid unless the change affects it; new work and subsequent supplement are explicit |
| Archived material | Retrieval request | Location/custody/quantity verified before work starts; archiving event remains |
| Disposed material | Recollection/new linked sample or verified retained aliquot | Never resurrect disposed container; prevent new physical testing on it |

Order-change preview must show additions/removals, method changes, affected preparations/aliquots, assignments, active submissions, accepted evidence, reports and requested disposal. No-op saves make no revision and do not change lifecycle. Material availability unknown blocks execution until verified.

Metadata corrections are also categorized: clerical correction, scientific identity correction, ownership/scope change. Correcting a field label can require report amendment if it appeared on a released report; it must not silently rewrite its snapshot. Project/lab transfers require explicit custody and scope handling, never a metadata edit backdoor.

## 8. Permissions and ownership matrix — proposed default

All actions are scoped to authorized resources; role alone is insufficient.

| Action | Reception | Assigned technician | Authorized reviewer/manager | Admin/master | Viewer/auditor |
|---|---|---|---|---|---|
| View sample | Scoped | Scoped | Scoped | Authorized scope | Scoped, redacted as applicable |
| Receive / record condition | Yes | Only separate permission | Yes | Separate permission | No |
| Accept intake | Configured acceptance authority | No by default | Yes | Separate authority | No |
| Edit draft request | Yes | Propose only | Yes | Permission | No |
| Change active order | Request | Request | Approve | Permission + domain authority | No |
| Assign/reassign | No | Request handover | Yes | Permission | No |
| Record/submit evidence | No | Own active work | If acting as authorized analyst | Analyst authority required | No |
| Review evidence | No | No | Submitted evidence, independence policy | Reviewer authority required | No |
| Release/amend reports | No | No | Release authority | Release authority required | No |
| Record storage movement | Custody permission | Custody permission | Yes | Permission | No |
| Authorize disposal | No | No | Disposal authority | Disposal authority | No |

MASTER_USER treatment must be resolved centrally, not inferred differently in components. Include multi-lab technicians and delegated reviewers explicitly. Reassignment never changes who performed historical work. Require handover reason for active work; preserve draft ownership and prevent access to another technician's unfinished private draft unless policy grants takeover.

## 9. Data and command architecture

Keep existing entities and add versioned relations incrementally rather than replacing the database wholesale.

- `SampleOrderRevision` and `OrderLine`: method revision, required/optional, canceled/omitted reason and authorization, predecessor line.
- `WorkAttempt`: work item, order line, attempt number, executed method revision, author, material/aliquot, instrument and QC links, version.
- `Result`: link to attempt and immutable result revision; existing `isCurrent/supersededBy` retained but uniqueness enforced per relevant attempt/analyte/replicate. Current does not imply accepted.
- `SpectralData`: use existing workItemId/attemptNo/isCurrent; strengthen attempt/evidence linkage and exact review references.
- `SubmissionItem`: normalized links to attempt/result/scan IDs and frozen evidence hash, replacing JSON-only membership over time.
- `ReviewDecision`: append-only decision with evidence version, actor, authorization, reason and policy version.
- `SampleAmendment`: reason/type, affected order/results/reports, impact assessment, authorization and resolution.
- `MaterialContainer`/custody events: retained aliquots, location, quantity and disposal; reuse existing physical inventory structures where possible.
- `Report`: monotonic unique `(sampleId,version)`, snapshot of exact accepted evidence, order revision, authorization, release/withdrawal/supersession relationship. Existing snapshot content is a useful foundation.
- `CommandReceipt`/outbox: idempotency key, commit outcome and reliable downstream events.

Introduce `sampleWorkspaceService` (read-only) and command services for execution, submission, review, order change, release and custody. The existing state service remains an internal transition utility; it is not the domain authorization boundary.

Read response includes identity, material, order revision, tasks/attempts, evidence summaries, submission/review records, report versions, integrity issues and action capabilities. Each capability has `allowed`, reason codes, human explanation and relevant entity/version. Capabilities are hints; every command revalidates transactionally.

Proposed command contracts:

| Command | Inputs beyond resource ID | Key check |
|---|---|---|
| Record attempt | Expected version, evidence, method/instrument references, idempotency key | Ownership, prerequisites, typed validation |
| Submit attempts | Exact attempt/evidence versions, note | Recorded valid evidence, ownership, no active conflicting submission |
| Review submission | Decisions `{submissionItemId, verdict, reason, expectedVersion}` | Submitted snapshot, scope, QC, authorization |
| Preview order revision | Proposed lines, reason, expected order version | Read-only impact graph |
| Apply order revision | Preview hash, expected versions, authorization | Recompute impact; atomic application |
| Preview report | Explicit accepted evidence scope | Marked DRAFT, no publication/supersession |
| Release report | Preview hash, order/review versions, signoff | Revalidate complete scope and save immutable snapshot |
| Open amendment | Type, reason, affected IDs | Targeted impact, preservation, material eligibility |

Errors: 403 permission/scope; 409 stale version or invalid transition; 412 unmet prerequisites; 422 invalid scientific evidence. Return structured blockers. No success toast before confirmed commit. Do not catch transition failures and continue scientific state updates.

## 10. Connections that must migrate together

| Surface/system | Required connection |
|---|---|
| Sample detail + workbench + my-work | Shared attempt editor and submission service; same capabilities/readiness; preserve drafts |
| Registry + workflow map | Same order coverage and integrity flags; show evidence gaps instead of trusting accepted strings |
| Single/bulk work review + submissions | One review service; old endpoints adapt to it or reject with migration guidance |
| Spectral upload/library/review/trash | Exact scan/attempt links, immutable reviewed evidence, amendments for accepted scans |
| Legacy results save/submit | Adapter to attempt commands or retirement after caller inventory; no alternate release path |
| QC batches + equipment | Applicable method requirements; batch hold/retest invalidates affected release eligibility |
| Preparation + inventory/custody | Method-specific prerequisites, material availability, preserved completion evidence |
| Reports/PDF/search/public links | Accepted version snapshots, scope on internal reads, explicit superseded/withdrawn behavior |
| Reception/Kobo/project metadata | Stable identity; provenance; no sync overwrites of laboratory-owned or released identity fields |
| Notifications/websocket | Committed events only, consistent event naming, refresh capabilities without discarding drafts |
| Audit/export | Stable entity links, reasons, no inferred actor/signature, consistent locale/time zone |

Inventory all callers of `/samples/:id/status`, `/work/*/review`, `/results/*`, `/submissions/*`, `/reports/*` and spectral lifecycle handlers before retirement. Include scripts, administrative pages, batch tools and tests, not only SampleDetail imports.

## 11. Delivery structure

Use the single package sequence P1–P7 in section 18. Each package supplies integrated behavior and test evidence; section 19 defines final completion. The companion checklist is the authoritative executable acceptance inventory. Earlier phase proposals are replaced by that sequence.

For existing S003, inspect original worksheets/imports and reviewer history before deciding whether to register traceable legacy evidence or require new analysis. Record actual discovery time and original evidence date separately. No migration or prototype may substitute fabricated evidence for this investigation. Production verification is read-only on real samples; synthetic execution stays in an identified test environment.

## 12. Core test scenarios — overview

1. Fresh intake with required lines but zero generated work: approve/release denied with missing-task blockers.
2. Fresh assigned/unassigned tasks with no evidence: single, bulk and submission review all denied; no state changes/audit success.
3. Completed valid but unsubmitted evidence: acceptance denied. Normal submit → review succeeds.
4. Forged cross-lab IDs, mixed-lab bulk IDs, duplicate/missing IDs and tampered status values: rejected consistently, no partial updates.
5. Reviewer is author; inactive reviewer; unauthorized domain; MASTER_USER/SUPER_ADMIN without scientific authority: expected configured denial.
6. QC fail, missing required QC, QC service error and unresolved warning: fail closed for review/release; explicit authorized warning disposition works.
7. MIR and NIR on one sample with multiple attempts: accepting one only changes selected evidence; no sample-wide scan cascade.
8. Zero, blank, `<LOQ`, decimal comma, incompatible unit, stale method, invalid numeric value: correct distinct handling.
9. Two technicians: each submits owned work; partial review does not hide remaining work; full scope is calculated server-side.
10. Two reviewers, double-click and retry after timeout: one decision/receipt; stale version conflict retains screen context.
11. Result edit while review screen open; order change while release preview open: release/review rejected until refreshed.
12. Supplemental order after release preserves old report; scientific correction creates targeted amendment; unrelated accepted results unchanged.
13. Archived retrieval requires material evidence; disposed container cannot become available through edit/undo/status endpoints.
14. Report versions 1,2,3 under concurrent requests; failed rendering cannot supersede existing report; stored signature equals actual authorizer.
15. Internal report/PDF/search/link endpoints enforce scope; withdrawn public report behavior and expired/revoked token behavior tested.
16. Draft offline/reconnect, upload retry, websocket refresh and navigation interruption preserve user work without accidental submit.
17. Read endpoints perform zero writes; migration dry run changes nothing; historical anomalies remain visible.
18. Keyboard-only review and form correction; 360/768/1024+ widths, light/dark, English/Spanish, long translated labels and screen reader state announcements.

These are the principal scenarios; use the companion [delivery acceptance checklist](sample-workspace-acceptance-checklist.md) for the complete case IDs and evidence record. Test service logic in isolation and HTTP contracts against an isolated database. Existing source-contract tests are useful but insufficient: they must assert mutation outcomes and negative cases, not merely search for permission strings. Do not run unknown test suites against a production-configured database.

## 13. Practical policy defaults and unresolved choices

Proceed with these defaults in implementation planning: independent review, no blanket approval bypass, partial submission allowed, full report release by default, authorized omissions explicitly labeled, separate custody state, and amendment preservation. Confirm against the laboratory SOP before enabling optional partial release, reviewer exceptions, retention periods, disposal authorization and external distribution. Exact instrument parsers depend on real exports; do not promise universal proprietary-file compatibility.

WHO's [review and authorization guidance](https://extranet.who.int/lqsi/content/start-reviewing-and-authorizing-results-ie-validation-results-releasing-report) supports checking recorded evidence, QC and report completeness before authorized release. Its [recording/reporting guidance](https://extranet.who.int/lqsi/node/147) emphasizes traceable amendments. These are useful operational references from health laboratories, not a declaration that this soil LIMS complies with ISO 17025 or that clinical requirements automatically apply. The lab's own approved SOP and applicable accreditation requirements govern the final policy.

## 14. Handoff to implementation agent

Implement packages P1–P7 in section 18. Start by reproducing the approval, report and alternate-submission gaps S01–S07 and S19–S20 in isolated tests. Do not merely hide approval buttons or change status labels. Preserve existing data and recent spectral linking improvements. Provide the endpoint/caller inventory, migration dry-run report, negative-test results, UI pilot evidence and deployment commit before claiming completion. The accompanying mockup uses fictional evidence/scenarios and performs no platform writes; it is a behavioral design reference, not proof of deployed behavior. Section 19 is the final handoff/definition of complete.

## 15. Existing-control preservation contract (screenshot follow-up)

The first interactive concept concentrates on scientific states and is not a complete inventory of existing utility controls. Implementation must preserve the functions below. Do not interpret absence from that sketch as authorization to remove them.

| Existing control/information | Redesigned location and behavior | Permission/state requirement |
|---|---|---|
| Back arrow | Labeled Back to samples/Back to workbench, preserving source filters and queue position; safe registry fallback for direct links | Available for navigation; protect unsaved draft before leaving |
| Droplet icon: Edit Analysis Selection | Visible **Manage analyses** action in header, opening current order and impact preview under Sample & request | Draft edits vs active-order changes vs post-release amendments use distinct capabilities; reception may request changes but not bypass manager authorization |
| Print label | Labeled **Print label** header utility; preview label format, specimen/container identity, barcode content and number of copies | Print current verified identity only; before accession, explicitly use a provisional/field label if supported, never invent an accession code |
| Workflow map icon | Labeled **Workflow map** header utility, retaining sample and return context | Scoped read; same readiness/coverage data as sample page |
| Audit Log button and floating audit handle | One **History** tab, with a header History shortcut where useful; event count from the same source | Scoped audit access; avoid duplicate independently controlled drawers/counts |
| Receive Sample | Primary next action when expected, opening prefilled reception with stable sample/project identity | RECEIVE_SAMPLE capability and owning scope; acceptance does not follow merely from opening reception |
| Approve Intake | **Accept intake** only at the appropriate reception stage | Authorized intake role and condition/request validation; distinct from scientific review |
| Undo Intake | **Correct intake** in Sample & request, previewing downstream impact | Simple reversal only before dependent work; otherwise correction/nonconformance workflow preserving records |
| Final Approve | Replace with **Review submitted results**, followed by **Authorize & release report** when eligible | No final-approval button on an EXPECTED sample; explain missing work in readiness rather than showing irrelevant disabled commands |
| Undo Approval | **Start amendment** for selected evidence/report, with reason and impact preview | Amendment authority; preserve historical decisions, no blanket resets |
| Archive / Dispose | Material section: request storage, record movement, authorize disposal, record completion | Separate authorization and physical execution; material/retention/active-work checks; never a generic sample status edit |
| Generate / View report | Reports tab; header **View report vN** shortcut after release | Generate preview is distinct from release; scoped PDF/print/share actions, version and validity clearly shown |
| Drying / Prep gate dots | Preparation summary with explicit state, evidence and **View preparation** drill-down | Method-specific requirements; distinguish missing, pending, completed, verified and not applicable |
| View Full Field Data | **View full field data** under Sample & request; optional compact header context link | Retain field metadata, source provenance, collection details and map; scoped/redacted as required |
| Project / sample type / priority | Compact identity context with labeled details under Sample & request | Metadata corrections audited; changing project/scope is not an unrestricted inline edit |
| Collection date / coordinates / site | Field-data summary and full detail/map | Keep collection, import and reception dates distinct; no inferred site from coordinates |
| Analytical Workspace / Workflow Timeline | Work & results / History, with the workflow map still separately available | Preserve task-level evidence, assignment, handover and event drill-down |

### Two additional data-label defects exposed by the screenshot

1. **“Date Received” can be fabricated by presentation.** `SampleSummary.jsx` falls back from `sample.receptionDate` to `sample.createdAt` under the same Date Received label. For an EXPECTED sample, show **“Not yet received”** unless a genuine reception event exists. If a reception date exists while status remains EXPECTED, flag the inconsistency rather than silently hide evidence. Show Record created/imported separately.
2. **“MOZ-LAB1” is displayed as Sample ID.** The component uses `sample.labId || sample.originalId`. This looks like a laboratory code, but the screenshot alone cannot prove the field's underlying meaning. Verify accession identity against the source data; display **Field ID MOZ0489-2-1C**, **Lab sample code: not assigned** when genuinely unassigned, and the verified owning laboratory separately. Do not migrate or rename identifiers solely by pattern matching.

### Utility acceptance tests

- Back from reception/map/workbench preserves origin and draft state; direct links have a valid fallback.
- Label preview/barcode identifies the sample/container, not its owning laboratory; initial and repeat printing do not change workflow status.
- Expected sample has no misleading received-date fallback or scientific approval action.
- Field-data expansion preserves all currently available fields and source attribution; permissions apply to edits and sensitive fields.
- Manage analyses is discoverable by visible text; its available operations reflect lifecycle and capability.
- History count, tab and any shortcut resolve to the same event set; empty/error/loading states remain distinct.
- All retained utilities work with keyboard, localized labels and narrow layouts. On narrow screens, move secondary utilities into a labeled More actions menu; keep the current primary action visible.

## 16. Complete page behavior — mandatory delivery requirements

### 16.1 Page shell, identity and navigation

Desktop header: Back, human sample code, field ID, lifecycle facts, owning laboratory, project, priority and due date if recorded. Utility actions: Print label, Workflow map, Manage analyses (when authorized), and More actions. A released report gets a View report vN shortcut. History is a tab; avoid a competing floating drawer. On narrow screens, move secondary utilities into the labeled menu; keep identity and the current primary action visible. Do not shrink labels to fit.

Preserve the actual current brand/theme and application navigation, including concurrent branding work. Five tabs remain Work & results, Review, Sample & request, Reports and History. Page route is still `/samples/:id`; section and selected work item can be reflected in query parameters without storing scientific content in the URL. Existing bookmarks continue to resolve.

The primary action is computed by action capability, actor and current blockers, not merely sample status. A viewer has View evidence/History, not an actionable release button. A technician with no assignment sees the whole authorized order and an explicit no-assigned-work message. A manager sees unassigned work, blocked work or submitted review as appropriate. For EXPECTED samples the next action is Receive sample; analytical approval is absent.

Identity resolution uses immutable sample ID internally and distinct accession code/field ID/owning-lab fields in every component, label, export, upload matcher, audit entry and link. Scope must never be granted because an accession code happens to equal a laboratory code. If legacy identity is ambiguous, expose an integrity issue and prohibit final labels/release until resolved; browsing original evidence remains possible. Do not change IDs based on a string pattern.

### 16.2 Reception and sample/request data

Retain reception's duplicate detection, consignment link, requested bundle/tests, sample condition, nonconformance/photo evidence, quantity check and any existing field provenance. Reuse reception entry rather than create a second intake form with fewer checks. Opening it from sample detail carries stable sample/project IDs and a return route; a refresh or retry must not create a duplicate accession.

Required checklist fields have Not assessed, Pass, Fail or Not applicable with applicable reason. Missing checklist data never implies conforming. A reception-only user can receive and, when explicitly granted intake acceptance authority, accept the request. Conditional acceptance needs the authorized disposition and downstream limitations. Rejecting intake puts material in quarantine/rejected custody; it does not mean it disappeared or was disposed.

Collection date, creation/import time, physical receipt and intake acceptance are distinct. Date-only collection values retain their original calendar day across time zones. Events use UTC storage and a labeled local display timezone. Unknown priority is Not set; urgency does not become a made-up due date.

Field-data view retains existing populated fields, attachments and source metadata; unknown field keys remain inspectable rather than being dropped by a smaller redesign schema. Preserve original Kobo values plus later corrections. Field edits validate an allowlist, type, range and provenance; identity, project and lab changes trigger explicit impact checks. Metadata from integrations cannot silently overwrite laboratory evidence or released snapshots. Attachment/map failures are local errors with retry; they do not blank the sample workspace. No invented coordinates or fallback storage locations.

### 16.3 Manage analyses

One order editor supports individual tests and bundles. **Add bundle** merges deduplicated test selections; **Replace selection** is a separate explicit operation with a removal preview. Resolve overlaps and aliases through canonical analysis IDs. Method variants, revisions, inactive catalogue items and multi-output tests must be explicit. A later catalogue change must not silently change an existing order. Preserve any original bundle identity as provenance; do not claim a modified selection still exactly equals that bundle.

Show current, proposed and affected work together. Existing accepted/submitted evidence remains visible, even if its order line is canceled or replaced. Order changes require reason, current order version and an impact preview: preparation, sample mass, retention, aliquots, assignments, equipment/method availability, active submission, derived outputs and report consequences. A successful command updates the order, tasks, audit and receipt atomically and returns actual additions/cancellations; do not report “new work items generated” on every save.

A no-op save changes nothing. An empty request is explicit cancellation/administrative closure, not accidental deletion. Results cannot be erased by removing a test. A completed test can be marked excluded from a future report only through an authorized disposition; its evidence remains. Reopening the dialog resets stale errors/group choices for a different sample; background refresh does not reset user selections or notes.

### 16.4 Assignments, preparation and bench work

Assignment action offers only active, eligible staff for the task and resource scope. The server validates eligibility at commit. Keep assignedTo username compatibility internally if necessary, but display a stable person identity and human name. Preserve historical author when a user is renamed/deactivated. Bulk assignment lists exact tasks and the assignee; mixed eligibility produces a preview, not silent omission. Reassignment of active work requires handover and draft disposition; sealed evidence cannot be rewritten by reassignment.

Preparation is real operational work: material/container, method revision, instrument/station if required, operator, actual completion time and applicable checks. Do not create a synthetic "Done" measurement or force a manager signature for every ordinary preparation step unless the SOP requires it. Executing one valid shared preparation can satisfy multiple method prerequisites; methods requiring different fractions/preparation get distinct dependencies.

A prerequisite change computes the affected dependency graph. Block affected unfinished work; flag affected submitted/accepted evidence for investigation and recall assessment rather than erase it. Instrument/QC eligibility evaluates acquisition-time validity, not only today's calibration status. A later calibration expiry does not automatically invalidate previously valid testing; a retrospective equipment failure opens a targeted quality hold.

The sample editor and workbench share the current result-type resolver, draft storage, completion preview/commit and submission preview/commit implementation. Extend the existing `/api/workbench/v2/...` foundation rather than invent an unrelated pipeline. The sample page may open the same editor in a focused panel; bulk operations stay convenient in the workbench.

All supported method types must render: scalar, categorical/checklist, multi-value/derived result, instrument import and spectrum. An unknown result type is a configuration blocker, never a fallback scalar input. Use actual assigned method revision and units; STD/default catalogue method is not executed-method evidence. Show QC/instrument requirements only when applicable. Matrix validation works on the current applicable analytes; spectral-only orders do not require unrelated wet-chemistry parameters.

Draft autosave is separate from Record completion. Record completion is separate from Submit for review. Enter advances data entry within a worksheet; it never submits, accepts or releases. A “0.00” placeholder cannot become a stored zero. Pasted multi-row data needs row/sample mapping and a validation preview. Draft errors retain text; save/complete/submit receipts include only the actual committed items.

### 16.5 Evidence inspection and review

Work rows distinguish Requested, Assigned, In progress, Recorded, Submitted, Accepted, Returned, Omitted and Canceled, with count definitions below. Each row exposes the current evidence and previous attempts. Managers cannot overwrite a technician's result while reviewing; they return a specific item with a precise reason.

Evidence inspector includes original source, units/basis, method revision, instrument and acquisition time, replicate/derived relationships, validation/QC, actor, submission snapshot and prior changes. Scalar values and spectral arrays remain distinct. A file attachment's presence alone does not prove a valid result. MIR/NIR viewer and download open the exact scan linked to the selected attempt; show raw vs processed signal with processing provenance. If an existing linked file is unavailable, show a recovery blocker and preserve its reference; never select another sample scan as substitute.

Review decisions are per submitted evidence item. Accept, Return for transcription correction, Request reanalysis and Request/authorize omission have different consequences. A rejection/omission needs a specific reason; static text such as “Inline Manager Review” is not meaningful justification. Bulk acceptance is an explicit subset of eligible submitted evidence after inspection; row and bulk paths share identical rules.

Counts are parallel facts, not one completion percentage:

- Ordered: active required/optional order lines, with canceled lines shown separately.
- Recorded: lines with current recorded valid evidence; acquisition counts do not imply predicted chemistry.
- Submitted: actual current submitted evidence snapshots, including already decided snapshots as history where labeled.
- Accepted: current accepted reportable evidence only.
- Omitted: independently authorized omissions, never added to measured-result count.
- Blocked/needs attention: affected lines with current blocker reasons, including historical evidence anomalies.

Coverage can be complete with declared omissions, while accepted-result count is lower. Reviewer can see a clear scoped statement such as “4 results accepted; 1 test omitted with authorization; 1 pending”. No “5/6 approved” ambiguity.

### 16.6 Reports, amendments and material closure

Report preview is a draft snapshot with explicit scope, actual methods, result provenance, review evidence, omissions and signatory. A spectral-acquisition-only order produces a spectrum/acquisition deliverable with defined axes and source references; it does not create an empty chemistry certificate or an agronomic interpretation of absent analytes. Measured, predicted and derived values are labeled and traceable. Multi-analyte results and report coverage must follow the method's output contract.

Report release revalidates the preview's evidence/order/review versions. Atomically allocate the next version using all historical versions, create the authorized snapshot and applicable supersession relationship. Rendering before publication must succeed and correspond to the same snapshot. A repeat request with the same idempotency key returns the same report; it does not issue another version.

View, PDF, print and share refer to a specific report ID/version. Opening a report never regenerates it from current data. A missing current report, a revoked scope, an unavailable service and a withdrawn report have different UI states. Retain the ability to inspect historic versions internally with clear status. Addendum reports relate to the prior report without falsely invalidating unaffected prior results.

For an error correction, open an amendment tied to affected evidence; for new testing, open a supplemental order. Metadata-only corrections can proceed without physically retesting disposed material. Physical reanalysis needs available verified material. A valid archived sample needs a custody retrieval event; disposing one container cannot mark all retained aliquots disposed.

Public link policy for initial implementation: a token identifies one immutable report version, not “latest sample”. Revoked, expired or withdrawn reports do not expose valid-looking report content. A superseded version is clearly marked and cannot silently redirect to a newer report the token did not authorize. New-version access requires an authorized link/distribution action. Existing downloaded copies cannot be recalled technically; retain recorded recipient follow-up and acknowledgment when a quality incident requires it. Do not send messages automatically just because a user opens an amendment.

Archive/disposal actions require known location/material, retention rules and no unresolved relevant work/hold. Unknown retention policy blocks disposal with an actionable reason. Material authorization and actual execution are distinct events with actor/time/location/quantity; use existing custody/inventory models where available. The scientific record remains accessible after disposal. Routine physical events may use a compact form, not a separate administrative project.

### 16.7 Labels, history and supporting utilities

Keep both current label formats (101×54 mm and 50×25 mm), QR generation without a third-party API, preview, single-sample and existing batch printing. Clearly distinguish provisional field label and accession/container label. QR payload must resolve unambiguously under the current identity policy and cannot itself bypass access control. A scanner wedge must not accidentally trigger a scientific command. Print dialog creation is not proof of successful physical printing; record print requested, not printed, unless a printer integration supplies delivery evidence.

“Accepted Only” uses explicit canonical accession eligibility, excluding rejected/quarantined states unless the user deliberately selects a clearly marked quarantine label. Preserve historical codes/aliases as needed for old physical labels. Label format does not reset on every websocket update. Missing branding uses a readable approved fallback; it must not block essential labeling or require technician access to administrative settings.

History is immutable and paginated with stable event IDs, not a synthetic timeline that duplicates the same event from multiple JSON sources. Show UTC/local times consistently, actual actor, reasons, before/after and linked affected entities. Unknown legacy values remain unknown. A legacy episode inferred from events is labeled inferred; new amendments have explicit IDs. Draft edits may have a separate scoped history and are not exposed as approved scientific evidence.

No exposed deletion/reset action may remove a received sample with scientific or custody history. Administrative duplicate cleanup must use an explicit policy and preserve cross-references; do not add a delete control merely to fill a More menu. Existing registry delete/discard routes must obey the same integrity rules.

## 17. Integration and transaction contracts

### 17.1 Existing callers to migrate or adapt

This is the source-inspected starting inventory. Re-run a caller search against the final branch because other development is active. Compatibility adapters use canonical services; they do not maintain a second policy.

| Existing path/family | Source-inspected consumer/producer | Required final behavior |
|---|---|---|
| Sample detail/map-state | `SampleDetail`, `useSampleWorkflow`, `SampleWorkflowMap` | One read-only projection, versions/capabilities, no GET repairs |
| Sample status/phase/approve/undo | SampleDetail and sample controllers | Generic status cannot approve/release/dispose; named commands validate domain invariants |
| Receive/accept/undo-intake and `/reception/intake`, consignments/discard | SampleSummary → reception; receptionController | Same intake/order-generation/custody rules for single, batch and direct API |
| Analyses/metadata/project | AnalysisUpdateModal; sampleController | Order/metadata revision commands with impact, scope and before/after |
| Work assign/reassign/start/status | WorkItemsTable, DataSheet, workItemController | Shared ownership/prerequisite/attempt rules; no alternate save/completion bypass |
| `/submissions` and review/reanalysis | SampleDetail, SubmissionPanel, ManagerQueue, MyWork | Exact immutable membership, partial decisions, scoped queues and returns |
| `/workbench/batch-save`, drafts and v2 preview/commit/receipts | Workbench; workbenchController | Shared draft/record/submit services; commit exact previewed versions rather than reselecting by sample ID |
| `/results/:sampleId`, submit/history | Legacy resultsController and API consumers | Adapt or retire; never approve/submit based only on existence of any result |
| Spectral preview/commit/upload/link-task | SpectraBatchUpload, WorkItemsTable, spectralController | Preserve current raw-file intake; exact identity/task/attempt evidence links |
| Spectral single/batch review/trash/restore/permanent delete | Spectral library and spectralController | No linked accepted/released evidence deletion or broad status propagation; amendments/retention rules |
| Reports generate/detail/sample/search/PDF | SampleDetail, ResultReports, reportController | Draft/release separation and consistent scoped version-specific reads |
| Reports share/links/revoke/public HTML/PDF | ResultReports, PublicReport | Scope through report/sample; immutable token scope; expiry/withdrawal/supersession policy |
| User directory/config/branding | WorkItemsTable, AnalysisUpdateModal, LabelPrintDialog | Minimal scoped eligibility/config projections; catalogue failures do not silently blank valid selections |
| QC/equipment/inventory + Kobo sync | Domain controllers and integration jobs | Recompute relevant blockers and preserve provenance; no rewriting released evidence |
| Notifications/websocket | NotificationContext, sample/workbench/map hooks and server broadcasts | Normalize payloads, emit after commit, invalidate by resource/version, never trust events as final authority |

### 17.2 Single command boundary

Command service resolves resources and authorization server-side, starts a transaction, re-reads expected versions, verifies state/evidence/relations, mutates only selected entities, writes the audit and idempotent receipt, updates the compatibility projection and creates an outbox event. Any failed invariant aborts the scientific mutation. Do not swallow audit/transition failures and report success. Keep optional operational access logging separate from the mandatory scientific audit.

The current backend uses SQLite with the better-sqlite3 Prisma adapter. Implement version compare-and-set and supported transaction behavior for that runtime; do not copy PostgreSQL row-lock SQL. Use existing WorkItem.version and draftVersion as foundations. Test two concurrent writers against the actual isolated adapter. Preview IDs are server-issued, actor/scope-bound, expiring manifests of exact entity versions; client-supplied hashes alone are not authority.

Idempotency scope includes authenticated actor, command type and target. Same key/same payload returns original committed outcome; same key/different payload is rejected. Timeout after commit exposes Unknown outcome with receipt lookup/retry using the same key, not an invitation to click again with a new key. Multi-sample operations return exact per-sample outcomes if using deliberate per-sample atomic transactions; default per-sample review/release remains atomic. UI counts and notifications must reflect that policy exactly.

File durability is separate from database atomicity: stage and validate original files; ensure durable referenced objects before marking evidence recorded; maintain recoverable staging state if commit fails. Failed files never produce completed work. Preserve source checksum/filename/parser/profile versions, avoid overwrite, and do not delete referenced original files in ordinary library cleanup. Backup/restore covers database and evidence storage together.

### 17.3 Shared update envelope and cache

Normalized committed event: `{eventId, eventType, sampleIds, affectedEntities:[{type,id,version}], occurredAt, commandReceiptId}`. Adapter maps current singular sampleId and plural sampleIds without changing domain meaning. Draft events carry draft metadata/version to authorized viewers separately; do not broadcast raw draft values to every user in the lab by default. Clients deduplicate eventId, reject older versions and coalesce refetches. Subscribe to intake, order, assignment, evidence, QC, submission, review, amendment, report and custody events, not only work-item updates.

All page queries are keyed by sample ID and authorization context. Cancel or discard stale responses when navigating or switching accounts. Do not show sample A's report in sample B's header while its fetch is pending. On successful command, use the receipt/version to refresh relevant query keys; do not depend solely on websockets. On reconnect/focus, refetch current readiness. Lost socket must not lose accepted data; drafts stay protected from replacement.

Distinct UI states: Initial loading; empty with explanation; scoped forbidden/not found; retryable unavailable; stale read with last-updated time; write pending; unknown outcome; conflict requiring refresh; saved; committed. Optional map/photo failure does not block unrelated bench work. If permission is revoked, stop writes and avoid retaining authorized data in a newly signed-in user's cache. Do not dump sensitive values into logs or error telemetry.

## 18. Implementation packages and release order

Each package must include working behavior, integration tests and updated acceptance evidence; "UI wired later" is not a completion state.

| Package | Changes | Exit evidence |
|---|---|---|
| P1 — canonical guards | Review/release scope and eligibility; protect single/bulk/status/results/workbench bypasses; exact spectral decisions | Negative HTTP tests for fresh intake, cross-lab IDs, missing submission/evidence and QC |
| P2 — transactional foundations | Versioned order/attempt/evidence references; idempotent commands/receipts; partial review; shared state projection | Concurrency, injected failure and duplicate-retry tests against isolated SQLite |
| P3 — reception/order/material | Atomic or explicitly blocked work generation; identity/date/checklist fixes; order-impact/assignment/custody forms | Receive→order→assign scenario, mass/material constraints, bundle/no-op/cancel tests |
| P4 — shared execution | Method-aware editor, workbench adapters, drafts/conflicts, exact spectral viewer/import, preview/commit parity | Sample→workbench→sample flow for numeric, spectral and multi-output methods |
| P5 — workspace and utilities | Full five-section UI, all section 15 controls, field data/labels/navigation/accessibility, normalized updates | Role/state visual coverage and functional utility tests, no inert controls |
| P6 — review/report/amendment | Partial decision flow, snapshot release, correct signatures/versions, supplemental orders and targeted corrections | Two-technician/manager flow, three report versions, disposed-material distinction, public link tests |
| P7 — migration and rollout | Integrity report, deterministic backfill, exception queue, backup restore rehearsal, pilot and deployment checks | Reconciled records, preserved artifacts, signed acceptance checklist, deployed commit/migration versions |

Dependency order: P1 before exposing new approval UI; P2 before write-enabled P3/P4/P6; P5 can be built against fixtures while services mature but cannot be released against stub APIs. P6 consumes P2/P4; P7 dry-run begins early but production migration follows tested packages. For an incremental deployment, old clients must either call protected adapters or receive an explicit refresh-required error; rolling back UI cannot restore unsafe behavior.

Migration uses additive schema changes first and keeps legacy read compatibility. Backfill deterministic relationships with a provenance tag and migration ledger. Add constraints only after duplicate/missing-link audit and reviewed reconciliation. Never infer author/reviewer/submission or create a fake result. Keep an unresolved record usable for investigation while blocking new release of its unverified evidence. S003 and the MOZ identity/date screenshot are regression fixtures; do not alter the live samples to make the demo look correct.

Before deployment, test backup restore of database plus original evidence files into an isolated environment and compare identifiers, counts and checksums. A data restore after new production writes needs an explicit recovery/replay procedure; do not promise that reverting a Git commit reverses a data migration. Feature flags may hide new UI, but scientific guards stay active.

## 19. Definition of complete and implementation handoff

The implementer must deliver the revised page, integrated services/adapters, migrations, tests and a completed [acceptance checklist](sample-workspace-acceptance-checklist.md). All mandatory cases must have recorded pass/fail evidence; no failing case can be relabeled complete because a button is hidden. Test failures remain failures until corrected. Optional policies disabled by default must show their explicit disabled state and still pass base workflows.

Required evidence package: exact source/deployed commit; database migration versions; endpoint/caller inventory with retire/adapt decisions; requirement-to-test mapping; real test output; data-integrity dry run and exception count; browser flows for each role; light/dark and narrow/desktop evidence; label scan/print verification on the lab's two supported media formats; actual supported instrument-export fixtures; report/PDF version comparison; backup/restore result and rollout recovery instructions.

Pilot acceptance is task-based: reception receives an expected sample and prints a correct label; two analysts complete different tests through different entry points; the reviewer accepts one and returns another; the corrected item is resubmitted; authorized user releases the correct report; an added test creates a supplement; a transcription correction preserves the old version; archived retrieval and disposed-material rejection behave correctly. Reconnect during a draft and timeout after a commit must recover without loss or duplicates.

No claims of ISO certification or “zero issues” from automated tests alone. The objective is a complete, traceable workflow with no known critical/high defects, all mandatory checks passing and a lab pilot confirming practicality. The user should receive a concise completion report stating what was tested, any remaining limitations, and how the production release was verified. Do not ask the user to discover forgotten controls after delivery.
