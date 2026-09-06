# Sample workspace redesign — authorized implementation handoff

The user explicitly authorized Antigravity to implement this redesign, commit/push the relevant changes to Git, and deploy to the existing production platform after required checks. Earlier planning-only wording describes the review stage, not a continuing restriction on implementation. Preserve the ongoing branding, RBAC and spectral work.

Read in order:

1. `sample-page-redesign-plan.md` — revision 2, governing implementation specification, 31 audited findings, complete controls, integration contracts, packages P1–P7.
2. `sample-workspace-acceptance-checklist.md` — 81 required acceptance cases and evidence record. These are requirements, not already-passing tests.
3. `sample-workspace-concept.html` — interactive design fragment with training scenarios. It illustrates selected behaviors; the plan governs missing controls and simplified interactions. Do not transplant fictional fixture data into production.
4. `reference-current-controls.png` — existing sample-header and field-data controls to preserve and correct.

**User-confirmed working folder: `C:\Users\yigin\Documents\soilfer-lims`. Work directly in this repository for implementation, tests, Git commits/pushes and the existing deployment process. The Antigravity project/chat display name LIMSI does not change this filesystem location. Do not switch to or mirror another checkout. This correction supersedes the earlier message's folder ambiguity.**

The source was reviewed at baseline `460598a`, plus concurrent edits. Inspect current changes and repository state here before continuing; preserve ongoing work and verify the configured remote/deployment target. The complete handoff is in `C:\Users\yigin\Documents\soilfer-lims\WP\sample-workspace-redesign-v2`.

Critical remaining issue: recent single/bulk review guards still allow COMPLETED as well as SUBMITTED and exempt closure tasks. They do not satisfy the requirement for submitted, version-bound, authorized evidence review. Do not claim the full redesign is done because early-stage approval is blocked.

Implement all packages with shared server services across sample, workbench, submissions, legacy results, spectral library and reports. Keep intake acceptance, analytical review, report release and physical custody distinct. Preserve original evidence and released report versions; use targeted amendments, never blanket resets or resurrection of disposed material. Do not test destructive workflows on real production samples or fabricate historical results for S003/MOZ examples.

Use isolated regression/integration tests, migration dry runs, backup/restore verification and relevant browser validation. Rebase on latest code, preserve unrelated work, and commit only intended changes. Deploy through the established production process when required checks pass; confirm actual deployed commit and functionality, not merely local build success. Record any hardware/SOP-dependent verification honestly rather than marking it passed without evidence.

First acknowledge that the files have been read and identify the implementation packages. Then proceed with implementation, Git push and deployment under the authorization above. Report actual test results, migration outcomes, remaining blockers if any, and deployed revision. Additional routine confirmation is not needed; genuine destructive data changes or access/security expansion require separate handling.
