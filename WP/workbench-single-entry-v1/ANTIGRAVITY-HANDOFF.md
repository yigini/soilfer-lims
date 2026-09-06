# Antigravity handoff — remove contradictory laboratory entry paths

Project **LIMSI**, active chat **LIMS Dev**. Work only in **C:\Users\yigin\Documents\soilfer-lims**. Read this package at **WP/workbench-single-entry-v1** on top of the latest source. The user requested this focused follow-up and previously authorized safe implementation, GitHub push/PR/CI and production deployment. Do not restore an earlier snapshot or confuse this package with another project folder.

## What the user is experiencing

Marco could complete preparation from Sample but could not see a dependable completion/submission path in Workbench. Now the manager is told preparation must be submitted, while Marco has no visible way to submit it. The user wants **laboratory recording only in Workbench; Sample displays it**, with no double work. All other authorized Sample controls must remain.

The read-only W001 audit found:

- Preparation COMPLETED, result `Done`, no submission or draft/checklist. Workbench main queue excludes completed tasks, and Review & Submit does not fetch the submission preview on fresh entry.
- Drying has genuine saved checklist evidence and a submission, but the item is ACCEPTED while its one-item submission remains PENDING_REVIEW; no ReviewDecision rows were observed.
- Active order = 11 PLANT analyses, tasks = 13 SOIL analyses +2 preparation tasks. This is a substantive mismatch. Verify original intake/request/history before deciding the correct order; never remap plant to soil or simply rewrite counts.
- Legacy Sample writer persists COMPLETED before its attempted auto-accept mutation; the latter is not saved. This shortcut accepts bare `Done` and updates gate flags separately.
- Workbench draft/completion responses can say success:true with saved:0/errors, and the UI still displays saved/success. Restoring a submit button alone would submit `Done` without proper evidence.

These are confirmed in `source-audit.md`; four isolated actual-controller probes are in `defect-probe-results.json`. No production records were changed by Codex. W001 is active lab work: do not reproduce destructive/duplicating operations there.

## Required reading and response

Read README, source-audit, implementation-plan, acceptance and the interactive prototype. The prototype is synthetic and intentionally narrower than the production requirements; implement the written contract, not its in-memory demo shortcuts. Link this follow-up to the existing laboratory operations v3, sample workspace v2 and role dashboard packet, including dashboard PLAN-REVIEW-2026-09-06. Do not drop their permission/release/control requirements.

Before editing, reconcile the newest HEAD, working tree, PR #55 state and actual deployed image. The audited baseline was eff4449 locally, cdcc2cb production; that may have changed while you were completing CI/deploy. Do not claim the dashboard release fixes these faults unless the code and tests demonstrate it. Save/review your current work and implement this as a clearly tracked follow-up on top, with no concurrent deploy or restoration of old code.

Revise your implementation plan to explicitly map W01–W17 and A01–A46. In your first progress update, explain the deadlock plainly, state the chosen operational confirmation/verification lifecycle, identify any verified cause of W001's order mismatch and distinguish unresolved scientific decisions from implementation work. Then carry out authorized implementation and verification; do not repeatedly ask the user for routine coding/deploy permission already given.

## Non-negotiable implementation outcomes

1. One canonical command/evidence path. Workbench owns technician checklists, results, texture groups, spectra and submissions/corrections. Sample execution view is read-only with exact Workbench links. Preserve reception, assignment/order management, manager review, custody, labels/map/field data, amendments, report/audit controls.
2. Routine operational confirmation has saved checklist evidence and receipt and unlocks only applicable work per SOP. It does not masquerade as scientific manager approval. Required second-person verification, where actually configured, has a real handoff and queue; no deadlock.
3. Ready to submit loads on every direct entry/reload and after the last assigned task disappears. Scientific submission targets exact selected immutable attempts/versions and active order, independent of draft/worksheet state. Generic old APIs cannot bypass the new contracts.
4. All views display the same typed recorded evidence, execution/review states, readable names and named count units. No empty rehydrated checklist after successful completion, hardcoded SOP facts, false Saved badge or wrong-method fallback.
5. Commit-time scope/assignment/order/receipt/gates/QC/equipment/version validation, atomic evidence/flags/decisions/submission aggregates, idempotent receipts and correct invalidations. Test races, partial responses and late autosaves, not only happy-path selectors.
6. W001 and similar records get an integrity scan and dry-run repair preview. Preserve original evidence/history. No automatic affirmative checklist, forged/backdated review, hidden order change or production test measurement. If existing records cannot establish the intended order or completion, ask the lab's authorized person for that specific scientific decision through a clear exception flow; keep other implementation work moving.

## How to communicate while working

Be friendly and concise. Give short updates when there is meaningful progress: **what now works, what you are checking, and what remains**. Use simple laboratory language rather than internal code terminology. Example: “Preparation now stays completed when Marco returns. I am checking that the manager sees the same record and that unfinished results cannot be approved.”

Do not expose hidden reasoning or narrate every command. Do not repeat “waiting for tests” every few seconds. Report a failure with its practical effect and next step. Do not say “fully fixed”, “zero issues”, “deployed” or “all tests pass” without concrete evidence on the final version.

## Verification, GitHub and release

Turn the included defect probes into desired-behaviour regression tests against the real application/database and add the browser journeys in acceptance.md. Run necessary full checks in the production-compatible runtime. A mocked test suite and static screenshot alone are insufficient.

Complete implementation through PR and CI on GitHub, with no unrelated/unreviewed files or production data in the commit. Include this documentation deliberately if useful; do not blindly stage the entire working tree. Use consistent restorable DB + spectra/attachments/reports backups, rehearse migrations on a protected copy, record exact image/commit and rollback compatibility, and deploy only the verified build. Never replace production DB with a local/test DB.

Verify production health/version and authorized read-only projections after deployment. Record code-deployment status separately from any pending W001 evidence/order reconciliation. Open/link issues for discovered defects and close only demonstrated deployed fixes; unresolved scientific verification stays visible. Return a short human-readable outcome and evidence ledger with commits, PR, CI, image, backup/recovery paths and remaining decisions.
