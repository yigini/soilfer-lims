# Workbench execution and Sample evidence — implementation plan

## 1. Outcome and boundaries

Implement on top of the latest dashboard/reception work. The technician must know: **what can I work on, what did I save, what needs submission, and who has it now?** The Sample page answers what was ordered, what happened to the material, what evidence exists, and what has been reviewed. Both read the same persisted facts.

Workbench is the only UI for laboratory execution: start/resume, preparation checklists, measurements, grouped texture, spectra acquisition, recording, technician submission, and authorized correction entry. Sample has no editable result cells, Mark Done, Save & Complete, direct Upload Spectrum, or alternate technician submission form. Its Open in Workbench action targets the exact work item/current attempt and proper view.

Keep Sample's reception/acceptance and hold controls, order revision/assignment, authorized manager review, amendments, label printing, workflow map, field data, storage/custody, archive/disposal, approved reports and audit access. Inventory each existing control before replacing WorkItemsTable; give every retained control an owner and tested destination. Read-only analytical results does not mean deleting legitimate management or material-handling functions.

Do not use a blanket manager bypass, turn all results into one generic status, or migrate old records merely to make the UI look consistent. This change must not introduce a second workflow engine alongside the existing services.

## 2. Two explicit lifecycles

### Routine preparation

Proposed default: assigned task → checklist in progress → **Confirm preparation complete** → immutable operational record → prepared material available for dependent work.

- Drying and preparation are physical operations, not scalar determinations. The checklist may collect method-specific observations (time, endpoint, temperature if the SOP requires it, sieve/fraction, equipment, rack, material/aliquot, exceptions). Never require an invented number just to finish.
- Resolve the applicable SOP and required stages by matrix, selected method and material. The current generic checklist can be an explicitly identified interim revision; it must not masquerade as a lab SOP with invented temperatures or preparation fractions.
- A technician confirms only their assigned eligible samples. For a rack, common run metadata is entered once; each selected sample retains its identity, checks and exception disposition. Selection does not auto-check SOP steps. No confirmation on behalf of unselected rows.
- Confirmation records checklist definition/version, answers/observations, actual actor, server confirmation time, observed operation time if provided, run and material references. An operation time supplied later is labelled retrospectively recorded; never backdate the audit timestamp.
- After confirmation, display **Preparation completed — recorded by [name] at [time]**, a durable receipt, and an Open next method action. On reopening, show the recorded checklist, not empty editable boxes. Do not send the technician through scientific Review & Submit for routine gates.
- Completion must not mean a human manager reviewed it. Use separate operational completion and verification concepts; avoid falsely setting reviewedBy/ACCEPTED by a person who never signed.
- If a lab SOP explicitly requires a second operational verification, configure `verificationRequired` and `unlockPolicy` on the versioned procedure. Confirmation automatically hands the record to **Preparation verification**. Technician sees Awaiting verification plus recipient; manager sees Verify preparation with exact evidence. Verification-required defaults to not unlocking dependent work until verified; any allowed earlier unlock must be an explicit SOP policy, not an incidental status shortcut.
- No new boolean defaults silently alter existing lab SOPs during migration. Inventory current gate policy; record the chosen mapping per lab/procedure in the release ledger.

### Scientific determinations

Assigned → Ready / blocked → optional saved draft → **Record results** → **Ready to submit** → **Send selected work for review** → Submitted → Accepted or Returned. After report release, corrections use the controlled amendment route.

- A draft is editable work, not a result, gate completion or reviewable evidence. Applicable receipt/preparation gates block even draft result entry. Allow viewing instructions and planning metadata while blocked, without recording unperformed measurements.
- Recorded means an immutable attempt/evidence snapshot exists. It must remain reachable until submitted, even after browser restart, method change or completion of the last assigned task.
- Submission may be partial by current order line. Show the exact sample/method/result count and exclusions. Do not require unrelated unfinished analyses just to send completed pH work for review.
- Review inspects the exact submitted attempt/evidence versions and applicable QC, not any nonempty WorkItem.result or any scan belonging to the sample. Returning work records a reason and creates/activates the correction attempt; prior evidence remains intact.
- A manager does not accept fresh, unrecorded or unsubmitted scientific work. Final sample approval requires complete coverage of the actual active order, resolved omissions, required QC and no integrity gaps. Operational confirmations alone never qualify.

## 3. Shared records and server contracts

### Authoritative relationships

Use the existing `SampleOrderRevision → OrderLine → WorkAttempt → WorkItem / evidence` and `Submission / ReviewDecision` structures where appropriate. Inspect actual migrations before adding fields. Choose one explicit current attempt per order line and replicate/run; add scoped uniqueness constraints where the current schema lacks them. Do not create a competing generic result model.

Operational evidence can be a typed WorkAttempt evidence payload, supplemented by procedure/verification fields where needed. It is not a chemical `Result` row. WorkItem.status and Sample.dryingStatus/preparationStatus become compatibility projections from that evidence and policy, not independent user-editable truths. Distinguish pending, completed, awaiting verification, verified, blocked and evidence missing in the read projection. If new persisted states are necessary, update schema, workflow contract, selectors, tests and migration together; do not persist display labels ad hoc.

One `buildWorkContext` loader provides actual sample ownership, reception state, active order revision, explicit order-line/current-attempt links, applicable preparation, assignment, method revision, material, instrument qualification, QC, evidence versions and scope. Shared evaluators return action capabilities with reasons; commands **re-load and re-evaluate inside the transaction**. Existing `workEligibility`, `workbenchReadinessService`, `resultEntryPolicy` and Sample projection rules must converge through actual call sites, not only import a new helper.

Suggested typed projection for both pages:

```
workItemId, attemptId, attemptVersion, orderLineId, orderRevisionId,
sample { id, displayId, laboratoryId }, kind, parameterName,
method { id, name, revision }, material, runId, replicateNo,
executionState, reviewState, applicability, blockers,
evidence { kind, version, recordedAt, recordedBy, payload, hash },
myDraft { draftVersion, baseAttemptVersion, payload, savedAt } | null,
capabilities { canDraft, canRecord, canConfirmOperation, canSubmit,
               canVerifyOperation, canReview, canAmend },
destination { path, query }, updatedAt
```

Return only drafts/evidence the actor is entitled to see. No technician's private draft values in external views, reports or another technician's worksheet. Authoritative names come from the catalogue/method revision; keys remain stable codes/IDs internally. Do not use a sample display ID as a laboratory scope key.

### Commands and compatibility

| Surface/path | Change |
|---|---|
| GET /api/workbench/queue | Add explicit queue/view and stable run grouping; return writable, recorded, submitted, operational completed and exception views through authorized selectors. Scope counts and rows identically. |
| POST /api/workbench/batch-save | Draft-only behaviour through a canonical command; expected attempt/draft versions, full equipment/gate/scope checks. Never accept results from stale or sealed attempts. |
| /api/workbench/v2/completion/preview and /commit | Scientific typed evidence; add separate operational confirm command under Workbench or explicit operation kind with different lifecycle. Preview is advisory; commit revalidates. |
| /api/workbench/v2/submissions/preview and /commit | Load on entry, reload and URL navigation. Commit exact selected attempt IDs/versions, order revision and preview identity. Exclude routine preparation tasks and closure/custody work. |
| PUT /api/work/:id/status, POST /:id/start | Inventory callers. Route valid start through the shared command. Reject legacy result/completion payloads with a typed instruction and authorized Workbench link, or adapt only if full canonical evidence/version requirements are supplied. No bare Done/COMPLETED loophole. |
| PUT /api/samples/:id/phase | Retain valid hold/failure/exception control under its material-operation policy. Prohibit toggling to DONE/ACCEPTED without operational evidence. Changes invalidating preparation evaluate downstream impact transactionally. |
| POST /api/results/:sampleId and /submit | Remove Sample UI callers. Any retained instrument/integration endpoint must use the same result and submission commands; reject ambiguous unlinked legacy payloads. |
| Work review single/bulk and Sample submission review | One scientific review service; separate operational verification command. Write decisions and reconcile submission aggregate atomically. |
| Spectral upload/link/rescan/library actions | Workbench owns acquisition UI; Sample links read-only viewing. All writers validate scope, current task/attempt, method, material and prerequisites; analytical submission snapshots the exact scan/checksum/QC/processing version. |
| Amend/reanalysis/order/custody/report APIs | Preserve existing responsibilities; connect their changes to eligibility and cache invalidation. Approved evidence remains immutable. |

Do not rely on request origin/referrer or hiding buttons as security. A stale browser or direct API call must not bypass the workflow. Return machine-readable reason codes plus clear instructions; never redirect a POST to an arbitrary first worksheet.

### Atomicity, concurrency and truthful receipts

- One work-item completion is atomic across evidence/attempt, active result versions, operational flags if applicable, history, audit and durable receipt. A grouped texture determination and its derived class are one atomic unit.
- Prefer explicit per-row outcomes for an analytical rack: commit valid selected rows, preserve failures, then submit only the successful eligible rows the user selects. Confirm the preview states this partial policy. A sample submission bundle is atomic for its exact listed attempts; one conflicting attempt refuses that bundle and returns reasons. No hidden fallback from all-or-nothing into a different policy.
- Every write needs an idempotency key, actor and expected versions. Repeating a request after a network timeout returns the original committed receipt, not a duplicate attempt/submission. Persist receipt identity, scope and selected items; receipts must be retrievable after reconnect.
- Status transitions, review, reassignment, revision changes, amendment and verification invalidate relevant versions. A version match on WorkItem alone is insufficient if the order, gate, instrument or submission changed since preview.
- Respond with committed item IDs, canonical evidence/state, new versions and per-item refusals. If zero were saved, say nothing was saved. HTTP 200 with an error array is not a saved draft. Keep rejected edits and show a recoverable reason beside the row.
- After-commit events invalidate Workbench, Sample, manager queues, dashboard counts, workflow map and report eligibility. Cover success from every branch, including partial conflicts. Events use actual resource lab and authorized recipients; no missing-lab broadcast. Reconnect performs a scoped reload.

## 4. Workbench interaction

Use task-centred labels: **My work · Ready to submit · Sent & completed · Needs attention**. The method/run worksheet is the working area under My work, not an unrelated tab full of every task. Exact labels can follow the current design system, but their actions and count units are fixed.

- Group eligible work by laboratory + operation/parameter + method revision + matrix + material/preparation profile + result basis + instrument/run where required. Forty pH samples under one compatible method open a single worksheet. Different method revisions or bases must not share a paste target.
- Keep sample identity and rack position fixed while scrolling; show readable parameter and method names. Filter to a sample from a deep link and offer Return to whole run. An unavailable task opens its recorded/history/exception view or explains lack of access; never switch silently to the first method.
- Operational worksheet: procedure heading and current revision, rack/run context, per-sample checks/observations, explicit exceptions, selected count, Confirm completed samples. Completed rows remain visible in the run with readable receipts; hide from Ready to do, not from all Workbench views.
- Analytical worksheet: correct editor by server kind; keyboard entry, multirow paste preview keyed by sample/column, clear units/basis, duplicate/blank/decimal validation and explicit exclusions. Texture is one group with sand+silt+clay and a valid derived class; select the procedure's mass balance tolerance, never silently normalize bad values to 100. Existing split tasks require audited order/attempt grouping, not inventing a new unrelated result.
- Spectra remain file/scan evidence through the existing import profiles; preserve QC, replicate and instrument metadata. No numeric reflectance box. A Sample or Library link can inspect but cannot create an alternate technician writer.
- Ready to submit fetches independently from the server. It works when My work is empty and has its own eligible count. Submitted/completed views can reopen receipts and show pending review, accepted or returned outcomes.
- Operational finish displays a preparation receipt and next eligible work; analytical record displays Recorded with Send for review. Do not auto-submit anything the technician has not selected and reviewed.
- Save indicators are per-row acknowledgements plus a truthful page summary. Debounce state uses the latest local snapshot, edit sequence and acknowledged draft version. Drain/cancel pending saves before record, discard, method switching or component teardown; discard must not be undone by a late timer. An older response cannot overwrite a newer edit.
- Queue refresh merges server updates without destroying dirty edits. Conflicts preserve both versions and offer a deliberate comparison. On disconnect, say whether data exists only in this tab; do not claim local persistence across refresh unless implemented and tested. Avoid storing sensitive drafts indefinitely in browser storage.
- Deep-link handling runs when navigation intent changes, not whenever draft groups change. Resolve `workItemId` consistently (current queue response uses that field, not `id`). Honor current method/run/revision; maintain back/forward state. Submission queue URL must fetch its data.
- Accessibility: labelled native controls, visible focus, live status announcements, keyboard selection/paste/review, adequate contrast, per-row error text beyond colour. Narrow screens preserve sample identity and move wide worksheets into a labelled scroll region; no page-wide overflow.

## 5. Sample workspace

Replace the legacy execution table with a read-only evidence projection. Use three separate sections: **Preparation**, **Ordered analyses and results**, **Review and report status**. Each scientific order group shows method, assigned person, current result/evidence, recording status, review status and last meaningful update. Expand to history/replicates and evidence details.

Preparation displays actual recorded checklist, SOP revision and actor/time, required verification and downstream blockers. A stored status with missing evidence gets **Completion recorded; evidence needs verification**, not Pending, not Passed, and not empty unchecked boxes representing work not done. Show the manager's exception link and technician's Workbench recovery destination only if permitted.

The primary action is role/state aware: technician Open in Workbench; manager Review submitted work / Resolve order mismatch / Assign work; reception Finish intake or material action; auditor Inspect evidence. Neither a generic Approve on completed gates nor a generic Final approve on unsubmitted scientific work is rendered.

Counts must name their unit: active ordered analysis groups, individual determinations/replicates, preparation tasks and samples are different quantities. Derive counts from the same active revision/attempt projection as the rows. Show an explicit order-integrity warning when there is no safe correspondence; do not fabricate matching counts. Historical orders and excluded tasks stay inspectable outside active coverage.

## 6. W001 and legacy recovery

Build a read-only integrity scan and a dry-run recovery preview before applying repairs. Scope queries by immutable sample/work-item IDs and record source versions. Detect: done flags without valid operational evidence, completed tasks without a reachable handoff, accepted items under pending submissions, missing decision metadata, stale drafts on sealed attempts, mismatched active orders/tasks/matrices, multiple active revisions, and unsupported legacy aliases.

For W001 specifically:

1. Re-read current state; staff are actively working. Compare original intake request, receipt, `requiredAnalyses`, order revision history and task-generation audit. Establish why an 11-line PLANT order coexists with 13 SOIL tasks. Do not declare the task list or order list correct merely from the screenshot. Show both to the authorized lab manager if history cannot resolve it.
2. Preserve the complete drying checklist and its acceptance history. Reconcile the one-item pending submission via an explicit migration/reconciliation event; do not delete it or invent a ReviewDecision signed by the manager. Legacy acceptance attribution can be marked unverified and sent for verification if required.
3. Preserve preparation's original `Done`, actor/time/history. Route it to the evidence-gap flow. If contemporaneous records support the work, an authorized person records an explicitly retrospective verification with the source evidence and current verification time. Otherwise leave the gap open and authorize re-preparation as a new attempt when appropriate. Never auto-generate three true checks.
4. Treat invalid preparation/order context as an execution/approval blocker for dependent current work until assessed. Preserve drafts and any measurements already entered. Evaluate affected attempts, spectra, batches and released reports; retain historical originals. Do not silently delete, unsubmit or reassign results.
5. If an order correction is justified, create a new authorized revision, retain predecessor lines and old attempts, and map only compatible tasks by explicit identity/method/material. Plant parameters cannot be aliased to soil parameters to make approval work. Retrospectively attach evidence only through a documented reviewed mapping.
6. Apply approved repairs transactionally with expected versions, idempotent IDs and before/after audit. Retry conflicts only after re-reading. Human scientific verification cannot be automated by Antigravity. Report unresolved decisions clearly; a pending scientific decision is not an implementation failure to hide.

Inspect generation/acceptance/revision creation for the recurring source of mismatch, including ID reuse and non-atomic updates as hypotheses to test, not established causes. Routine GET requests must not generate or repair orders as an invisible side effect. Add a fixture reproducing the verified origin once identified.

## 7. Delivery sequence

1. **Baseline and containment:** reconcile with current PR #55; record HEAD/deployed image. Add failing integration/browser reproductions and an integrity scan. Prevent new legacy evidence-free completions once a usable canonical Workbench/recovery route is in place. Do not disable one route while stranding work in the other.
2. **Server contract:** implement typed evidence, active-order/attempt links, shared eligibility, operational confirmation/verification, scientific submission and review aggregation; close all legacy writers. Add schema/migrations only when needed, with rollback/backward-read strategy.
3. **Workbench:** independent queues, draft safety, correct editors, completion receipts and dependable submission handoff. Validate zero remaining assigned tasks and 40-sample run scenarios.
4. **Sample:** read-only execution/evidence view; retain controls and exact destinations; remove hardcoded SOPs and local status guessing.
5. **Connected surfaces:** dashboard counts/drilldowns, manager queues, notifications, workflow map, catalogue/order selector, spectral library/import, grouped texture, report generation and amendments all consume current evidence/policy. Test events and stale sessions.
6. **Recovery:** dry-run existing discrepancies, prove reconciliation on a protected copy and collect necessary lab decisions. Apply only evidence-backed authorized repairs; do not stall safe code completion while waiting for a scientific decision.
7. **Acceptance and release:** complete acceptance.md with test names/output, build and production-like integration evidence. Push reviewed commits to GitHub, PR/CI, tested backup/rollback, deploy the exact verified build, verify production read paths and version. Laboratory writes for UAT use an isolated test environment/fixtures, not W001.

## 8. Release boundaries

Run the changed-contract suites plus required full project checks on the final commit. Use the production Node/runtime and SQLite behaviour for integration checks. A mocked green test or working screenshot does not prove concurrency, authorization, migration or report safety.

Before migrations/deploy, capture consistent database, uploaded spectra/attachments, report assets and configuration backups; verify restoration to an isolated target. Record old/new image digests, commit SHA, migration journal and rollback method. Do not replace the production database with a local/test copy. Do not blindly roll back to a legacy writer that recreates these defects; preserve new evidence compatibility or use a forward fix/maintenance mode if required.

After deploy, verify readiness/version, authorized read-only W001 projections, counts and exact links. Distinguish code deployed from W001 scientific reconciliation complete. Open/link defect issues, attach evidence, and close only those with demonstrated fixes on the deployed commit. Leave any unresolved evidence/order decision as a visible linked issue.
