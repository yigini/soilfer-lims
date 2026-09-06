# Laboratory operations redesign — revision 3

Review date: 6 September 2026. Working repository: **C:\Users\yigin\Documents\soilfer-lims**.

This is the connected follow-up to `WP/sample-workspace-redesign-v2`. It covers preparation, technician batches, the analysis catalogue, compound and derived results, reporting, and role dashboards. Implement it against the current sample-workspace services, not as a second independent lifecycle.

## Read in order

1. `source-audit.md` — observed defects, source locations, evidence and limits.
2. `implementation-plan.md` — intended lab workflow, data contracts, implementation sequence and release criteria.
3. `acceptance-checklist.md` — required acceptance scenarios; not claims of passed tests.
4. `catalogue-review-register.json` — every seeded analysis and methodology, with provisional migration decisions and review flags. This is a triage register, not scientific certification of 214 analyses.
5. `lab-operations-concept.html` — standalone interactive design proposal, using demonstration data only.
6. `audit-probes.cjs` and `audit-probe-results.json` — reproducible, read-only source probes. They import only pure calculation/readiness/QC utilities, never the application or database.
7. `reference-drying-workbench.png` — the user's screenshot.
8. `concept-check-results.json` and `concept-*.png` — checks and visual references for the demonstration. All 58 prototype checks passed, covering batch/QC interaction, preparation gates, grouped texture, order grouping, 10 role views and responsive light/dark layouts. These are not production acceptance results.
9. `lab-operations-concept-source.html` — editable mockup source; `build-review-register.cjs` and `check-concept.cjs` reproduce the inventory and isolated mockup checks.
10. `antigravity-handoff.md` — concise instructions to accompany the full package.

The source baseline is commit `bee0b6e`, following `f3262a2` (sample workspace P1–P6). Check the current Git state before implementation. Preserve previous work and reconcile overlapping fixes. Earlier approval, amendment, spectral provenance, control inventory and deployment safeguards from revision 2 still apply.

No application code, laboratory data, accounts, production settings or deployments were changed in this review. The live browser was inspected as the already signed-in GTM laboratory manager. Elena's drying screen is evidenced by the user's screenshot; no authenticated Elena execution test was performed.

The implementation handoff must include this whole folder and `WP/sample-workspace-redesign-v2`. The interactive sketch illustrates key interactions; the written plan and acceptance cases define full scope.

## Completion standard

Do not report completion merely because screens render or a build passes. Require server-enforced entry gates, complete typed payload round trips, correct compound ordering and derived results, independently verified texture classification, reconciled migrations, scoped dashboard counts/links, and cross-surface acceptance tests. Hardware exports, local preparation procedures and method-specific QC settings still require verified laboratory configuration; research cannot identify the lab's unrecorded SOPs or instruments.
