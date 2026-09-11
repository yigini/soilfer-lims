# Antigravity handoff — Laboratory management and connected access controls

Work in **LIMSI**, folder **`C:\Users\yigin\Documents\soilfer-lims`**, existing project conversation **LIMS Dev**. This is the laboratory governance package. On 11 September 2026 the user approved proceeding: **“ok ask antigravity for a safe implementation.”** Begin the actual implementation in the stages below; do not stop at another plan-only response. Preserve unrelated work, protect administrative access and complete the required tests. Follow established release authorizations only after the documented deployment gates pass; the prototype and synthetic probes are not production acceptance evidence.

Read the complete folder **`WP/lab-governance-audit-v1`**:

1. `README.md` and `01-audit-findings.md` / `findings.json` — 29 findings and exact source anchors.
2. `02-implementation-plan.md` — seven staged work packages.
3. `03-policy-and-contracts.md` — role defaults, invariants, lifecycle, proposed API and data contracts.
4. `04-connections-and-migration.md` — all connected surfaces and safe reconciliation plan.
5. `05-acceptance-and-release.md` — 42 blocking scenario groups, role journeys and release evidence.
6. `review-preview.html` — interactive visual direction with synthetic data only.
7. `audit-probes.cjs`, `probe-results.json`, `build-evidence.cjs` — actual-handler synthetic reproductions with explicit limits. Thirty-one checks reproduce: 29 finding checks and two positive controls. These are evidence of current behavior, not passing production tests.

The audit baseline is `ecb7c91aee041febfb60de51d248f322b6d6376c`. First inspect the current branch, dirty files, applicable repository instructions, actual Prisma schema and deployed commit. Reconcile newer work with the source anchors and hashes. Preserve Help v2, feedback fix, translations, themes, mobile drafts, current workbench/sample/spectral and catalogue improvements. Do not reset the repo, roll back unrelated work, copy a database over production or implement the preview as a separate disconnected application.

The most urgent changes are real server behavior:

- Lab/staff routes can bypass actor lab scope and target hierarchy; generic branding permission must not authorize recovery, global lab creation, language deletion or SIS key management.
- Remove predictable shared recovery/default passwords. Use named activation, unique expiring tokens, session revocation and a verified retained administrator.
- Offline completion uses an alternate write path and draft save can claim success without persistence. Reuse the online domain services; bind outbox/pack to its original user and lab.
- Shared-project access does not mean authority to edit/archive/delete the whole project. Reconcile owner, serving labs and individual grants safely.
- Scope and redact every Kobo path, scope SIS key administration and fix omitted lab grants without removing fail-closed consumer checks.
- Resolve national Users/dashboard/project inconsistencies and permission drift across staff screens, assignment, equipment, inventory, notifications and sessions.

Do **WP-A security repairs first**, with companion positive tests and protected recovery. Then implement the common policy/relationships, staff lifecycle, lab lifecycle and workspace UI. Read the complete contracts before coding; the requested outcome includes functionality and all connections, not a cosmetic rewrite. Keep all ten roles and all five configured locales. Use existing scientific validators, workflow gates and method snapshots. Do not infer managerial review authority from a project/branding role or invent competence records.

Before any schema change, produce the read-only mismatch report and test migrations on a disposable isolated database/snapshot. Do not run existing DB-touching tests until their path routing is proven safe. The audit intentionally did not mutate live roles/labs; reproduce write issues in a strict-schema staging/test environment. Never create a production exploit demonstration.

Use transaction/revision/idempotency guards for sensitive commands. Preserve historical authorship, issued reports, spectra, sample identifiers, lots and drafts. Account disable can happen immediately for security even when work needs reassignment. Lab resume must never re-enable individually disabled users. Prevent concurrent removal of the last eligible administrator. Keep unknown offline devices explicit; do not promise instant revocation on disconnected hardware.

Maintain a finding checklist keyed LG-01–LG-29 and tests A01–A42. Each completed work package needs actual tests and a short review note: what changed, why it helps the lab, what was tested, what remains. Preserve initial evidence and create a separate post-fix report. Never label all findings fixed based only on a build or mocks.

For decisions about national directors managing lab managers or project leads editing global metadata, use the conservative explicit-delegation default documented in the policy; flag any requested expansion separately. Do not stop ordinary work just to invent a permissions model, and do not silently grant new powers.

If later authorized to deploy: push all intended commits to the correct GitHub repo, follow the tested migration/recovery/compatibility sequence, verify the deployed commit, run read-only production smoke checks and update issues with evidence. Keep sensitive finding details private. Do not close unresolved items or claim production readiness without release evidence.

Please communicate in simple, friendly English while working. For example: “I’m making sure a manager can only change staff in their own lab. Next I’ll test that existing technicians can still open their work.” Explain problems and their effect on lab staff before technical details. Give concise progress updates at meaningful milestones; distinguish implemented, tested, pushed and deployed. Avoid unexplained acronyms, walls of logs, vague success claims and repeated permission requests for routine work already authorized.
