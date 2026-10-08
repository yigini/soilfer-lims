# Repeat and correction commands (#191): WIP, not ready for audit

#190 is merged at a919ad679e7c381c5428cbaaed561295785691a5. #253 is merged
at 0b5428405f577aab2e6d90634209f8b154bba373 and incorporated here.
Branch: audit/3.2-repeat-correction. No #191 PR, audit pass or deployment exists.

Scope authorities are #162 and #191 comments 5975239652, 6055538092,
6059796291, 6067488471, 6067875897, 6068463777, 6068870369, 6069548259
and 6069938801. CONTRIBUTING.md applies. Questions 6070204858 remain pending
for the closed correction payload, formerly implicit replicate fixtures,
fresh review of accepted derived work and the canonical historical import.

Implemented, with verification still in progress:

- A separately hashed additive #191 migration and installer, twelve exact
  receipt-bound release objects, complete startup chain and tamper refusals.
  Original #186/#187/#190 migration sources and receipts are unchanged. Only
  the two authorized #190 attempt triggers and one #187 membership trigger
  accept exact successors backed by the complete #191 receipt.
- Scoped repeat commands reserve one OPEN child with canonical reason,
  immutable parent/request facts and actor/time events. First recording fills
  only the eight permitted NULL fields, preserving version and timestamps.
  Failed/pending/open Native QC requires its existing run disposition; an
  accepted QC_PASS/QC_WARN handoff retains the original membership and QC.
- Same-attempt transcription correction appends a targeted superseding
  Result and immutable event. Multi-replicate correction requires a valid
  current selector. Submitted work requires a fresh review. Laboratory
  attempt limits and technician permissions come from policyService.
  Unverified NCR/override requests refuse until #193; CLIENT_RETEST requires
  an amendment. No reason is inferred from historical free text.
- Actual submission/acceptance/RETURN attempt transitions, reviewer route
  permissions and the canonical RETURN form with translated labels/errors.
- Missing replicas may append only to the single current RECORDED attempt
  with its frozen method/instrument. Recorded-cell replacement requires a
  correction or reasoned repeat. Parent evidence is unchanged.
- An owned result-set fixture creates explicit determinations under one new
  execution, refusing reuse and duplicate current replicas. No historical
  factory caller or runtime guard exception is added.
- A read-only planner lists interim attempt 2+ rows with NULL reason as
  "reason not recorded". Back-fill count is zero; no write mode exists.

Remaining work includes causal DERIVED_RECALCULATED events on the same
TEXTURE attempt, fresh derived review, the pinned legacy fixture adaptations,
and complete server/client/CI verification at one final head. Earlier
derived evidence and analytical/QC/audit rows must remain intact.

Verification history is diagnostic, not readiness:

- 85bc0c9 full suite: 238/268 suites and 3822/3936 tests passed; 114 failed,
  zero skipped, 1043.068s. Failures were inventoried before fixture changes.
- cf5235b focused chain: 7/8 suites and 471/473 tests passed, 278.981s.
  Original #190 refusal replay after #191, installer/tamper, native repeats,
  scanner and RBAC passed. Two bracket acceptance fixtures omitted the real
  attempt submission; their setup now uses the submission authority.
- 405bf37 replicate diagnostic: 4/8 suites and 84/134 tests passed, 160.485s.
  The new query incorrectly used a nonexistent Result.attempt Prisma
  relation. 12f9b1f uses guarded scalar IDs; affected tests are rerunning.

Applied by precedent / deliberate setup inventory:

- Six workbench RETURN cases supply canonical reason codes and compare the
  original parent with only its permitted QUESTIONED status change; the
  second attempt is explicitly OPEN with the selected reason (6059796291).
- Selected workbench submission cases stage actual RECORDED evidence before
  their original success/conflict assertions (6061487810 and earlier explicit
  positive-fixture pins). No later error/count assertion is removed.
- Two bracket acceptance cases call the actual submission service before
  review, retaining their original acceptance/publication assertions.
- Positive bootstrap fixtures install the real #186/#187/#190/#191 chain.
  Immutable WORK_ATTEMPT events survive until whole owned-file teardown.
- Incremental-replica assertions in result_provenance remain unchanged
  (6069938801). Every subsequent legacy result-set/correction/repeat setup
  change must be listed by file and test before requesting audit.

Reported-value selection belongs to #192; NCR validation belongs to #193.
No production-host action is permitted under #162's demo freeze. Deployment
requires its explicit lift, fresh owned-copy release proof (including the
#190 original #178 NO_OP prerequisite), all required checks, and Claude's
exact current-head "Audit passed: OK to merge and deploy" comment.
