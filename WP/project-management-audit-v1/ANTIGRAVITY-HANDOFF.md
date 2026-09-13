# Antigravity request — project management audit implementation

## Current authorization — 14 September 2026

The user has now explicitly requested: **"ok now send it to antigravity for safe implementation and deployment"**. Implement this package, push reviewed changes to GitHub, merge through the normal reviewed/green-CI workflow, and deploy to production after the documented technical release gates pass. This supersedes earlier instructions to hold solely pending the user's release decision, including the conditional planning language below. It does not waive backup, migration, integrity, access-control, CI or live-verification gates. Preserve and integrate the existing laboratory-governance candidate as required; do not restart an unrelated broad audit or discard accepted fixes. If a concrete unresolved data conflict or failed safety gate blocks deployment, explain it clearly and continue independent work; do not deploy through the failure.

Use the verified current production mechanism, record the deployed commit/image, and verify the live project pages after release. Read `WP/lab-governance-audit-v1/18-independent-release-handoff.md` for retained backup/recovery and evidence limits. Use a consistent SQLite online backup, or stop every writer before a filesystem snapshot; checkpoint-then-copy while writers run is not safe. Preserve all post-deployment data during recovery.

Work in **LIMSI**, repository **C:\Users\yigin\Documents\soilfer-lims**. First verify this folder and its Git remote; do not accidentally use the older alternate checkout. The complete package is:

`C:\Users\yigin\Documents\soilfer-lims\WP\project-management-audit-v1`

Read README, 01-audit-findings, 02-implementation-plan, 03-contracts-and-connections and 04-acceptance-and-release in full. Open review-preview.html for the design direction. The preview is synthetic, standalone and contains no LIMS implementation code or API connection. The policy and acceptance documents take precedence over illustrative numbers/layout shortcuts.

The reviewed local source was commit `aeb62f7fac91412ea23a7c6871f0f7370d656a23` on `codex/lab-governance-v1`; PR #94 was still open at audit time. Establish what is actually merged and deployed now before making changes. Preserve existing lab-governance work and untracked user files. Do not reset, force-push or overwrite another checkout to match this old baseline.

Implement a practical project workspace and repair its connections, not just a prettier Projects.jsx. Treat the following as release blockers:

- Project archive currently can save COMPLETED then return 500 from a bad response-helper call.
- Trash removes even released samples' project relationship and rewrites projectCode to RESTORE tags.
- Read/edit/import/archive/sample-list/lab-access use inconsistent scope and ownership rules.
- Empty servicing membership can be repopulated by country fallback; generic PUT bypasses the dedicated writer.
- Creation may claim all manifest samples were registered despite failed insertion; audit failures can leave committed mutations with failed responses.
- Project rows/counts mislabel received as total and omit modern lifecycle states; live SoilFER US showed 0 total volume but 26,603 expected in statistics.

Use the supplied isolated fixture evidence to reproduce, then turn cases into regression tests of the corrected behavior. Do not run mutation probes on production or copy the local dev DB onto the server. Existing reports, results, sample identities, user scope and histories must survive.

Keep delivery bounded and staged: (1) baseline and integrity/access repair, (2) relationship/source reconciliation and connected readers, (3) practical workspace, (4) acceptance and release evidence. Implement all documented core connections; do not add unrelated product features, rewrite the entire auth system or create a second result-entry path. Use current canonical analysis catalogue, workbench gates, texture/spectral flows, staff/lab governance, locale/theme/help and offline-draft services.

Important behavior: explicit lab/project access; role-specific project scope; admission pause separate from stopping current lab work; archive separate from approval; stable historical project links; future-only analysis defaults; imports with preview and exact receipts; current authorization and version checks on every write. Support en, es, es-419, fr and pt. Light remains default and existing dark/profile/session preferences remain. Mobile project management must not break desktop or offline laboratory drafts; governance commits require online validation.

Before migration, provide the actual reconciliation dry-run report and resolve ambiguous access expansion with an authorized owner. Do not infer grants from matching countries. A UI feature flag must not leave insecure old APIs accessible.

This handoff prepares implementation. Use the user's current release authorization in the receiving chat; do not assume a planning artifact proves deployment permission or readiness. If deployment is authorized, finish validation, push the reviewed changes to GitHub, deploy the exact reviewed artifact, verify the live revision and pages, and update issues only according to evidence. If not yet authorized, leave a tested reviewable PR plus concrete migration/deployment evidence ready for the final decision.

Please communicate in friendly, simple English while working. Give short meaningful updates such as “I fixed the project counts. Next I’m checking that each lab sees only its own samples.” Explain the effect on laboratory staff before technical details. Say clearly when a test failed, what is blocking progress and what you are doing next. Avoid long internal reasoning, jargon, repetitive test-loop updates, unsupported estimates or “all done” before GitHub/deployment verification. Do not ask the user to repeat information already in this package.

Your final handoff must include a finding-to-fix checklist, tests and remaining exceptions, migration results, commit/PR, and deployed revision only if actually deployed. If a defect is absent on the reconciled baseline, record evidence instead of reintroducing an old implementation. Never claim zero defects; demonstrate the specified release gates.
