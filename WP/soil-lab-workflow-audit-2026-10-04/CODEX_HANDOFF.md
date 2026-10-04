# Codex implementation handoff

Use the following instruction with the entire `WP/soil-lab-workflow-audit-2026-10-04` packet available in the repository.

## Implementation instruction

Implement the audited soil-laboratory workflow improvements for routine soil fertility and soil characterization at 100–300 incoming samples/day. Read this packet's README, FINDINGS, IMPLEMENTATION_PLAN, RESEARCH and ACCEPTANCE_TESTS before changing application code. The audit baseline is commit `878e894472708076228f590e58bd35ba2a8ecbfa`; revalidate findings against your current branch. Preserve unrelated user work and follow applicable repository instructions.

The intended outcome is an end-to-end traceable workflow from reception to material disposition, a practical physical-run technician workspace, method-specific QA/QC, and selective repeat analyses with retained history. This is a staged implementation, not permission to substitute a generic dashboard redesign or replace the application stack.

Start with WP-00's safe fixture setup and WP-01's confirmed integrity repairs. Reproduce and close the cross-lab legacy-review bypass, unapproved/pending-QC publication, prefilled QC observations, incomplete required control coverage, stale-state batch closure, inconsistent parsing and silent batch transfer. Review acceptance must not treat OPEN/missing QC as passing. Preserve the existing positive safeguards recorded as C01–C03.

Then implement the work packages in dependency order. Extend existing SampleOrderRevision, OrderLine, WorkAttempt, Result, Batch, ReviewDecision, Report, SampleAmendment, inventory and equipment concepts. Unify controller paths through canonical services. Introduce physical portions, method-policy versions, normalized run/control positions, immutable observations/evaluations, explicit repeat lineage and reportable selection where needed. Do not create parallel competing scientific authorities.

Technician operation must be centered on the active tray/run with stable physical position, sample/portion identity, method/stage, visible controls, large usable actions, keyboard/scanner entry and truthful save status. Retain useful paste preview, conflict handling and bulk entry. A queue is for planning; it must not be the only execution model.

Represent field duplicates, preparation duplicates, analytical duplicates, repeated instrument readings and rerun attempts distinctly. A repeat of one analyte must not reopen every other accepted test on the sample. Keep the original measurements and reason for repeat; reporting uses an explicitly accepted selection or approved reducer. Do not average failed attempts into an acceptable value or silently select the last database row.

QC must use approved local method/revision rules, suitable control materials and exact coverage. Rack size cannot determine analytical acceptance criteria. Never install universal blank/RPD/recovery limits for all tests. Source-specific examples in RESEARCH are draft onboarding references until locally approved. Missing method configuration is an actionable release blocker, not an excuse to insert a scientific default. Use strict common numeric parsing and structured qualifiers for censored results.

All release routes must verify the same versioned evidence and scope, atomically. Bind report values and signatory to the actual approved release. Keep previous reports reproducible; handle later corrections through amendments and impact review. Preserve external exchange's existing laboratory/project/country and hold protections. Separate physical storage/return/disposal state from analytical approval.

## Working constraints

- Do not modify production records, deploy, send client messages or purchase services merely because this packet describes those later workflows. Follow the actual task's operational authorization.
- Use synthetic/sanitized databases and per-run temporary paths. Inspect the current default test setup before running it: the audited setup copies the local development database and uses shared teardown.
- Preserve published historical reports. Backfill only proven relationships; mark unknown legacy lineage honestly. Do not fabricate method revision, QC, instrument or reviewer history.
- Keep approved scientific configuration changes auditable and effective-dated. Technician convenience must not permit lowering acceptance limits during measurement entry.
- Use controlled incremental migrations and compatibility projections. Test concurrency, idempotency, partial failures and restore behavior before rollout.
- Treat the source audit as evidence with explicit limits. P08 did not reproduce a stale result; P08b did reproduce replicate collapse. The browser fixture did not constitute a 300-sample lab pilot or validate real instrument integration.

## Expected deliverables per work package

1. Implemented behavior with relevant schema/API/UI changes and a short explanation of the scientific/operational purpose.
2. Meaningful tests from ACCEPTANCE_TESTS and existing regression suites, using isolated fixtures; record exact evidence and remaining failures.
3. Migration/reconciliation notes, compatibility impact and any operational configuration needed.
4. Updated `IMPLEMENTATION_PROGRESS.md` in this packet with completed/in-progress/blocked packages, finding IDs closed, test evidence and decisions. Never mark a package complete on source inspection alone when runtime behavior is required.
5. Reviewable change sets sized for reliable review. Rewrite descriptions around final behavior and evidence, not conversation history.

When a local scientific decision is missing, implement the configuration mechanism and keep that specific method visibly inactive/unconfigured. Continue independent engineering work. Ask focused questions only for decisions that cannot safely be inferred. Do not stop all progress to ask the user to restate this plan.

## First implementation milestone

Deliver WP-00/WP-01 with new regression tests proving that the recorded bypasses fail safely and valid workflows still succeed. Include a route-by-route review/release policy map and updated probe outcomes. Then progress through attempt/material/run/QC integration toward the technician pilot; do not declare the complete laboratory workflow finished after the containment milestone.

Completion means the full agreed core workflow passes the acceptance plan, activated methods have approved configurations, migration/restore is demonstrated, and the actual lab validates the practical bench process. Remaining optional extensions must be explicitly identified rather than silently dropped.
