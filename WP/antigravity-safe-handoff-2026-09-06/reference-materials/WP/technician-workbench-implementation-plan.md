# SoilFER LIMS — Technician workbench redesign

Implementation plan and interactive prototype specification · 5 September 2026

## 1. Recommendation and scope

Create one technician workspace that brings **My Work**, **batch entry**, **task execution** and **submission tracking** together. Keep specialized editors for numeric results, texture fractions, operational preparation and spectral imports. All editors must use the same identity, authorization, readiness, draft, result and handoff contracts.

The technician should always know:

1. Which sample, analysis, method revision and replicate am I editing?
2. Is the task ready, and if not, who can resolve the blocker?
3. Is my entry only on this device, saved as a draft, recorded, or submitted?
4. What errors or warnings need attention before the next step?
5. What exactly will the next action change, and which items are included?

This is a proposal only. Application source and workflow data were not edited. The deployed interface was inspected as Marcos A. using the confirmed technician account. No values, files, task completions or submissions were entered. The populated sketches use explicitly illustrative records and run entirely within the preview; they are not connected to LIMS.

Local code findings identify implementation risks. They do not establish that a particular production record has been corrupted, that an exploit occurred, or that every local source revision matches production.

## 2. What the live technician experience shows

The authenticated technician dashboard showed an active **S002 / SPEC_MIR** task. **My Work** showed one active task and three items labelled Accepted. **Workbench** showed “No pending work items — All your assigned analyses are completed or not yet assigned.”

The code explains the mismatch: the workbench queue explicitly excludes `SPEC_VIS_NIR` and `SPEC_MIR`. A technician doing spectroscopy can therefore reach a workbench that appears empty while work remains. The solution is a unified queue that routes spectral assignments to a spectral editor, not entering spectra into a numeric result field.

My Work also combines `COMPLETED` with accepted/approved states. Its visible S002 row showed an incomplete progress label, consistent with aggregate fields referenced by the view but not constructed in its grouping function. The account uses Spanish navigation while much workbench/My Work content remains English. These are practical operating and localization problems, not merely cosmetic details.

The spectral upload surface offers instrument files and CSV, parse/preview, and a separate upload action. No file was selected during this review. This is a useful existing foundation to preserve and strengthen.

## 3. Highest-priority findings

### P0 — Protect result integrity before changing the interface

| Code finding | Why it matters | Required implementation outcome |
|---|---|---|
| Draft mode appends a `Result` with `isCurrent: true`, supersedes an existing result of the same parameter/replicate, and may change ASSIGNED to IN_PROGRESS | A keystroke autosave is entangled with operational progress and result publication | Dedicated draft storage; a draft must not supersede a recorded result or imply task execution |
| Queue reads all historical results and reduces them to sample + parameter, without current/replicate selection or deterministic ordering | A prior determination or different replicate can populate an input | Query the exact current determination identity; return explicit draft and recorded values separately |
| Draft clearing resets WorkItem state/result but does not reconcile the Result rows created by draft saves | “Discarded” work can remain in downstream result data | Draft discard operates only on drafts, with a receipt and audit event; preserve finalized history |
| Workbench autosave sends value, equipment and version, but omits basis, replicate and override context; server defaults missing basis/replicate | Autosave can store a different scientific context from what the operator selected | Every draft patch preserves the full result context; omitted fields are not replaced by defaults |
| Workbench uses a separate numeric validator from the dedicated results path | Decimal commas, qualifiers, whitespace and bounds behave differently across screens | One method-aware parser/validator shared across every writer |
| Batch completion checks service state and equipment eligibility but does not perform the qualification checks used by the single-item route | An overdue instrument can be handled differently depending on the entry path | Shared, server-enforced readiness for draft/execute/record/submit actions, with action-specific rules |
| Version is optional on writes; polling updates the version reference independently of the base value being edited | A stale local entry can acquire a newer version without a meaningful comparison | Required base revision tied to the edit; explicit conflict resolution rather than silent retries |
| Report assembly reads all related results without a current/finalized filter in the inspected service | The draft/final boundary is also a downstream-reader problem | Fix result readers and report assembly together with the draft model; no isolated UI-only fix |

These paths were inspected statically. The review did not exercise production mutations to reproduce them.

### P1 — Make the working process coherent

- “Submit Results” calls batch completion, not submission creation. Rename and separate recording from submission; make the handoff available inside the workspace.
- Keep recorded-but-unsubmitted work visible. The current queue only includes ASSIGNED, IN_PROGRESS and REANALYSIS_REQUIRED, so a completed result disappears before the technician necessarily submits it.
- Accepting, waiving, completing and awaiting review must remain distinct. Counts must distinguish work items, samples, replicates and grouped texture sets.
- Route `sampleId`, `room`, analysis and selected work-item deep links into the intended context. The current workbench does not consume the map's query context.
- Treat texture as a real grouped editor. The virtual TEXTURE group currently does not exist in the raw group array used by local draft persistence; synthetic rows lack the ordinary `workItemId`; completion handoff lookup also assumes ordinary rows. The mobile branch renders an ordinary single-value card for texture.
- Preserve instrument eligibility per item/lab/method. An analysis group's first row currently supplies the group's instrument list, which is unsafe as a general multi-context grouping rule.
- Distinguish scientific QC, instrument readiness, task readiness and save errors. A spectral WARN is not a QC batch failure; a failed batch may have a manager disposition that changes its acceptance eligibility.
- Keep a complete versioned result tuple: sample, task, analysis, method revision, attempt, replicate, basis, units, value/qualifier, instrument, batch, provenance and timestamps.
- Do not advertise an out-of-range “override reason” as sufficient for a technician. The backend requires manager authorization; present investigation and escalation instead.

### P2 — Interaction and resilience defects to eliminate

- Initial queue failure can collapse into an empty-work message. Distinguish empty, unavailable, stale and unauthorized states.
- Current Tab handling prevents default at both table boundaries and jumps over other fields. Preserve an accessible escape from entry navigation.
- Local/server hydration merges have competing precedence without revision comparison. Loading a draft must not silently replace a newer draft.
- Unload flushing caps a request at 100 entries and clears the entire dirty set without an acknowledged response. Closing a page cannot be the only persistence guarantee.
- Overlapping autosave/manual save/complete operations need a per-draft write coordinator. A boolean pending flag is not a serialized write queue.
- Per-item conflict fallback responses omit the new revision and return before the normal notification path. Success and partial-failure receipts need the same shape.
- Queue paging in My Work discards the server total and computes pages from the current grouped page. Counts and navigation can be incomplete.
- Draft deletion, manager overrides, retries, readiness failures and scientific errors need persistent, readable feedback rather than only transient toasts or truncated text.

## 4. Proposed information architecture

Use one navigation destination, **My workbench**. Keep `/my-work` and `/workbench` compatible during rollout; both lead into the same workspace with the requested view preserved.

### My queue

Default to an actionable list, not a dashboard of large decorative counters. Provide compact counts and views for Ready, In progress, Needs attention, Recorded/not submitted, Awaiting review and History. Each row identifies sample, analysis, due/priority information when configured, readiness, next action and owner.

Group by method for bench work or by sample for investigation. Never group across incompatible method revision, instrument context, unit, basis or lab without displaying and resolving that incompatibility. Use explicit priority order, not lexical sorting of status or priority strings.

Spectral and operational tasks stay visible even when their editor differs. Blocked work stays accessible with its reason and responsible team; it does not masquerade as ready or disappear.

### Worksheet

Keep the result column visually dominant. A practical desktop arrangement is:

```text
MY WORKBENCH                         Draft save state / data freshness
Queue | Worksheet | Review & submit | Activity

Method / run context        Find sample       Paste / import
Method revision · unit · instrument scope · basis / replicate defaults

Select  Sample ID   Result / fractions   Validation & save state  Details
        D-101      6.42                 Draft saved              →
        D-102      [      ]             Needs value              →
        D-103      15.2                 Outside method range     →

Exact selected count                    Review completion →

Docked inspector: identity, SOP, instrument, batch/QC, reasons and history
```

The inspector is secondary to entry. Use it for method evidence, metadata changes, conflicts and blockers. Make basis/replicate available on mobile too. Avoid adding every field to every row when the context is shared, but show row exceptions and the exact metadata at preflight.

### Review & submit

There are two different transitions:

1. **Review completion → Record eligible results/tasks.** Validate the exact selected set and show exclusions. Nothing is submitted merely because a result was recorded.
2. **Review submission → Submit for review.** Show the exact samples, result revisions, values and retained warnings. Create the appropriate per-sample submissions, then show stable receipts and reviewer status.

A group of samples can be submitted from one user action, but the current Submission model is sample-scoped. The server must preserve that model or introduce an explicitly designed parent submission bundle; do not attach unrelated samples to one existing submission record.

Review should be a useful verification step, not repetitive confirmation on every keystroke. Checking or confirming consequential stored-data changes aligns with [WCAG error-prevention guidance](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html).

### Activity

Show personal recording/submission receipts, returns for reanalysis, warnings and synchronization issues. Link back to the selected result/task. Do not substitute a raw, unfiltered audit log for an operator-friendly activity view. Authorized detailed history remains accessible.

## 5. Task-specific editors

### Numeric and qualified results

- Persistent sample ID plus original/field ID; support barcode-scanner keyboard input with exact-match confirmation before moving to a sample.
- Visible unit and method revision. Separate displayed precision from preserved raw input; do not round stored observations on every keystroke.
- Parse blank, zero and whitespace distinctly. Preserve zero as a valid number when the method allows it.
- Support decimal comma/point according to an explicit locale policy. Do not silently interpret ambiguous thousands separators.
- Support `<LOQ`/`>range`, scientific notation and negative values only where the method permits them. Store qualifier and threshold separately from an observed numeric result.
- Reject non-finite values, accidental formulas and mixed unit text. Scientific warning limits and hard instrument/method limits must be distinguished by configured policy.
- Changing basis is not unit conversion. Changing replicate is not editing the previous determination. Explain these changes and preserve identity/history.
- Out-of-range entry remains available as a draft with a plain-language reason; recording follows the configured authorized disposition policy.

### Texture

- One sample row with sand, silt and clay, each with its actual task/result identity.
- Show sum and closure state continuously; use the configured method tolerance, not a universal hard-coded scientific assumption. The sketch's ±2% is illustrative and matches the current UI convention only.
- Retrieve existing completed components as read-only context when not all three tasks remain actionable.
- Validate same sample, attempt, method, basis and replicate before calculating a sum or derived class.
- Save incomplete sets as drafts, but record the required coupled set atomically. A conflict in one fraction must not finalize the other two silently.
- Derive texture class from the committed source revisions in the same controlled operation. Never take arbitrary first current fractions across replicates or bases.

### Operational preparation and closure tasks

- Use SOP-specific checklists and evidence fields for drying/preparation. Do not require an invented numeric analytical result to complete a physical task.
- Show drying/preparation failures and downstream effects explicitly. Require reasons for failed/skipped steps when policy requires them.
- Preparation completion should apply the same sample gate updates regardless of the entry screen.
- Archive/disposal tasks require the existing approved-sample and closure preconditions. Keep them specialized and role-aware rather than hiding them in a numeric table.

### Spectroscopy

- Launch from the assigned spectral task or a method/run queue, preserving exact work-item, sample and modality context.
- Identify instrument, method revision, modality, axis quantity/unit, replicate and provenance before commit.
- Parse and validate first. Matching preview shows every file/scan, exact sample match, ambiguous/unmatched identity, duplicate determination and QC state.
- Preserve raw bytes and checksum, parser version and mapping decisions. Do not silently discard malformed points, shift wavelength/value alignment or infer modality from overlapping numeric ranges alone.
- Use a proper CSV parser with quoted-field and locale handling. Apply size/point limits, explicit supported-format checks and a background processing job for large runs.
- A preview does not publish scans or complete a task. Final commit binds to an explicit assigned work-item ID, not a broad substring match or the first open task.
- Preserve existing replicates. Distinguish new replicate, reanalysis determination, correction/supersession and skipped duplicate, with the required permission and reason.
- A QC warning may remain attached to an imported scan without reviewer acceptance. QC failure and batch disposition use shared readiness rules. Do not silently add new restrictions to task completion/submission without agreeing the policy.
- Commit yields per-scan receipts and retryable failures. Retrying never duplicates successful scans. Unmatched scans cannot create accidental sample records.

## 6. Safe entry, persistence and conflict model

### Make save state truthful

Maintain a separate persistence state per draft:

```text
Editing → waiting to save → saving → saved at acknowledged revision
                         ↘ offline / failed / session expired
                         ↘ conflict → compare → explicit resolution
```

Keep this independent from task state:

```text
Assigned / ready → running → recorded or completed → submitted → decision
```

A draft save must not imply the second sequence advanced. Whether execution requires an explicit Start action is a lab policy to settle; it must not happen merely because a page restored a draft.

### Dedicated drafts

Introduce a draft entity rather than treating `WorkItem.result` or `Result.isCurrent` as a draft buffer. Include owner/lab scope, stable work-item/determination identity, raw input, metadata, base result revision, draft revision and timestamps. Define clear null/delete semantics: an intentionally cleared value must remain cleared and must not fall back to an old result through a truthiness expression.

Autosave should coalesce edits per draft and serialize writes for that draft. An acknowledgement applies only to the submitted local edit generation. A later keystroke remains dirty even if an earlier request succeeds. Autosave, explicit Save, record, submission and page-hide flushing all coordinate through the same state machine.

### Offline and shared-device behavior

- Display precisely whether data is only on the device or acknowledged by the server. Never show “Saved” after a failed or unacknowledged request.
- Use a recoverable draft cache if the lab's device policy permits it, scoped to authenticated user, lab and draft identity. Handle storage denial/quota errors visibly.
- Define cache retention and logout/session-expiry handling for shared lab devices. Do not automatically reveal another user's entries or reapply them under a new account.
- Allow continued draft entry offline only under the chosen policy; do not record/submit against unknown readiness. On reconnection, reconcile base revisions and authorization before sending.
- Page-hide flush is best-effort transport, not a persistence guarantee. Retain unsent entries and respect byte limits rather than dropping everything beyond the first 100.
- Do not claim offline durability in the supplied sketches: their changes are in memory and reset on reload.

### Concurrent changes

Pin each edit to its base revision. Background refresh may update untouched fields and show a changed-state notice, but must not replace the base revision of a dirty edit behind the user's back.

For conflict, show local entry, newer saved entry, author/time when permitted, and changed metadata. Provide explicit adopt-newer or retain-local-with-reason flows. Reassignment, sealing, method change or revoked permissions may prevent retaining the local entry; preserve recoverable work without allowing an unauthorized write.

Require revisions and an idempotency key on consequential commits. A timeout means “outcome unknown,” not “failed, retry blindly.” Resolve the operation receipt by the same key.

## 7. Full integration and dependency map

| Connected area | What the workspace consumes | What authorized actions affect | Required safeguard |
|---|---|---|---|
| Authentication, roles and lab scope | Current user, assignments, permissions | Allowed drafts/records/submissions | Enforce ownership and lab scope server-side on every read and write |
| Assignment / My Work / dashboard | Work item, priority, due date, reanalysis reason | Running/completed task and next-owner visibility | Shared definitions, complete counts and proper server pagination |
| Sample lifecycle and workflow map | Intake, holds, drying/preparation, dependencies | Gate completion and operational summaries | Shared readiness service; exact deep-link context |
| Analysis catalogue and methodologies | Type, units, validation, precision, revision, prerequisites | Determination metadata | Version method configuration; no silent default changes mid-entry |
| Equipment and qualification | Eligibility, service state, calibration/verification | Usage evidence | Same action-specific checks in every entry path; stale readiness is not green |
| Draft storage and local recovery | Draft body, revision, base result | Draft save/discard/restore | Separate from recorded results, acknowledged persistence |
| Results and history | Current determination and prior revisions | Append-only recorded determination/supersession | Explicit identity, one current result per defined identity, no arbitrary history reduction |
| Texture and scientific calculations | Compatible source fractions/revisions | Derived result | Atomic validation and derivation using matching context |
| QC batches and disposition | Batch membership, QC state, evidence, manager disposition | Authorized QC entry/evaluation and downstream eligibility | Distinguish failure, warning, unknown and authorized disposition |
| Spectral storage/library | Task context, raw file metadata, existing replicates | Scan import and eligible work-item completion | Preview/commit separation, exact binding, provenance and idempotency |
| Submissions and manager review | Completed eligible results, full/partial policy | Per-sample submission, sealed state, decisions | Actual submit action, exact included revisions, role checks and receipts |
| Reanalysis | Reviewer reason, prior result/scan | New permitted attempt | Preserve prior evidence and relationships; no edit to sealed history |
| Notifications and realtime | Assignment, readiness, result and review events | Queue/map updates and authorized handoff notices | Publish after successful commit, including partial-success paths; no raw result leakage to unrelated labs |
| Data Results / reports / exports | Finalized and current appropriate revisions | Downstream interpretation and output | Central result-reader policy excludes drafts and superseded determinations appropriately |
| Inventory, consumables, custody | Related records when an actual relationship exists | None assumed for this redesign | Do not invent stock consumption or hard blockers; add only through a separately verified integration |

The previous workflow-map redesign and this workbench should share the same readiness/result semantics. Building two independent interpretations would reproduce the present inconsistencies.

## 8. Backend architecture and API contract

Refactor through shared services with adapters for existing routes. Do not duplicate validation into a new v2 controller while leaving the old paths divergent.

Suggested responsibilities:

- **Workspace query:** paginated work items and aggregate counts, grouping keys, actionable state and links.
- **Readiness evaluator:** sample prerequisites, permission, instrument qualification, method, batch/QC and action-specific reasons.
- **Draft service:** patches, revisions, recovery/discard and durable acknowledgement.
- **Result recording service:** typed parsing, metadata identity, version check, result revision, task/gate changes and audit in one coherent transaction.
- **Submission service:** eligible result revisions, partial/full rules, sample-scoped commits and receipts.
- **Import service:** staging/parse preview, identity mapping, duplicate decisions, commit and per-scan results.
- **Outbox/events:** committed changes reach dashboard, My Work, map, library and review consistently.

Possible versioned operations, subject to existing API conventions:

| Operation | Purpose |
|---|---|
| `GET /api/workbench/v2/queue` | Complete, filtered and paginated queue plus aggregate counts |
| `GET /api/workbench/v2/context/:workItemId` | Method, readiness, draft/current result, QC and history context |
| `PATCH /api/workbench/v2/drafts/:draftId` | Explicit revisioned draft changes with full metadata |
| `POST /api/workbench/v2/completion/preview` | Validate exact IDs/revisions and return included/excluded items |
| `POST /api/workbench/v2/completion/commit` | Revalidate and record; return stable per-item receipts |
| `POST /api/workbench/v2/submissions/preview` | Explain partial/full eligibility for the selected samples |
| `POST /api/workbench/v2/submissions/commit` | Create actual per-sample submissions idempotently |
| `POST /api/workbench/v2/imports/preview` | Stage/parse without publishing results or advancing workflow |
| `POST /api/workbench/v2/imports/:id/commit` | Bind validated mappings to tasks and persist eligible scans |
| `GET /api/workbench/v2/operations/:id` | Resolve success/partial/unknown outcomes and safe retries |

Preview results need a snapshot/version fingerprint. Commit must revalidate under current permissions and dependencies; an old preview is not permission to write.

Every receipt should contain operation ID, work-item/draft/result IDs, submitted revision, resulting revision, outcome, validation flags and next action. Return structured error codes and plain-language messages. Skipped/unchanged entries must not be counted as saved or completed.

Define transaction boundaries deliberately: atomic per independent determination, atomic per coupled texture set, atomic per sample submission. Batch operations may have partial success only when that was disclosed in preflight and clearly reported. Retry failures by stable IDs; never resubmit successful entries accidentally.

## 9. Frontend implementation structure

Replace the large TechWorkbench component incrementally with a workspace shell, query state, a draft coordinator and specialized editors. Keep context and state outside view lifecycles so changing tabs does not lose work.

Suggested components/hooks:

- `WorkbenchShell`, `WorkbenchQueue`, `MethodWorkspace`, `ResultInspector`.
- `NumericResultEditor`, `TextureEditor`, `OperationalTaskEditor`, spectral import workspace.
- `CompletionReview`, `SubmissionReview`, `OperationReceipt`, `DraftConflictPanel`.
- `useWorkbenchQuery`, `useDraftCoordinator`, `useEntryNavigation`, `useReadiness`, `useOperationReceipt`.

Keep raw input controlled without coercing the visible value on each keystroke. React's [controlled input guidance](https://react.dev/reference/react-dom/components/input) supports keeping input state synchronous while asynchronous persistence is handled separately.

Prefer native table/form controls until the workload demonstrably requires a full grid. If a grid is adopted, implement its complete keyboard and editing model rather than partially overriding Tab. Use the [WAI interactive grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) as the reference.

## 10. Visual and practical interaction specification

- Quiet neutral surfaces, restrained green/blue accents, readable status labels and a strong result-entry column. Red indicates an actionable error; amber indicates warning, hold or required attention.
- Target 14–16 px for primary entry information. Small secondary labels remain readable; do not use 8–10 px operating text to force columns to fit.
- Avoid full-screen drawers on wide displays. Preserve the selected row and context; stack the inspector or use a proper dialog on narrow displays.
- Keep essential identity, value, save state and next action visible on phones. Texture uses three labelled fields; metadata remains accessible.
- Use native Tab/Shift+Tab behavior unless a complete accessible grid model is implemented. Enter may move to the next editable result; it must not silently submit. At the boundary, focus can leave the worksheet.
- Support exact sample search/scanning, method filtering, selected-row counts, and visible-row versus all-matching selection semantics. Freeze the commit set at preflight.
- Paste/import preview must show mapping, changes, duplicates, unsupported rows and exclusions. Never silently broadcast a value to other samples.
- Batch instrument/basis defaults apply only to an explicit compatible selection; preview scope and preserve per-row exceptions. Do not retroactively alter recorded results.
- Keep error reasons inline until resolved, with a link to the first issue and the relevant owner/action. Announce saving errors and receipts accessibly without announcing every keystroke.
- All strings, statuses, methods, decimal input rules and dates must work with the account's locale. Maintain stable scientific units and codes.
- Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/), including error identification, keyboard access, focus visibility and status announcements. Respect reduced motion and use practical touch targets.

## 11. Interactive sketches and their limits

### Sketch A — My workbench

Demonstrates a populated queue, pH worksheet, metadata inspector, invalid values, blocked preparation, conflict comparison, identity-based paste preview, texture closure, preparation checklist, completion preflight, actual submission as a second step, and activity receipts.

Try:

1. Enter a result for D-102, wait for the simulated draft acknowledgement, and review completion.
2. Inspect D-105 to compare 6.80 with the newer 6.90 value and resolve deliberately.
3. Switch to Texture and change D-202 from a 90% total to a valid illustrative total.
4. Record selected work, then use Review & submit to finish the distinct handoff.
5. Use the optional connection scenario control to explore unsent drafts.

### Sketch B — Spectral intake

Demonstrates identify → match/inspect → confirm → receipt. It includes an exact match, an existing replicate and an ambiguous source ID; the user can retain the old replicate or choose a permitted new replicate, and must explicitly verify a corrected identity. QC warnings remain visible after import.

Try loading the example run, resolving D-402's replicate choice, matching and verifying D-4O3 to D-403, then reviewing the exact import set. Importing never grants approval.

The sketches are interaction specifications, not a production implementation, an instrument parser, a durable offline system or a security test. Scientific ranges, IDs, runs and curves are illustrative. Backend readiness, real file parsing, permission enforcement, transport and audit persistence must be implemented and tested separately.

## 12. Implementation sequence and estimate

Planning estimate: **approximately 7–10 calendar weeks** with frontend/backend work in parallel, a participating lab lead and QA support. Re-estimate after the draft/result boundary audit. The range assumes reuse of the current stack; a new offline-first architecture, new instrument formats or immutable reanalysis lineage expands scope.

| Phase | Deliverables and exit condition | Indicative effort |
|---|---|---|
| 1. Contract and safety baseline | Confirm task/result states, method rules, current determination identity; fixtures for the P0 risks; map every reader/writer | 4–6 engineering days |
| 2. Shared persistence/readiness | Dedicated drafts, consistent validation, optimistic concurrency, idempotency, reader filtering and compatible legacy adapters | 8–12 days |
| 3. Unified workspace | Queue, typed editors, responsive inspector, exact deep links, paste preview and accessible entry | 7–10 days |
| 4. Handoff and integrations | Completion/submission previews and receipts; QC/equipment/reanalysis integration; spectral preview/commit and events | 7–10 days |
| 5. Pilot, migration and release | Migration rehearsal, scenario tests, usability, accessibility, performance and phased rollout | 6–9 days |

Phases 2 and 3 can overlap after the contract stabilizes. Phase 4 must consume the shared services, not reimplement them. The full production rollout depends on all P0 data-path issues being resolved, not merely on completion of the visible screens.

### Data migration and compatibility

Audit existing draft-created Result history before migration. Do not infer draft/final status solely from the current WorkItem state, because later transitions may have changed it. Use audit/provenance evidence, stage uncertain records for review, and keep reversible mappings and backups.

Keep old endpoints operational through adapters during the pilot. Do not dual-write old and new result flows without a proven idempotent migration design. Define the current-result uniqueness rule using stable domain identity and enforce it in the database where supported.

## 13. Test and acceptance matrix

### Identity and scientific values

- Exact sample/task binding, leading-zero IDs, duplicate IDs, wrong sample and wrong method.
- Blank, explicit clear, zero, negative, decimal comma/point, whitespace, NaN/Infinity, very large values, scientific notation and permitted qualifiers.
- Raw precision retained; display rounding does not change stored input.
- Basis/replicate/instrument changes survive autosave, reload and tab changes.
- No recorded result appears from a draft save; no draft reaches final-result readers or report assembly.
- Replicate 2 does not replace replicate 1; reanalysis/correction retains original evidence.

### Synchronization and concurrency

- Edit while prior save is in flight; out-of-order acknowledgements; delayed responses.
- Refresh while dirty; reassignment; task sealing; method revision change; revoked scope.
- Offline, storage failure, session expiry and reconnect; recovery on a permitted device.
- More than 100 dirty entries and byte-limited unload behavior without silent loss.
- Double click, timeout after commit, repeated idempotency key, partial failures and retry only failed IDs.
- Conflict resolution never silently adopts a new base revision while preserving an old value.

### Workflow and resource rules

- Accepted intake, failed drying, incomplete preparation, sample hold, custom catalogue dependencies.
- Required/optional instrument, out of service, overdue calibration/verification, method mismatch and stale/unknown readiness.
- Out-of-range technician entry, manager disposition and invalid format with no override loophole.
- Reanalysis-required versus reassigned/ready states.
- Record versus submit, partial versus full submission, completed operational gates and sample-scoped membership.
- QC pass/fail/warning, authorized disposition and unknown QC state. Unknown must not be treated as proven eligibility.
- Review sealing, return for reanalysis, and approval/closure consistency across the map and workbench.

### Grouped and spectral work

- Texture with missing, completed or differently assigned fractions; invalid sum; mixed replicate/basis; one-component version conflict.
- All supported instrument and CSV formats with quoted fields, malformed axes, missing points, ambiguous modality, oversized input and parse interruption.
- Exact/missing/ambiguous sample match, wrong lab, duplicate scan, additional replicate and explicit supersession.
- QC FAIL/WARN; existing approved/submitted task; import succeeds but follow-up event fails; retry preserves scan identity.

### Usability and scale

- Test 1440×900, 1366×768, 1024×768 and 390×844; light/dark appearance, 200% zoom and long translations.
- Keyboard-only completion of entry, metadata change, validation correction, preflight and handoff; focus never gets trapped.
- Screen-reader labels include sample and parameter; status messages are meaningful and not noisy.
- Test 1, 50, 500 and 2,000 assigned tasks with server pagination/filtering; measure 100-row editing batches and large spectrum jobs on the lab's baseline device.
- Proposed performance targets: input feedback below 100 ms, common filter/selection response below 200 ms after loading, and no row movement while editing. Establish measurable server save/import budgets from the actual lab connection.
- Observe technicians entering a representative run, resolving a blocker/conflict and submitting it. Measure wrong-row incidents, corrections, time to first entry, handoff completion and understanding of save state.

Existing repository tests cover several results, matrix and spectral contracts, but those are not proof of equivalent workbench behavior. Add workbench-specific end-to-end and shared-service tests in an isolated test database. No database-writing suite was run as part of this read-only proposal.

Release standard: no known critical/high-severity defects, agreed data-integrity scenarios passing, lab usability acceptance and accessibility review completed. Literal zero defects cannot be guaranteed.

## 14. Rollout and policy decisions

Pilot behind a per-lab feature flag. Compare read-only readiness/count outputs against existing operations before enabling writes. Start with numeric entry, then grouped operational/texture work, then spectra and batch handoff. Keep a rollback path that preserves drafts and receipts; rollback must never duplicate or discard already committed results.

Measure save failures, conflict rates, pending unsent drafts, completion-to-submission delay, queue count mismatches and import mapping failures. Avoid logging raw scientific values in general telemetry unless specifically justified and access-controlled.

Settle these decisions during phase 1:

1. What constitutes a finalized/reportable determination, independently from task completion and review acceptance?
2. Is Start explicit, and which evidence is required for operational tasks?
3. Which warnings permit recording/submission, which require a supervisor disposition, and which are hard errors?
4. Are reanalysis attempts immutable entities in the first release, or represented through existing history with a planned extension?
5. What local-draft retention is permitted on shared devices, and is offline editing required?
6. What method/basis/replicate identity rules apply to corrected and derived results?
7. Is report release policy changing, or is this release limited to excluding draft/superseded data correctly?
8. Which consumable, booking or custody relationships are actual enforced dependencies rather than contextual links?

## 15. Implementation evidence index

- [Navigation split](C:/Users/yigin/Documents/soilfer-lims/client/src/App.jsx:104).
- [My Work aggregation and pagination](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/MyWork.jsx:41) and [state buckets](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/MyWork.jsx:116).
- [Workbench queue and spectral exclusion](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workbenchController.js:14).
- [Historical result reduction](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workbenchController.js:69).
- [Texture virtual grouping](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:312).
- [Draft hydration](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:439).
- [Entry payload and fallback values](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:564).
- [Autosave metadata and conflict handling](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:617).
- [Local persistence and unload flush](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:735).
- [Completion and handoff](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:894).
- [Keyboard handling](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:1034).
- [Mobile editor](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:1568) and [misleading submit labels](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/TechWorkbench.jsx:1716).
- [Batch validation/readiness](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workbenchController.js:310).
- [Draft/Result persistence](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workbenchController.js:476).
- [Partial transaction fallback](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workbenchController.js:605).
- [Derived texture](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workbenchController.js:663).
- [Draft retrieval/discard](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workbenchController.js:755).
- [Single-item qualification checks](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workItemController.js:897).
- [Dedicated value validator](C:/Users/yigin/Documents/soilfer-lims/server/controllers/validationController.js:4).
- [Result-reader filtering](C:/Users/yigin/Documents/soilfer-lims/server/controllers/resultsController.js:27) and [report reader](C:/Users/yigin/Documents/soilfer-lims/server/services/reportAssembly.js:12).
- [Submission contract](C:/Users/yigin/Documents/soilfer-lims/server/controllers/submissionController.js:67), [review/QC](C:/Users/yigin/Documents/soilfer-lims/server/controllers/submissionController.js:318) and [QC disposition](C:/Users/yigin/Documents/soilfer-lims/server/controllers/qcController.js:298).
- [CSV preview/parser](C:/Users/yigin/Documents/soilfer-lims/client/src/components/SpectraBatchUpload.jsx:72).
- [Spectral upload/task binding](C:/Users/yigin/Documents/soilfer-lims/server/controllers/spectralController.js:784).
- [WorkItem/Submission schema](C:/Users/yigin/Documents/soilfer-lims/server/prisma/schema.prisma:221) and [Result schema](C:/Users/yigin/Documents/soilfer-lims/server/prisma/schema.prisma:783).

All referenced application files were read only for this proposal.
