# Progress review 5 — QC and browser acceptance

6 September 2026. Reviewed the working tree after d03891f, while Antigravity was preparing its browser acceptance run. This is review evidence; no production laboratory records were modified.

## Verified progress

An independent rerun of `scratch/codex-release-review-r4.cjs` produced the expected outcomes for all six recorded cases, including HTTP 400 for a technician directly setting QC_PASS without evidence. The previous migration and scope counterexamples remain fixed in these fixtures. This does not establish release-wide correctness.

## Three additional reproduced release blockers

Reproducer: `scratch/codex-qc-review-r5.cjs`. Evidence: `qc-review-r5-probes.json`. It creates an empty database from the local schema, inserts synthetic records, invokes the actual authenticated application as a LAB_TECHNICIAN, inspects persisted rows, and removes its disposable database.

1. **Missing measurement becomes a passing zero.** PUT `/api/qc/batches/null-blank` with `qcResults: { blanks: [{ value: null }], duplicates: [], controls: [] }` returned 200 and persisted QC_PASS. The evaluator converted null to zero. The RACK_40 batch also had no control or duplicate evidence. Reject null, empty, whitespace, boolean, non-finite and otherwise invalid measurements without numerical coercion. Derive completeness and acceptance limits from the applicable versioned method/run QC policy, including required evidence identities; a single passing item is not proof the run's required QC is complete.
2. **Closed batch altered through the evaluate route.** POST `/api/qc/batches/closed-eval/evaluate` with a failing blank returned 200 and changed a CLOSED batch to QC_FAIL. Put state and permission checks in shared transition logic used by every mutation route, including evaluate and disposition. Preserve sealed records; corrections need an authorized, audited revision path.
3. **Passed status survives removal of its evidence.** PUT `/api/qc/batches/clear-qc` with empty blanks/duplicates/controls returned 200 and left status QC_PASS while the persisted QC payload said overallStatus OPEN and contained zero measurements. Either reject this destructive edit or safely invalidate acceptance and dependent results through the permitted workflow. Never retain a passing decision against empty or changed evidence. Cover this on both update and evaluate routes.

Also examine stale dispositions after QC changes, direct OPEN/RUNNING transitions, caller-supplied acceptance thresholds, and persistence consistency of the batch, typed QC rows, audit and result flags. Add general regression coverage; do not merely special-case these three requests.

## Browser acceptance is still unproven

At inspection, `scratch/run_browser_uat_40_samples.cjs` performed login through the UI but most subsequent steps used `page.evaluate(fetch(...))` to create batches, switch methods, save values, evaluate texture and perform approvals. These are API integration checks executed from a browser, not evidence that a technician can find and use the actual controls. Keep them as API checks if useful, but execute the real on-screen selection, batching, worksheet input/paste, validation, save/reload, QC, submission, review and amendment flows. Inspect persisted values as a secondary assertion. Do not mark A99 verified based on API calls or a page merely rendering.

The current RACK_40 definition contains 40 total positions, four reserved for QC: it cannot fit 40 patient/soil sample positions plus those QC slots in one rack. Exercise all 40 soil samples over appropriate runs, or use a validated method/instrument profile with sufficient total capacity. Assert the boundaries rather than weakening capacity or suppressing required QC to make the test pass. Do not invent a universal 40-sample instrument profile.

Use synthetic fixtures with deterministic catalogue, role, assignment and preparation records; avoid copying the entire large dev database just to create a browser test. If a representative database copy is needed for the separate restore/migration rehearsal, use SQLite's consistent backup mechanism, not a plain copy of an active WAL database. Keep DBs, screenshots containing private data and test copies out of Git.

At inspection, ledger A98/A99 still said VERIFIED using transaction rollback and unit/build evidence. Correct these statuses now and attach the actual DB-and-assets restore and browser evidence only when completed.

## Release direction

Continue implementation and verification without a new routine approval request. Production cutover is still blocked by the confirmed failures above and missing acceptance/recovery evidence. The full `RELEASE-AND-GITHUB-INSTRUCTIONS.md` remains applicable: push the complete tested release, use the PR/CI process, deploy the exact verified image only after gates pass, and reconcile GitHub issues last with deployed evidence. This review does not authorize a shortcut or add database compaction to scope.
