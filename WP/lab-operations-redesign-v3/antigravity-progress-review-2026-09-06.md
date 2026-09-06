# Codex review of Antigravity progress and implementation go-ahead

6 September 2026. Project: `C:\Users\yigin\Documents\soilfer-lims`. Reviewed checkpoint `8747b8a` and the subsequent uncommitted changes, plus Antigravity's `implementation_plan.md` from the active LIMS Dev conversation (`80c11c12-5cb7-4455-a433-01544d488498`).

**Decision: proceed with implementation after incorporating the corrections below.** This is permission to continue the already-authorized work, including eventual push/deployment after the existing release criteria pass. It is not acceptance of the current tree as production-ready or permission to omit parts of the original plan. Do not pause again for routine plan approval.

## Verified progress

- The verified source checkpoint exists on `codex/catalogue-foundation-and-lab-operations-v3`.
- The implemented-versus-remaining summary broadly understands the assignment.
- The `targetLab` audit reference was changed to the sample's assigned laboratory, removing an undefined-variable path.
- Codex independently ran the full server suite against the test harness's isolated copy: **69 suites, 429 tests passed**. This used the current local development database as the fixture source, including its recent reconciliation; it does not prove a production migration or every scientific workflow is correct.
- The application changes since checkpoint are still limited: two controllers and two test files. Durable batches, grouped texture, dashboards and the release migration remain implementation work.

## Mandatory corrections before relying on the new plan

### 1. Fix the newly introduced package-ID ambiguity first

`receptionController.js` now uses `Array.find()` with exact, case-insensitive and punctuation-stripped comparisons in one predicate. With records in order `a-b`, `ab`, requesting **exact ID `ab` returns `a-b`**. A null/numeric package ID also reaches `.toLowerCase()` and can cause a server error.

Validate package IDs as non-empty strings. Prefer exact canonical identity before considering aliases. If legacy aliases are required, resolve only explicitly mapped or unique scoped aliases and reject ambiguity rather than taking the first record. Persist the resolved canonical package IDs so package references/deletion protection remain correct. Test exact-vs-normalized collisions, multiple aliases, invalid types and cross-lab packages at the API boundary.

### 2. Keep scientific closure rules method-specific

The new plan replaces the rejected universal ±2% rule with another universal rule, `abs(total - 100) < 0.05`. That is not an approved method/rounding policy and is not merely floating-point precision. For example, three displayed fractions of 33.3 total 99.9; validity must follow the adopted procedure and retained precision, not a hardcoded threshold introduced during implementation.

Follow section 5 of the original v3 plan: explicit inputs, 0–100 bounds, full stored precision, configured closure/rounding policy, no silent rescaling of failed measurements, and unavailable classification when evidence is insufficient. If a fraction is calculated by difference, mark it DERIVED. Preserve the original fractions and any authorized adjustment. Classification boundaries must be independently tested; the server is authoritative and the client preview must agree.

### 3. Implement the full typed and durable workflow

The new B/C section lists four backend guards but does not yet specify the full procedure/material/attempt contracts, station preparation or 40-sample workbench. Retain **O1–O8** from the original implementation plan, not only the selected files in the new summary.

In particular: procedure/method revision, preparation applicability, material/aliquot and attempt identity; persistent batch membership/order, QC positions and evidence; batch-centric UI; named typed drafts; per-row receipts, idempotency, stale versions, partial failure and recovery. Demonstrate the 10-task queue and actual 40-sample interaction. Keep every existing entry endpoint in the command/permission/readiness matrix, including direct task-status updates and all imports.

### 4. Texture needs a versioned result set and full downstream wiring

Use named members (`SAND`, `SILT`, `CLAY`) in the durable contract; do not rely on positional arrays as the meaning of stored measurements. Create an append-only linked result set, derived class, audit and receipt atomically. Record exact source-result IDs, method and algorithm revisions, material, replicate, basis and attempt. Do not update approved fraction rows in place or assemble a class from different attempts.

Include every existing alias (including the actual lowercase `pSA`), order/group selection, existing-order migration, task assignment, all editors/entry routes, sample results, Data Results, export, report release and amendments. The new plan's listed controller/editor changes alone do not establish those connections. Review the other multi-output/derived/catalogue families as specified in O2/O5.

### 5. Preserve real spectral coverage

Replacing the nonexistent `COND_H2O` with a configured EC fixture is reasonable. Replacing the old `SPECTRAL_1`/`Spec OK` golden-path step with SOC makes that path numerical; it does not validate spectroscopy. Add a genuine spectral path using supported scan fixtures through intake, QC, submission, review and linked results/library/report behaviour. Keep scalar-rejection coverage. Do not describe the revised numerical scenario as spectral acceptance.

### 6. Turn local default reconciliation into a reviewed migration

A read-only comparison of `server/prisma/dev.db.pre_reconciliation_bak` and the current local DB found **75 methodology records changed from default=true to false**, with the same 590 methodology IDs/count. The 38 synthetic placeholder codes now have no default. This describes the local files only, not production.

Keep the backup private and out of Git; its current `.pre_reconciliation_bak` suffix is not ignored. Do not replay a `meth-std-*` prefix rule on production as scientific approval. Create an explicit, per-parameter/per-lab mapping with chosen method identity, reason, unresolved cases, dry-run output and before/after reconciliation. Preserve existing assignments, result methods and released evidence. Reproduce tests with deterministic fixtures or an explicitly rehearsed data setup rather than relying only on an untracked, manually adjusted development DB.

### 7. Preserve the full dashboard and sample/report scope

ManagerQueue lane fixes are useful but not the whole dashboard work. Cover every canonical role, shared scoped counts and destination rows, active landing selection, refresh/invalidation, permission-negative tests and project/lab isolation. Preserve all sample-workspace-v2 controls and validate group review, approval, corrections, amendments and immutable reports across both old and new entry surfaces.

### 8. Correct the deployment procedure before execution

The new plan still proposes extracting packages inside the existing container and restarting it. That is not the tested immutable application image required by the handoff, and container recreation can discard such replacements. Deploy the complete tested client/server/shared-runtime image through the established deployment configuration, recording the exact commit and image identifier.

Remove/guard **both** the automatic `prisma db push` and unconditional seed paths; removing only `seed.js` leaves the unsafe startup behaviour. A versioned migration must fail closed. Rehearse it on isolated storage, test repeat runs/failure recovery and rollback compatibility, and verify the protected database plus uploaded/spectral files backup can be restored. Do not restore an old DB over new production writes without reconciliation. Retain row-level preservation evidence, not only counts or an HTTP 200 response.

## Execution and acceptance

Update the implementation plan/requirements ledger with these corrections, then continue autonomously. Each original acceptance case needs its actual status and evidence. Use the existing release checklist before the already-authorized push/deployment. The current green suite is a baseline, not permission to close unimplemented requirements or mark production acceptance passed.
