# Release review and GitHub completion instructions

6 September 2026. Project: `C:\Users\yigin\Documents\soilfer-lims`. Antigravity: LIMSI / LIMS Dev. Repository: `https://github.com/yigini/soilfer-lims`.

## Decision at d03891f

The four original review-3 counterexamples now pass in Codex's independent rerun. Antigravity reports 74 suites / 494 tests passing and a successful client build. These are useful improvements, but this candidate is **not yet approved for production cutover**.

Codex independently reproduced an additional QC bypass using synthetic data in an empty local schema: a `LAB_TECHNICIAN` sent `PUT /api/qc/batches/own-batch` with `{ "status": "QC_PASS" }`; the server returned HTTP 200, persisted `QC_PASS`, and still had `qcResults: null`. See `release-review-r4-probes.json` and `scratch/codex-release-review-r4.cjs`. No real laboratory records were changed. The concurrent-position probe rejected the second request in this run; that observation is not proof of concurrency safety across all schedules.

The user authorizes completing implementation, committing and pushing all relevant changes to GitHub, deploying after verification, and finally opening/reopening/updating/closing GitHub issues according to actual outcomes. No further routine approval pause is needed. This instruction does not waive the release criteria.

## 1. Finish the remaining implementation and verification

- Close the reproduced QC bypass. General batch updates must not manufacture QC acceptance or change protected membership/state fields outside the validated commands. Required QC evidence, evaluation and authorized disposition must be enforced server-side. Test direct status writes, contradictory failing QC plus a supplied `QC_PASS`, reopening sealed batches, and alternate update routes for each applicable role. Do not weaken checks merely to retain a passing fixture.
- Reconcile the remaining review findings. The workbench controller still supplies `1.0` when tolerance configuration is absent and converts positional arrays before validation. The migration still uses `2.0`, selects historical fractions without checking current/superseded versions, and groups by sample/replicate/basis without establishing compatible method/material/attempt provenance. Preserve ambiguous records as unresolved rather than fabricating equivalence; carry exact known source identities for valid sets.
- Complete missing original requirements, including catalogue edit versioning and the actual technician batch workflow. A rack badge does not establish usable batch creation, selection, QC, saving and handoff.
- Execute and save a real browser acceptance run on isolated fixtures: forty samples plus the procedure's required QC, practical method switching, paste mapping, decimal input, saved drafts and reload, partial errors, concurrency/reassignment, texture, spectroscopy, approvals/amendments and role-specific dashboard links. Exercise desktop/narrow layouts. Do not label an API test or client build as this browser evidence.
- Correct A98/A99 and other ledger statuses. Database transaction rollback is not a database-and-assets restore rehearsal. A passing unit/API suite and build are not the full forty-sample browser acceptance run. Leave any incomplete item open with its exact evidence or blocker.

## 2. Commit and push the complete release to GitHub

- Work from the existing branch `codex/catalogue-foundation-and-lab-operations-v3`; inspect the actual tree and remote state before integrating. Preserve other work and avoid force pushes or resets.
- Include all intended client, server, shared runtime data, schema/migration, regression tests and useful implementation/release documentation. Put the authoritative ledger, walkthrough and release evidence in `WP/lab-operations-redesign-v3` so GitHub contains the reviewable release materials currently held only in Antigravity's artifact directory.
- Audit untracked and ignored files before staging. Do not commit databases, database/test copies, production backups, uploaded files, credentials, generated dependencies, build archives or redundant recovery snapshots. The old deployment helper contains embedded environment configuration; replace secret literals with the deployment's configured secret source before making a versioned release helper.
- Push the implementation branch, create or update the appropriate PR, and complete integration through the repository's normal protected-branch process. The current CI workflow runs on main or a PR targeting main, so a branch push alone does not prove CI ran. Do not bypass repository protections. Resolve real CI failures, including deterministic test-fixture setup, without seeding or testing against production.
- Record and verify the exact final commit on GitHub. Run the complete checks against the final integrated commit if integration changes it. Build the complete application image from that commit and record its immutable image ID/digest. A local commit without a verified remote push is not completion.

## 3. Rehearse deployment and recovery

- Update the deployment procedure for the final commit. The old `scratch/deploy_ops_v3.js` still targets `e6dae23` and stops/removes the old container before replacement validation; do not run it unchanged.
- Use a complete client/server/shared-data image. Rehearsal commands must use the explicit intended entrypoint, working directory and isolated database path. Candidate startup must use isolated database and asset copies, not a second writer against production volumes.
- Verify migration dry run, first apply, repeat apply and failure recovery using the actual pre-release schema and representative records. Compare protected row contents, IDs, references and file hashes; separately explain intentional transformations. Retain an actionable report of unresolved laboratory configuration.
- Take a fresh coordinated database/files snapshot before cutover. Restore both into isolated storage, start the candidate against it, and check representative spectrum/result/report links. Account for writes after an earlier snapshot; do not use the stale backup as a substitute for the final checkpoint.
- Record the working production image, mounts/configuration, migration versions and rollback compatibility without exposing secrets. Validate the replacement before removing the recovery path. Define how failure is recovered and how any newly accepted writes are preserved.

## 4. Deploy and verify

Once the preceding checks actually pass, deployment is authorized without another general confirmation. Deploy the exact tested image/commit, apply the verified migration, and confirm readiness before reopening normal writes. Stop the cutover on a failed gate and continue with the documented recovery path; never represent a failed gate as a successful deployment.

Verify the running image/commit and migration version, application health, catalogue availability, workbench/sample/dashboard access, scoped permissions, approval controls and representative report/file retrieval. Use read-only checks on real production records; laboratory mutations belong in isolated acceptance fixtures.

## 5. GitHub issues — the final task

- After verifying the deployment, inspect relevant existing open and closed issues. Match issues to implemented behavior and acceptance evidence; avoid creating duplicates.
- Close an issue only when its complete acceptance criteria are satisfied by the deployed release. Comment with the deployed commit, PR if applicable, and specific test/production verification evidence. Do not close issues just because code was committed or a build passed.
- Keep partially implemented or unverified work open. Reopen an issue that was closed prematurely, or create a clearly scoped issue when no matching issue exists for a confirmed remaining defect or agreed follow-up. Include a concise reproduction, expected/actual behavior, impact and acceptance criteria, without private lab data or secrets.
- If deployment is blocked, record the blocker and preserve the relevant issues as open; do not claim the release has shipped.
- Finish with the GitHub commit/PR, deployed image and migration receipt, backup/restore evidence, verification results, links to issues closed and opened/reopened, and any remaining laboratory configuration. Verify remote state for each claimed GitHub change.

Database-size findings are a separate maintenance item. Do not add a production metadata deduplication, compaction or backup deletion to this release without preparing and validating that change in its own scope.
