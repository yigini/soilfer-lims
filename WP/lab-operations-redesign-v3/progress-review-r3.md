# Progress review 3 — 6 September 2026

Reviewed the uncommitted corrections after `e6dae23` in LIMSI / LIMS Dev. Development should continue. Production release remains on hold because concrete defects persist.

## Verified improvements

- `TextureEditor.jsx` now emits a plain object with named sand/silt/clay fields.
- `docker-entrypoint.sh` now honours an explicit command before application startup.
- Batch capacity/profile and WorkItem rack position fields, corresponding APIs and tests have been added.
- Five incorrect method replacements were removed. A migration marker now prevents subsequent runs from reasserting defaults.
- The ledger now acknowledges that catalogue versioning is unfinished.

Antigravity reports 74 suites / 486 tests passing and a successful client build. Codex did not rerun that whole suite in this review. Instead, Codex independently ran four adversarial checks against a fresh empty database constructed from the local schema, containing only synthetic records. No production database or local development records were changed. Results: `progress-review-r3-probes.json`. Reproducer: `scratch/codex-progress-review-r3.cjs`.

## Reproduced release blockers

1. **Cross-laboratory batch disclosure.** A real authenticated API request by a GTM-LAB1 manager to `GET /api/qc/batches/foreign-batch` returned HTTP 200 with the TUN-LAB1 batch. The new `getBatchById` has no entity scope check. Audit every batch read and mutation, including update, evaluation and disposition, using capability plus entity scope; use allowed update fields rather than unrestricted request-body spreading. Add cross-lab and role regression tests.

2. **Rack collision and QC slot collision.** Adding two samples with explicit position 1 returned HTTP 200 and stored both at position 1. The RACK_40 profile itself reserves position 1 for a blank. Enforce integer bounds, unique occupied positions and QC reservations within the transaction, including concurrency, removal, re-addition and pre-existing membership. Profiles must be approved configuration tied to method/instrument revisions; do not infer scientific QC rules solely from a device name. Forty samples plus required QC must have a physically consistent capacity model.

3. **Fabricated linkage of incompatible historical fractions.** Migration STEP 6 combined sand replicate 1 / AIR_DRY, silt replicate 2 / OVEN_DRY, and clay replicate 3 / FIELD_MOIST into one new RECORDED WorkAttempt. Grouping by sample alone invents an analytical result set. Require demonstrable matching order/material/method revision/replicate/basis/attempt and exact current source versions, or report unresolved history without fabricating an attempt. STEP 8 has the same sample-only fallback and must not automatically claim a wrong class from unrelated fractions.

4. **Unrequested order expansion and lost assignment.** Migration STEP 5 superseded a standalone assigned SAND task and created an unassigned PENDING TEXTURE task. Consolidate only confirmed equivalent unstarted grouped orders, preserving order references, assignment, method, material, batch history and audit links. A standalone fraction or ambiguous history must remain unchanged and be reported for review.

## Other unresolved issues visible in source

- STEP 7 uses coarse sample status instead of task-specific preparation applicability and gate evidence. It writes flags into `checks`; this field can be a boolean array, whose added named properties disappear in JSON serialization. Preserve checklist evidence and use separate durable warning metadata with actual readiness policy.
- The retained default-mapping loop still disables a deprecated method before requiring the replacement to exist. Unresolved mappings must preserve valid choices per laboratory; the presence of one lab's override is not authority to alter a shared default used elsewhere.
- The texture calculator still defaults its options to 1.0 while containing a second fallback of 0.05. WorksheetArea and workbench commands still supply 1.0 when configuration is absent, and the server still accepts positional arrays. Missing scientific configuration needs an explicit unresolved state, not a new universal threshold. Validate parsing and declared closure policy consistently.
- Antigravity's response and ledger claim WorksheetArea and getQueue were updated for rack sorting/badges. At review time neither file contained `rackPosition`, and neither was in this corrective diff. A rack field and a capacity check are not the complete technician batch workflow. Demonstrate the full browser flow with 40 samples and configured QC, including save/reload/conflicts/partial failures.
- Catalogue edit versioning remains pending. Audit the other claimed complete analytical families and all roles against actual requirements and tests, not file names alone.
- Table counts cannot substantiate "100% row preservation"; compare protected row contents and references, exercise asset restoration, and document intentionally transformed rows separately. The migration marker table is created outside the dry-run transaction, so a dry run is not wholly mutation-free.

## Next action

Fix the reproduced defects and close the remaining acceptance gaps. Turn these counterexamples into assertions of denied/safe behavior. Keep failed and incomplete ledger items open, then run the complete regression suite and actual browser acceptance checks against the exact release candidate. The production hold is evidence-based; routine implementation needs no further approval. Deployment remains authorized once the original release criteria are actually satisfied.
