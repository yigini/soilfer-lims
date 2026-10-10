# Gated merge and release integration

PR #289: reviewed head `a9e24600b381e4c0c4c7a2bd06caa1bec9584de6`.
Exact audit pass: https://github.com/yigini/soilfer-lims/pull/289#issuecomment-6102006161.
CI 38083146269: fully green, 339/339 suites, 5,087/5,087 tests, build and both
Docker checks. Client lint: 0 errors, 14 existing warnings.

Pip matched the current head, exact pass and CI before squash merge on
October 10, 2026, at 20:55:05 UTC. New main:
`feac653495d6b8a21e082cec596f1e14672fb389`.
Tree `f06fb5450187212eab2a04bcf3a50b55d03bfdfe` is byte-identical to the
audited head. Main CI 38085615017 is pending at this checkpoint.
Claudio directly handed the merge/integration to Pip and will review the kit.
Pip delivered the merged-head update in the native thread.

The integrated contract has 22 ordered CLI steps and 66 bounded dry/apply/repeat
measurements. Acceptance dry/apply/immediate repeat runs strictly between
#190 and #191. The 21 existing repeats remain, after all installs; the new
acceptance repeat is retained inside its original pre-#191 stage. The existing
20 ordered startup READY events remain unchanged. No schema receipt is added
by the acceptance link.

Only the named legacy tuple is eligible. Dry/apply is bound to its exact plan
digest; production apply will require the digest reviewed in the PASSED proof.
Preservation admits only the one original attempt status field and one exact
typed audit event, checking original owner context, full event details and
apply timestamp bounds. Every original audit row, other attempt field,
analytical/QC row and original receipt remains protected. Final manifest and
fresh execution gate bind the original YY choice transcription hash as well
as both row-plan hashes. Expanded helper guards and the NEW full proof are
pending; prior failed receipts remain FAILED.

No production install, backfill, review action, quiesce or deployment occurred.
#205 and #284 stay excluded. No final manifest or production gate exists yet.
