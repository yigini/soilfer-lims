# Continue the LIMS implementation safely

Project: **C:\Users\yigin\Documents\soilfer-lims**

This handoff contains **implemented, uncommitted source changes plus unfinished implementation plans**. Antigravity is already working in the same project. Use the existing working tree as the implementation starting point. Do not paste old plans over it, run a reset/clean, or copy the snapshot over newer files.

The user has authorized implementation, Git pushes and production deployment. Proceed through the evidence gates below without seeking repeated permission for routine development. Deployment is the end of a verified integration, not the first step after opening these documents.

## 1. Establish the exact starting point

1. Read `manifest.json`. It records the captured Git HEAD, branch, changed/new files, exact SHA-256 hashes, baseline hashes and the included references. The earlier source audit used `bee0b6e`; the current checked-out HEAD also includes the later v3 documentation commit. Neither value is asserted to be the deployed production commit.
2. Run the read-only verifier from the project root:

   ```powershell
   node WP/antigravity-safe-handoff-2026-09-06/verify-handoff.cjs --workspace "C:\Users\yigin\Documents\soilfer-lims"
   ```

   File differences mean the working tree has moved since capture. Inspect and reconcile them individually; a mismatch is not permission to overwrite. Additional edits outside the manifest must also be reviewed using Git status/diff.
3. Capture the current Git status and any existing index changes. Make a named checkpoint commit on an integration branch, normally `codex/catalogue-foundation-and-lab-operations-v3`, or continue the existing appropriate integration branch. Include the listed source files and new shared JSON modules. Stage explicit files, not a blind add of the whole machine/project. Preserve unrelated work. The packaging ZIP and duplicate snapshot directories are recovery artifacts; do not add them to the application source commit.
4. Compare the production commit/image with the local starting point before deciding a merge or deploy path. A local documentation commit does not demonstrate a production release. Inspect the actual remote and push-triggered deployment behaviour before pushing to a release branch.

The source snapshot and patch are a recovery/reference copy. **Do not apply them to this same working tree:** the changes are already present. For recovery elsewhere, check out the manifest baseline in an isolated checkout, verify baseline hashes and apply/reconcile the complete snapshot; the tracked-file patch alone omits new source files. There is deliberately no automatic overwrite or deployment script in this package.

## 2. Read the material in this order

1. `WP/lab-operations-redesign-v3/catalogue-implementation-update.md`: what was implemented, what was tested and what remains.
2. `WP/lab-operations-redesign-v3/implementation-plan.md`, `source-audit.md`, `acceptance-checklist.md`, `catalogue-review-register.json`: the connected O1–O8 scope and original evidence. The 214-analysis/543-method baseline inventory is historical. The revised seed is 176/467; the deployed page was observed with 216 records. Reconcile actual live data rather than replacing it with either inventory.
3. `WP/sample-workspace-redesign-v2`: preserve the sample controls, order revisions, submission/approval, amendment, report and audit requirements already implemented there.
4. `WP/lab-operations-redesign-v3/lab-operations-concept.html`: the latest interactive proposal. Its 58 mockup checks are demonstration checks, not application acceptance results. Older workbench, map and spectral sketches are supporting context and may be superseded.
5. `RELEASE-CHECKLIST.md`: phase deliverables, release constraints and the required final receipt.

Where material conflicts, use the latest user requirements, the current code and the explicit implemented-versus-remaining distinctions above. Do not treat old statements such as “proposal only” or old “do not implement” scope as instructions to stop this authorized implementation. Do not treat a historical plan or test report as evidence that the latest code is complete.

## 3. Integrate in independently testable phases

| Phase | Deliverable and required evidence |
|---|---|
| A — Review the existing foundation | Review the actual diff and all new files. Reproduce the 120 targeted server tests, client build and 16 fixture-browser checks where the runtime is available. These are a baseline, not the full suite. Validate the locked dependency/runtime and Docker build used for deployment. Repair defects in the foundation before building on it. |
| B — Complete task and catalogue contracts | Finish O1 containment across every execution endpoint, including legacy/direct task update, scalar results, batch, import and spectral routes. Centralize task/result kinds, scoped permissions, assigned method versions, preparation applicability and preview/commit validation. No path may silently accept the wrong evidence type, another user's work or changes to sealed results. |
| C — Make bench work practical | Implement durable method/procedure batches with roughly 40 real workflow rows, QC positions, paste/import validation, sample identity checks, explicit per-row draft/record/submit outcomes, conflict recovery and partial failures. Demonstrate a new 10-task queue and a complete 40-sample run. Grouping by a parameter code alone is not a durable batch. |
| D — Compound and derived results | Order texture once; save sand/silt/clay as a linked, atomic result set; calculate a versioned USDA class from valid fractions and carry it into sample/results/report/amendment views. Verify all class boundaries independently. Apply typed output logic to other structured, multi-output, calculated and spectral families. Keep measured, predicted and derived evidence distinct. |
| E — Sample, reports and role dashboards | Preserve revision-2 controls and lifecycle rules. No fresh intake approval, no submitted/approved result edits outside correction/amendment, no lost results on order revisions. Dashboard counts and links must share the same role/lab/project scope and open actionable content. Recheck every supported user group. |
| F — Migration and production release | Implement and rehearse idempotent migration against an isolated production-shaped copy. Check data preservation, rollback compatibility and all release scenarios. Then push and deploy the exact tested commit/image using the established deployment connection. Provide the release receipt below. |

Keep a requirements ledger with **already present / changed / verified / remaining / blocked by missing laboratory configuration** and evidence for every v3 acceptance case. Small commits are useful; do not deploy a half-integrated phase that mixes incompatible UI, API and data contracts.

## 4. Known work that must not be mistaken for finished

- The new preparation checklist is evidence of completion against an applicable lab procedure. Its UI template version is not a scientific SOP revision. Actual SOP applicability, equipment, QC and fresh-soil/water exceptions need configuration.
- New guards deliberately expose invalid or ambiguous catalogue/default settings. Find these in each lab before enabling the release; do not remove the guards to make existing data appear valid.
- The current seed cleanup does not migrate live records. Preserve historical placeholder/imported codes, original values, method IDs, approved results and released reports while disabling or revising unsafe new ordering definitions.
- Grouped texture tasks, independently correct classification, durable batches and all dashboard routes were not completed in the last code pass.
- The prior 120 tests are targeted regressions on an isolated database copy. The 16 browser checks use fixture APIs. They do not validate production data, actual instrument exports, all role combinations or the entire O1–O8 plan.

## 5. Finish with an auditable release receipt

Report: checkpoint commit; integration/pushed commit; deployed commit and immutable image identifier; migration version and before/after reconciliation; protected backup and restore rehearsal; executed test commands/counts; role and workflow acceptance evidence; production read-only verification; remaining method/SOP configuration; and the exact rollback procedure compatible with the migrated data.

Do not report “all done” solely because a build is green or the page opens. Proceed autonomously through authorized work; stop dependent production actions only when a required migration/verification fails or genuinely missing laboratory information makes the scientific configuration unknowable, and report the exact unresolved condition.
