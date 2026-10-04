# Soil laboratory workflow audit and implementation brief

Prepared 4 October 2026 for **routine soil fertility and soil characterization, 100–300 incoming samples per day**.

**Recommendation:** repair approval/publication and QC evidence gaps first; then complete the existing attempt model and build the technician workspace around real trays, material portions, and method-specific QC. The current application has substantial reception, workbench, review, and reporting functionality. It needs a coherent evidence chain, not a replacement LIMS.

## Read this packet

1. [Implementation plan](IMPLEMENTATION_PLAN.md) — complete target workflow, practical bench design, data model, delivery packages, migration, and rollout.
2. [Findings and evidence](FINDINGS.md) — prioritized problems, what was actually reproduced, current safeguards, and code locations.
3. [Research and method decisions](RESEARCH.md) — primary sources, relevant editions, source-specific examples, and limits of applicability.
4. [Acceptance tests and lab pilot](ACCEPTANCE_TESTS.md) — concrete scenarios and completion criteria.
5. [Codex handoff](CODEX_HANDOFF.md) — ready-to-use implementation instructions. Give Codex this file **with the whole packet**, not just the summary below.

Supporting evidence: [synthetic probe results](probe-results.json), [reproducible audit harness](audit-probes.cjs), [worksheet screenshot](evidence/soil-workbench-desktop.png), and [QC form screenshot](evidence/soil-qc-defaults.png). The packet includes its screenshots so it can be handed over as one folder.

## Highest-priority findings

| Priority | Finding | Evidence |
|---|---|---|
| P0 | An older review endpoint accepts an unsubmitted work item belonging to another laboratory. | Authenticated synthetic HTTP reproduction P05. |
| P0 | A report can be published for an unapproved sample with unevaluated QC. | HTTP reproduction P07. |
| P0 | The QC form contains passing example measurements; submitting them unchanged passes. Required duplicate positions are not individually verified. | Browser inspection plus P01/P04. |
| P0 | A request can close a previously passing batch while its newly supplied measurements fail QC. | HTTP reproduction P11. |
| P1 | Canonical review accepts work while QC is still OPEN. | HTTP reproduction P06. |
| P1 | Ordinary numeric results are recorded without WorkAttempt records; two current replicates are represented as one worksheet value. | HTTP reproductions P08b/P09. |
| P1 | QC thresholds, control identity, preparation requirements, and reportable-result selection are insufficiently method-specific. | Source inspection and primary method guidance. |
| P1 | The worksheet is a long assignment list with separate QC entry; it does not yet provide a complete physical run workspace. | Current-source browser walkthrough with 100 synthetic bench samples plus audit fixtures. |

P0 means address before depending on this workflow for report release. These tests establish behavior in the inspected checkout; they do **not** establish that an incorrect report was issued in production.

## Main design decisions

- Keep the customer sample separate from its physical portions, requested tests, execution attempts, replicate readings, and selected reportable result.
- Add blanks, control soils, and duplicates to the run as traceable physical items. Do not register them as ordinary customer samples to make the counters work.
- Make QC a versioned policy for each laboratory method and relevant matrix/range. A rack layout describes space; it cannot determine scientific acceptance criteria.
- Let a technician request a repeat of one determination, one extraction group, a run segment, or an affected batch. Preserve the original attempt and explain why the new result was selected.
- Make the bench workspace answer: **Which tray? Which position? Which material? What next? Is it saved? What prevents completion?**
- Require one consistent, transactionally checked release decision across reviews, approval, reports, and external delivery.

## Scope and confidence

Inspected Git revision: `878e894472708076228f590e58bd35ba2a8ecbfa`, branch `docs/issue155-final-records`. Existing working files were preserved. No application code, operational records, deployments, or external messages were changed.

The audit combines source review across the lifecycle, 15 recorded synthetic checks, a targeted browser walkthrough, and primary-source research. The checks include reproductions, regression controls, and one non-reproduced suspicion; they are not 15 confirmed defects. The harness created fresh databases from schema definitions only, without copying sample records. The normal full test suite was not run; its global setup copies the local development database and its teardown shares a temporary directory. A safe isolated test harness is part of the delivery plan.

This is an implementation-ready design with explicit lab configuration decisions, not a completed wet-lab validation or a throughput certification. Instrument models, actual SOPs, test mix, shift length, network reliability, and local reporting obligations still require confirmation during the first work package. None prevents beginning the confirmed software repairs.
