# Acceptance ledger required before release

For each ID record: test/fixture, command or browser journey, expected versus actual outcome, final commit, environment, evidence path and PASS / FAIL / NOT RUN. Do not convert this checklist into an assertion that testing has happened. The four included defect probes confirm the old faults only.

## Marco and manager journeys

- A01 Fresh accepted sample → drying checklist → confirmed operation → preparation unlocked. Reopen Workbench and Sample: identical checks, actor/time, evidence version and readiness.
- A02 Preparation confirm → reload, logout/login, different method and two tabs: stays completed with receipt; no second performance or scientific submission needed under routine policy.
- A03 Verification-required SOP: technician confirmation automatically creates an operational verification handoff. Manager can verify through the dedicated action; pending/verified states and unlock policy agree everywhere.
- A04 Record the final remaining analytical task. My work becomes empty; Ready to submit still contains it on direct URL, refresh and next login. Send then manager review succeeds against that evidence snapshot.
- A05 Manager cannot approve unrecorded or unsubmitted scientific work through single, bulk, Sample, dashboard or direct API routes.
- A06 Completed legacy prep with `Done` and no checklist stays visible as an evidence gap. Generic submit/approve cannot launder it into valid evidence. Supported retrospective verification preserves original history; unsupported work requires a new authorized attempt.
- A07 W001-shaped fixture: accepted drying inside pending submission, legacy prep, active plant order and soil tasks. UI highlights each discrepancy; dry-run repair changes nothing; authorized version-checked recovery leaves traceable history and does not fabricate checks or reviews.
- A08 Routine gate-only work neither creates a scientific submission nor makes a sample eligible for final approval/report release.

## Entry ownership and route closure

- A09 Sample work/results contains no result inputs, Mark Done, Save & Complete, direct acquisition/upload or alternate technician submit action for any role/state. Open in Workbench reaches exact current/recorded/exception attempt.
- A10 Inventory every retained Sample control (receive, accept, hold, order change, assignment, manager review, amendment, label, map, field data, custody, archive, disposal, reports, audit); demonstrate unchanged authorized purpose and correct destination.
- A11 Direct legacy `/work/:id/status`, `/samples/:id/phase`, `/results/:sampleId`, old submit and bulk paths cannot create evidence-free completion, scalar spectra, orphan measurements or bypass gates/assignment/version.
- A12 Spectral upload/link/rescan and any retained instrument integration use canonical command policy even when invoked outside the new component.
- A13 Browser-back/stale cached old UI requests receive an actionable response and preserve input safely; no silent success, unexpected POST redirect or wrong-method fallback.

## State, data and science

- A14 Active revision selected by status/identity, not just largest version. Test multiple ACTIVE revisions, no ACTIVE revision, superseded/cancelled latest and cross-matrix tasks; fail clearly.
- A15 Intake/order acceptance and task generation are coherent and atomic/idempotent. Reused display IDs and simultaneous intakes cannot attach another sample's order. Trace W001's actual mismatch origin and add the regression fixture.
- A16 Exact order-line/current-attempt/method/material relationships drive both tables and all coverage counts. Count groups, replicates and gates explicitly; no double-count omitted/waived work.
- A17 Missing or failed applicable drying/preparation blocks result drafts, recording, import/link and submission through direct APIs. Expected, rejected, held, disposed, archived and approved samples respect their policies. Non-applicable gates follow actual SOP/method rules, not implicit null bypasses.
- A18 Operational evidence keeps the executed checklist revision after the catalogue/SOP changes. No hardcoded 40°C, 2mm, constant-weight or invented SOP version appears as fact.
- A19 Texture editor records sand/silt/clay and derived class as one atomic compatible determination. Validate method tolerance, 100% closure, impossible fractions, boundary classes and incomplete groups; no silent normalization or duplicate post-commit derivation; report cites correct source versions.
- A20 Current result projection excludes superseded/invalid attempts and selects exact replicate, basis and method. Zero is not empty; comma decimals and censoring retain their meaning.
- A21 Spectral results identify exact current scan, attempt, instrument, method, modality, source/checksum and QC. An unrelated scan on the same sample cannot satisfy evidence or approval.
- A22 Failed/pending QC or unsuitable equipment blocks the relevant action on both pages and direct calls. Calibration changes after preview are caught at commit.
- A23 One approved item cannot leave its fully resolved submission indefinitely pending. Single/bulk review reconcile review decisions, submission, sample coverage, manager badges and receipts atomically.
- A24 Corrections before/after submission and after final release preserve prior evidence and require the proper return/amendment route and reason. Derived results and downstream reports reference the right versions.

## Drafts, batches and concurrency

- A25 HTTP200 with saved0/errors must visibly refuse the save/record and preserve edits. Partial outcome shows precisely which rows succeeded/failed; no “Drafts saved” while one is rejected.
- A26 Rapid typing/checking then Record before debounce expires persists the latest values once. A late autosave cannot overwrite, recreate or reopen recorded/submitted work.
- A27 Discard while save pending cancels/drains it; refresh/method switch/unmount cannot resurrect the draft. Older response cannot win over a newer edit.
- A28 Two tabs/devices edit same attempt; stale client gets a conflict with both values preserved. Reassignment, order revision, gate invalidation, verification and review between preview/commit also refuse stale commands.
- A29 Network failure after commit then retry with same idempotency key returns same durable receipt, evidence and submission count. Repeated click creates no duplicate rows or history.
- A30 Inject failure in each write of a grouped result, operation and submission: no partial evidence/flags/audit/result state survives within the declared atomic unit.
- A31 Partial batch conflict follows documented row/bundle policy and produces receipts/events for all committed units, including retry branches. No accidental mixed transaction semantics.
- A32 Forty compatible pH samples in a rack: select, type/keyboard advance, paste preview with sample mapping, record a valid subset, preserve invalid rows, submit subset, review. Test more than one method/revision/basis and >40 rows with pagination or virtualization.
- A33 Group-wide instrument/run metadata never overwrites a sample exception or incompatible row. Selected counts and submission lists exactly match what will be changed.

## Wiring, permissions and resilience

- A34 Assignment/reassignment → Workbench visibility; operation confirmation → next work; record → Ready to submit; submit → manager queue; return → technician correction queue; acceptance → coverage/report eligibility. Check each edge without manual refresh and after reconnect.
- A35 Cross-lab, wrong assignee, unassigned technician, read-only/auditor, viewer/external/project and privileged roles: deny unauthorized writes/reads through actual endpoints. Correctly support approved multi-lab authority; missing scope fails closed.
- A36 Events carry no private draft/evidence to unauthorized users and no missing-lab global payload. Role/lab/logout switch clears stale cache and receipts.
- A37 Dashboard counts, their drilldowns, Sample work tab, workflow map, notifications and reports agree on eligibility and reference the same units/versions.
- A38 Deep links by workItemId/run/method/revision/sample, ready-to-submit URL, accepted/history item and invalid/inaccessible target behave correctly with back/forward. No fallback to unrelated first worksheet; editing a checkbox does not reset the active view.
- A39 Fetch failure, stale refresh, empty successful response and loading have distinct states. Dirty data is not replaced by a refresh. No false “offline edits preserved” across reload if only memory exists.
- A40 Human parameter and method names appear in queue, worksheet, Sample, review, notifications and reports. Internal codes/UUIDs are available in details, not primary labels. Display task IDs do not collide.
- A41 Keyboard-only operation, labelled controls, clear focus, error announcements, narrow/tablet layout, light/dark themes and active supported languages. No giant all-task screen or unreadable page overflow.

## Migration and deployment

- A42 Integrity scan read-only and repeatable; recovery dry-run lists before/after, source evidence, authorizations and downstream impact. No automatic checks, backdated audit or cross-matrix relabelling.
- A43 Restore database plus spectra/attachment/report assets to isolated environment; rehearse migration and rollback/forward-fix, including existing approved/submitted/partially complete records. No production test writes.
- A44 Final source checks, meaningful contract/database integration/browser tests and full required CI pass on the exact release commit/runtime. Provide evidence for every untested limitation.
- A45 GitHub push + PR/CI/build digest, production deployed digest and health, migration/recovery ledger, authorized read-only verification and tested rollback recorded. Do not equate merged with live.
- A46 Close linked issues only after proof on the deployed build. Unresolved W001 original-order/evidence verification decisions remain explicit, with accountable lab owner; never claim all repaired if those are pending.
