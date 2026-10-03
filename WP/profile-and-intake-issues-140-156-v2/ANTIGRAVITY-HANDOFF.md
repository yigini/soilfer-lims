# Antigravity instructions for soil profile and reception work

This is the owner-authorized handoff for the existing LIMSI project and LIMS Dev conversation. Work in `C:/Users/yigin/Documents/soilfer-lims`; read this package under `WP/profile-and-intake-issues-140-156-v2` (v2 supersedes v1; see CHANGES-FROM-V1.md). Do not treat the WP folder as a separate project root. Preparing the document is not proof that Agy has received it; record intake when it is actually delivered.

## Assignment

Complete the remaining LIMS work described in IMPLEMENTATION-PLAN.md and ACCEPTANCE-CHECKLIST.md as four sequential releases: **A0** (exchange 503 semantics, issue 140), **A** (profile identity and performance, issue 140), **B1** (intake integrity and basic configuration, issue 156), and **B2** (custom criteria/context fields and focused template editing, issue 156). All four are authorized now; do not wait for Eloi or Marcos to reply or ask the owner again for already authorized increments. Each checklist item is tagged with its PR. Read README.md first for the intended laboratory behavior, then REVIEW-EVIDENCE.md for actual source findings. Do not start again from the older issue-140 plan's pre-PR149 assumptions.

At handoff intake, verify current GitHub main and local work, then report a short concrete delivery sequence. The reviewed main is `cb86b207def4d58c40eb2ef7caa1f34368cb145d`; themes are already live at `v3.5.32-25535b6`. Documentation PR157 is merged and its exact-main CI passed. Preserve unrelated files and current accepted work. Use a suitable isolated implementation checkout/branch from current main rather than resetting the owner's dirty checkout. Use the repository's established branch naming and release process.

The owner explicitly authorized implementation, safe push/merge/deployment and updating their issue replies on 3 October 2026, without waiting for contributor responses. Keep the established technical review and release gates; no response from another team is needed to start or ship accepted LIMS-owned increments. The [issue 140 update](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5972150911) provides the retry notice; the [issue 156 update](https://github.com/yigini/soilfer-lims/issues/156#issuecomment-5972151075) explains staged full delivery. Link those updates in the PR records. Do not duplicate them, initiate national ingestion, send additional messages to contributors or mutate historical samples solely because their names occur in this plan.

## First deliver issue 140

Eloi already confirmed a successful receiver staging import. Preserve the working v1/v2 exchange and receiver separation.

### PR A0 — ship first, small

1. Replace hold-lookup failures masquerading as HTTP200 empty data with a typed retryable `503 EXCHANGE_ELIGIBILITY_UNAVAILABLE` while keeping records withheld. Controllers must forward the typed failure to one shared exchange handler rather than catch it as a generic 500. Preserve status, machine code, request ID and `Retry-After`. List every `buildSampleWhere` caller in the PR and verify the actual routed failure, not only a helper.
2. Resolve the policy once per request and preserve count/cursor coherence.
3. Add bounded server-generated request correlation before authentication across `/api/v1/data-exchange`, `/api/v1/sis`, `/api/v2/data-exchange` and `/api/v2/sis`, with minimal phase timings so PR A can measure. Do not log credentials or trust arbitrary client correlation values.
4. Document the new code and link the delivered issue notice: retry the same request, honour `Retry-After`, preserve the checkpoint and previously imported data. Genuine empty results remain successful; authentication errors remain 401/403. No receiver acknowledgement gate; actual receiver testing remains honest and separately pending.

### PR A — profile identity and performance

1. Run the read-only inventory first: current released output plus historical journal and snapshots of exported non-null `profile.key`. Preserve the exact emitted legacy identity before project/country changes can alter it, or guard those mutations until an audited promotion/correction. A zero count today is insufficient evidence that no historical key exists.
2. Add validated canonical soil-profile references (`fieldMetadata.profileReference`) with stable namespace, explicit source evidence and protected post-release correction. Resolve four states: absent canonical reference uses compatible preserved legacy identity; valid value uses the saved reference; explicit unknown remains null without alias resurrection; invalid canonical data produces a clear correction/error path without silent fallback. Previously exported malformed legacy values require reviewed correction. Keep field bag, lab accession and specimen identities distinct. Preserve site/plot references separately.
3. Fix the demonstrated parser edge cases and intentional profile/pit mapping. Cover Kobo normal/force/replay, manifest, single/batch reception, draft restoration, sample display and exchange outputs. Version Kobo fingerprints; do not make all old replays appear changed.
4. Use a guarded isolated synthetic two-layer fixture, plus a same-code/different-namespace case and decimal depth. Do not alter real released results or guess old profile codes.
5. Measure the actual phases and latency. The global hold scans, the hold-lookup connection fallback and SQLite five-second waits are candidates, not yet the proven production cause. WAL is already configured in `server/prisma.js`; verify effective deployed handles rather than treating WAL as absent. Only optimize demonstrated bottlenecks; inspect actual deployed indexes before adding one. If lock contention needs a larger change than scoped, present measured options to the owner.
6. Fix targeted documentation examples that do not match real output (`profile.key`, `sampling.depths`, etc.). Supply fixture/runbook/consumer evidence and the receiver test request for the owner to send.

Unknown profile code must remain null. It must not prevent ordinary lab work or become a new undocumented filter that empties OpenNSIS exports. Preserve scopes, holds, published status checks, genuine accessions, immutable snapshots, signed cursors, amendments and receipts. Do not modify OpenNSIS; Eloi's team performs real receiver acceptance, which is tracked on issue 140 and does not block A0/A release.

## Then deliver issue 156

Build a focused versioned **intake template** system. This term distinguishes it from a physical **soil profile**. Preserve existing project admission policies.

### PR B1 — intake integrity and basic configuration

- Create the template/revision/binding storage foundation now. Reuse it in B2; inspect actual schema needs and rehearse any further additive migration rather than promising none.
- Authoritative template resolution: saved revision → project selection → laboratory origin default → compatible seed. Never use a browser walk-in flag to relax saved SoilFER rules.
- One canonical server intake operation and evaluator must cover single, batch, manifest, existing offline `RECORD_INTAKE` and old acceptance routes. Incomplete drafts are allowed; incomplete required checks cannot become accepted through another page. Remove the three hardcoded checklists.
- Existing offline synchronization must preserve the full intake facts, project/profile/template/revision, `isDraft`, custody, photos and references with idempotent command receipts. It must preserve draft intent and use genuine specimen accession semantics; never put the institutional lab identifier into the specimen's accession field. Give staff recoverable validation/conflict outcomes without discarding queued input.
- Seed compatible SoilFER behavior, general research soil and practical commercial soil forms. Mass planning follows actual ordered methods; unknown depth/date/location/profile stays unknown where the service permits it.
- Simple own-lab manager settings: choose template per origin and per project, switch catalogue criteria/fields on/off and required/optional. Each save creates a new immutable revision automatically.
- Store the revision/hash and conformity snapshot with the intake. A saved valid revision remains pinned. New bindings/defaults affect new drafts; retirement prevents new selection but keeps existing drafts valid. A new default is not a reason for 409. Revoked/invalid revisions, tampering or concurrent edits produce 409 with retained input and minimum recovery in B1. An intentional upgrade is explicit and reviewed in B2.
- Remove automatic batch PASS and unobserved 0–20 cm defaults. Use explicit bulk confirmations and per-row exceptions.
- Scope local autosave keys by user/lab/sample/revision and migrate the legacy key without deleting it.
- Complete new labels/help/errors in all five configured languages.

### PR B2 — complete template configuration (already authorized)

- Custom criteria and context fields with localized admin-authored labels and bounded, server-validated schemas.
- Focused draft/preview/publish/retire lifecycle; do not add a new approval subsystem. Existing published revisions and accepted decisions stay immutable.
- Scoped binding controls that honour existing capabilities. Do not grant project managers new powers automatically; unsupported delegation stays unavailable.
- Explicit draft-upgrade comparison showing retained answers, changed requirements and any necessary new answers before confirmation. B1's minimum revoked/invalid revision and offline recovery already exists; B2 makes voluntary upgrades easier.

B1 is a useful first increment, not full completion of #156. Complete and verify B2 without waiting for a contributor reply. Do not add unrelated governance features or new role grants to fill the gap.

## Verification and release

Use the finite acceptance checklist. Run focused touched-path tests and relevant existing contracts. After they pass, proceed to the established review/release process; no repeated full-suite marathon, new reviewer swarm, extra timer or parallel Agy worker.

Supply the actual PR/head/CI, before/after behavior, migrations and dry-run report, fixture scope, timing measurements and remaining receiver evidence. Push all intended code/documentation to GitHub without incidental local scripts/credentials. Wait for the established independent technical acceptance before release. Merge without bypass, verify merged-main CI, then use the existing safe backup/cutover/postflight mechanism. Never restore an old DB after writers resume without reconciliation.

Keep #140 open if receiver grouping/replay/amendment/withdrawal acceptance remains outstanding. Close #156 only when B1 and B2 operator flows and safeguards are actually verified. Separate pre-deployment gates from merged/live postflight evidence; do not require post-deployment evidence before deployment. Do not close unrelated #102/#103. Existing theme hardware/manual monitoring stays in its current scope.

## Communication with the owner

Use brief friendly explanations in everyday English. State the concrete work and its implication, for example:

- “I’m making sure the two depth samples keep their separate bag IDs while sharing the correct pit reference.”
- “The batch form was using different checks from the single-sample form. I’m connecting them to the same rules.”
- “The old error could look like there was no data. It will now say the check is temporarily unavailable so the connection can retry.”
- “The LIMS changes are verified. Eloi still needs to confirm the two-layer import in OpenNSIS.”

Distinguish planned, implemented, tested, merged, deployed and receiver-confirmed. Report an actual blocking dependency once with its specific required action; continue independent authorized work. Avoid jargon, vague “hardening” updates, unnecessary permission questions and claims of zero defects.
