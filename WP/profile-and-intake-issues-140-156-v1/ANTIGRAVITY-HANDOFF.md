# Antigravity instructions for soil profile and reception work

This is a prepared handoff for the existing LIMSI project and LIMS Dev conversation. It has not been submitted to Agy by preparing this file. Work in `C:/Users/yigin/Documents/soilfer-lims`; read this package under `WP/profile-and-intake-issues-140-156-v1`. Do not treat the WP folder as a separate project root.

## Assignment

Complete the remaining LIMS work described in IMPLEMENTATION-PLAN.md and ACCEPTANCE-CHECKLIST.md. Separate PR A for Eloi's issue 140 from PR B for Marcos's issue 156. Read README.md first for the intended laboratory behavior, then REVIEW-EVIDENCE.md for actual source findings. Do not start again from the older issue-140 plan's pre-PR149 assumptions.

At handoff intake, verify current GitHub main and local work, then report a short concrete delivery sequence. The reviewed main is `cb86b207def4d58c40eb2ef7caa1f34368cb145d`; themes are already live at `v3.5.32-25535b6`. Documentation PR157 is merged and its exact-main CI passed. Preserve unrelated files and current accepted work. Use a suitable isolated implementation checkout/branch from current main rather than resetting the owner's dirty checkout. Use the repository's established branch naming and release process.

This package is an incremental implementation assignment when delivered by the owner. Existing authorization for safe push/merge/deployment remains subject to its established technical review and release gates; the presence of this draft file alone is not evidence that the owner delivered or started it. Do not initiate national ingestion, contact Eloi/Marcos or mutate historical samples solely because their names occur in this plan.

## First deliver issue 140

Eloi already confirmed a successful receiver staging import. Preserve the working v1/v2 exchange and receiver separation. The remaining work is:

1. Add validated canonical soil-profile references with stable namespace, explicit source evidence and protected post-release correction. Keep field bag, lab accession and specimen identities distinct. Preserve site/plot references separately.
2. Fix the demonstrated parser edge cases and intentional profile/pit mapping. Cover Kobo normal/force/replay, manifest, single/batch reception, draft restoration, sample display and exchange outputs. Version Kobo fingerprints; do not make all old replays appear changed.
3. Use a guarded isolated synthetic two-layer fixture, plus a same-code/different-namespace case and decimal depth. Do not alter real released results or guess old profile codes.
4. Replace hold-lookup failures masquerading as HTTP200 empty data with a typed retryable error while keeping records withheld. Resolve the policy once per request and preserve count/cursor coherence.
5. Measure the actual phases and latency. The global hold scans and SQLite five-second waits are candidates, not yet the proven production cause. Only optimize demonstrated bottlenecks; inspect actual deployed indexes before adding one.
6. Fix targeted documentation examples that do not match real output (`profile.key`, `sampling.depths`, etc.). Supply fixture/runbook/consumer evidence and the receiver test request for the owner to send.

Unknown profile code must remain null. It must not prevent ordinary lab work or become a new undocumented filter that empties OpenNSIS exports. Preserve scopes, holds, published status checks, genuine accessions, immutable snapshots, signed cursors, amendments and receipts. Do not modify OpenNSIS; Eloi's team performs real receiver acceptance.

## Then deliver issue 156

Build a focused versioned **intake template** editor and bindings. This term distinguishes it from a physical **soil profile**. Preserve existing project admission policies.

- Authoritative template resolution: saved revision → authorized project/origin/material binding → laboratory default → compatible seed. Never use a browser walk-in flag to relax saved SoilFER rules.
- One server evaluator must cover single, batch, manifest and old acceptance routes. Incomplete drafts are allowed; incomplete required checks cannot become accepted through another page.
- Seed compatible SoilFER behavior, general research soil and practical commercial soil forms. Mass planning follows actual ordered methods; unknown depth/date/location/profile stays unknown where the service permits it.
- Published revisions are immutable. Store the revision/hash and conformity snapshot with the intake. New rules cannot rewrite prior decisions or destroy saved drafts.
- Provide scoped own-lab manager configuration and authorized project binding. Reception staff use published rules; they cannot publish easier ones. Preserve object-level lab/project authorization and membership.
- Remove automatic batch PASS and unobserved 0–20 cm defaults. Use explicit bulk confirmations and per-row exceptions.
- Reuse existing translation/theme/mobile/draft components. Complete new labels/help/errors in all five configured languages. Preserve offline drafts and show revision conflicts at synchronization.

## Verification and release

Use the finite acceptance checklist. Run focused touched-path tests and relevant existing contracts. After they pass, proceed to the established review/release process; no repeated full-suite marathon, new reviewer swarm, extra timer or parallel Agy worker.

Supply the actual PR/head/CI, before/after behavior, migrations and dry-run report, fixture scope, timing measurements and remaining receiver evidence. Push all intended code/documentation to GitHub without incidental local scripts/credentials. Wait for the established independent technical acceptance before release. Merge without bypass, verify merged-main CI, then use the existing safe backup/cutover/postflight mechanism. Never restore an old DB after writers resume without reconciliation.

Keep #140 open if receiver grouping/replay/amendment/withdrawal acceptance remains outstanding. Close #156 only when the requested operator flows and safeguards are actually verified. Do not close unrelated #102/#103. Existing theme hardware/manual monitoring stays in its current scope.

## Communication with the owner

Use brief friendly explanations in everyday English. State the concrete work and its implication, for example:

- “I’m making sure the two depth samples keep their separate bag IDs while sharing the correct pit reference.”
- “The batch form was using different checks from the single-sample form. I’m connecting them to the same rules.”
- “The old error could look like there was no data. It will now say the check is temporarily unavailable so the connection can retry.”
- “The LIMS changes are verified. Eloi still needs to confirm the two-layer import in OpenNSIS.”

Distinguish planned, implemented, tested, merged, deployed and receiver-confirmed. Report an actual blocking dependency once with its specific required action; continue independent authorized work. Avoid jargon, vague “hardening” updates, unnecessary permission questions and claims of zero defects.
