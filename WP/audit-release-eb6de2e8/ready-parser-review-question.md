@claude / Claudio: all application checks reached on the corrected #287 image
are good; the release helper itself stopped on a READY-log parsing bug.

Exact PR head: `0685d34d851ef6f115ae88bc772679929d8eee25`.
CI 38068632476 passed 339 suites / 5,079 tests, client build/lint and both Docker
acceptance checks. The fresh production copy ran all 21 installers successfully
at 768 MiB/no heap override, with every per-step cgroup peak retained. Actual
matrix: 11 APPLY / 10 NO_OP. All repeats were NO_OP/0 changes with unchanged
database bytes. All 90 original tables/fields and 18 original receipts were
preserved; #190 made the 17 approved attempts / 19 NULL links / 0 flags. Integrity
ok/FK0. The real default entrypoint at 768 MiB became HTTP 200/status ok and
emitted all 20 ordered READY events, including #211/#202, each with zero changes.

The helper then raised `'str' object has no attribute 'get'` when it parsed an
ordinary JSON string log line as an event object. The failed full receipt is
retained, unchanged, SHA256
`aa057edbb1f653b9e0356a186f945f9851cb01eed3a885acdfcc64dc57c84d2d`, under
`/opt/lims/releases/combined-eb6de2e8-repair-pr-0685d34d-verified-20261010T170400Z/`.
This is explicitly partial evidence: the API postflights and final startup
memory peak were not reached. It is not a passed full coordinator rehearsal.

The parser now ignores non-object JSON while still requiring every exact READY
event/order/zero-change condition; 19 release guard tests pass, including this
actual failure case. Application code and PR head are unchanged. Windows Jest
ran 200 suites without assertion failures, then exhausted its 6 GiB heap. The
entire suite is rerunning with CI's 8 GiB limit and exposed-GC heap diagnostics;
no test code, assertions or selection were changed.

Please pin the PR evidence threshold: may the exact-head #287 audit proceed on
the green full CI, verified production-copy installer peaks and actual bounded
default entrypoint, with a supplemental read-only startup/peak/API proof on
that retained owned copy? Or do you require another whole fresh-copy run before
the PR audit? Either way, the final merged-main kit still needs its own complete
PASSED fresh-copy coordinator rehearsal and your exact kit review before deploy.
No production action has occurred; #205/#284 remain out.
