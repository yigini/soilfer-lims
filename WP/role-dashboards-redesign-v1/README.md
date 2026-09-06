# SoilFER role dashboards — implementation handoff

Prepared 6 September 2026 for Antigravity, **LIMSI / LIMS Dev**, working folder `C:\Users\yigin\Documents\soilfer-lims`.

The home page should answer three questions: **What needs my attention? What can I do now? Where do I continue?** It should take laboratory staff into the existing controlled workflow, with the right sample, method, batch and filters already selected.

This package contains proposed design and implementation assets. It does not install a dashboard or change laboratory records. All prototype names, identifiers, dates and counts are synthetic. Do not use its fixtures as production data or copy its client-side logic as authorization.

## Start here

1. [Interactive design](prototype.html): all ten registered roles, queue switching, method batches, search, pagination, detail previews, empty/error/stale states and mobile layout.
2. [Implementation plan](implementation-plan.md): sequence, scope, design rules, exact component changes and release gates.
3. [Source audit](source-audit.md): confirmed code findings and questions requiring implementation-time verification.
4. [Data and navigation contracts](contracts.md): scope, count definitions, lifecycle, permissions, routes, refresh and error behavior.
5. [Role and control coverage](role-control-matrix.md): every role and existing dashboard control accounted for.
6. [Acceptance scenarios](acceptance.md): release-blocking coverage, including 40-sample bench work and multiple labs.
7. [Antigravity instructions](ANTIGRAVITY-HANDOFF.md): implementation, GitHub, deployment and plain-language updates.

`prototype.css`, `prototype.js`, `assets/soilfer-logo.png` are portable design assets. `dashboard-contract.reference.cjs` and its tests demonstrate safe filter composition, exact group totals, default-lane selection and response availability. They are reference changes, **not** a replacement laboratory policy engine. `verify-prototype.cjs` checks the design artifact; its output does not certify the application.

## Relationship to current work

Antigravity was completing `WP/reception-correction-review-2026-09-06/` during this audit. Baseline application was `ffbbe28`; reception commit `3c4121a` appeared during preparation. Later fixes may supersede specific lines. Inspect HEAD and the working tree before implementation; preserve reception safety fixes and recheck findings against the candidate. Do not apply the old immutable handoff snapshot over current files.

Reception PR54 was then merged as `cdcc2cb`; the scope-composition and missing-drying corrections are present in that source. See the audit's integration note rather than reintroducing an already repaired defect.

Relevant earlier specifications: `WP/lab-operations-redesign-v3/` (method batches, catalogue, spectral/texture workflows and approvals) and `WP/sample-workspace-redesign-v2/` (sample controls and immutable review history). This package owns dashboard contracts and navigation; it must retain their laboratory safeguards.

## Completion means

Each role has a useful home, each displayed count opens exactly its eligible scoped records, every action uses the destination's server policy, and the deployed candidate is tested with recorded evidence. No blanket promise of zero defects; unresolved failures remain visible and block affected rollout.
