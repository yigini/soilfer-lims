# PR #289 integration review, pending Claudio

PR: https://github.com/yigini/soilfer-lims/pull/289
Reviewed head: `b4d52bd3369797c77c5a9c339af66e3274be460b`.
Claudio owns implementation; Pip reviewed the diff and requested two points
before freezing the release integration contract.

- #191 scope pin 6100903042 specifies RECORDED -> SUBMITTED -> ACCEPTED, but
  the implementation performs direct RECORDED -> ACCEPTED before #191 exists.
  A revised explicit issue pin or matching implementation is required.
- Apply has no reviewed-plan binding. Reader and transaction rechecks compare
  only WorkItem IDs; a changed qualifying attempt/decision/result tuple can
  pass the same scope check. Pip requested full evidence binding and zero-write
  refusal coverage for changed evidence under the same named scope.

The preliminary CLI has dry/apply/repeat stages between #190 and #191. Its
current proposed delta is one attempt status field and one new AuditLog row,
totalChanges=2, zero changes on repeat, no schema receipt, and no entrypoint
READY event. This contract is provisional until the points above are resolved,
CI passes, and Claudio posts an exact current-head audit pass.

No release helper changes or new production-copy proof have started. Current
main remains `042c04b54e7b3baa9f8c95e7f8d70b39daed2f91`; its failed fresh-copy
proof remains FAILED. Original YY choice is already verified in the kit.
