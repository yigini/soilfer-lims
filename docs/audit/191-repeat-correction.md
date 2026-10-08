# Repeat and correction commands (#191): implementation in progress

Base: audited main a919ad679e7c381c5428cbaaed561295785691a5. The #190
dependency is merged. The existing execution writer returns an explicitly
selected attempt without filling it, and the work routes have no repeat or
attempt-correction command. The new capability remains required.

Scope authorities: #162 repeat design; #191 comments 5975239652, 6055538092,
6059796291, 6067488471 and 6067875897. CONTRIBUTING.md applies.

The reason contract separates new measurements from TRANSCRIPTION_ERROR,
which supersedes a Result in the same attempt, and CLIENT_RETEST, which needs
an amendment. OTHER requires a note. An unchecked NCR/override is refused
until #193. Laboratory limits and technician self-repeat enablement come
from policyService; no command may infer a reason from historical free text.

Remaining implementation and verification:

- Add the additive, independently receipted #191 migration/installer. Keep
  #190 migration bytes, source digest and receipt unchanged. Validate exact
  receipt-backed successor triggers and the whole startup chain, refusing
  partial/tampered chains with zero writes.
- Reserve an OPEN attempt with frozen parent/reason/note/request facts.
  Fill execution facts once, only from NULL, atomically with its first Result.
  Preserve createdAt/updatedAt; append events carrying transition times.
  Retain every recorded-evidence guard and compare all non-listed columns.
- Wire scoped repeat and same-attempt correction APIs, configured limits,
  failed-batch exclusion, item assignment/submission and review transitions.
  Submitted corrections require a fresh review and preserve the original
  attempt evidence byte for byte.
- Report every interim attempt 2+ without a reason as "reason not recorded"
  in dry-run/receipt, without filling or rewriting it.
- Test actual APIs, one-time SQL fill, every non-listed-column refusal,
  original #190 refusals after upgrade, all RETURN reasons, policy/scope/
  permission/limit refusals and immutable correction history. Deliberately
  inventory the six changed workbench RETURN assertions in the PR.
- Run the full server suite, client build/lint and CI, then request Claude's
  audit at the exact head. No PR/readiness/completion claim yet.

Reported-value selection belongs to #192; NCR validation belongs to #193.
No production work is permitted during the #162 demo freeze. Owned-copy
release proof is a later gate after that freeze is explicitly lifted.
