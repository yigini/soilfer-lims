# PR #289 integration review, audit/CI pending

PR: https://github.com/yigini/soilfer-lims/pull/289
Initial reviewed head: `b4d52bd3369797c77c5a9c339af66e3274be460b`.
Claudio owns implementation; Pip reviewed the diff and requested two points
before freezing the release integration contract.

Claudio addressed those points at
`a9e24600b381e4c0c4c7a2bd06caa1bec9584de6`; Pip inspected the follow-up diff.
The revised #191 scope pin is comment 6101762952. It explicitly approves the
single direct status change before #191; a SUBMITTED edge would invent a
submission that the retained records do not establish. PR response 6101763099
records the new plan binding. Dry-run now returns planSha256 over the exact
eligible/unresolved tuples. Apply requires that digest and checks it against
both the reader and IMMEDIATE-transaction plans. A new same-item/changed-review
test refuses the old digest with unchanged database bytes. Full CI and
Claudio's formal exact current-head audit remain pending. Pip independently
ran the three changed-install/security/SQL-guard suites at this exact head:
3/3 suites and 301/301 tests pass, zero skips, exit 0, 116.437 seconds under
TZ=Europe/Rome. See `289-focused-verification.md` for the command and log hash.
The PR is now labelled ready-for-audit and has the exact-head request in
comment 6101858153. CI run 38083146269 and the formal pass are still pending
at the 20:32 UTC checkpoint.

The original findings, retained for traceability:

- #191 scope pin 6100903042 specifies RECORDED -> SUBMITTED -> ACCEPTED, but
  the implementation performs direct RECORDED -> ACCEPTED before #191 exists.
  A revised explicit issue pin or matching implementation is required.
- Apply has no reviewed-plan binding. Reader and transaction rechecks compare
  only WorkItem IDs; a changed qualifying attempt/decision/result tuple can
  pass the same scope check. Pip requested full evidence binding and zero-write
  refusal coverage for changed evidence under the same named scope.

The revised CLI has dry/apply/repeat stages between #190 and #191. Its
current proposed delta is one attempt status field and one new AuditLog row,
totalChanges=2, zero changes on repeat, no schema receipt, and no entrypoint
READY event. Apply additionally requires --plan-sha256 from the reviewed
dry-run. The immediate repeat must happen BEFORE #191; the script explicitly
refuses after #191 is installed. The final kit therefore needs that repeat in
the same pre-191 slot, all 21 existing installer repeats, and 66 total bounded
CLI measurements for 22 dry/apply/repeat steps. The existing 20 startup READY
events remain required. This contract is provisional until CI passes and
Claudio posts an exact current-head audit pass.

No release helper changes or new production-copy proof have started. Current
main remains `042c04b54e7b3baa9f8c95e7f8d70b39daed2f91`; its failed fresh-copy
proof remains FAILED. Original YY choice is already verified in the kit.
