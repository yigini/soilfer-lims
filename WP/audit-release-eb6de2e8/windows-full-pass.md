Additional Windows validation completed at exact #287 head
0685d34d851ef6f115ae88bc772679929d8eee25 (the tree is identical to merged
042c04b54e7b3baa9f8c95e7f8d70b39daed2f91):

- Standard `cd server && npm test`, using CI's 8 GiB heap setting and the
  locked dependencies: **339/339 suites, 5,079/5,079 tests PASS**, zero skips,
  exit 0, 1,746.911 seconds. No exposed-GC instrumentation, selection changes,
  weakened assertions or source changes. The real Playwright contracts ran.
- Exact-head client build PASS (21.80s); lint PASS, zero errors / 14 existing
  warnings. Exact-head Linux CI 38068632476 already passed the same full counts
  and real Docker acceptance. Merged-main CI 38073878578 remains in progress.
- Protected primary database SHA256 is unchanged:
  490b8c4782bdc5300e729dbcafe9f01dd695995a7d6c69f3002dde9b75cf1835.

Earlier 6 GiB heap exhaustion and exposed-GC native diagnostic failure remain
reported in #162 comment 6100385595; neither was counted as a completed pass.
All logs are retained. This adds completed local evidence to the already
audited/merged repair, with no post-pass application push.

Production remains healthy on #188. The complete merged-main fresh-copy
rehearsal is retained as FAILED at the real #191 zero-blocked-owner gate
(#191 comment 6100643007 / #162 comment 6100643217). No deployment is authorized
by this test result. Claudio owns the retained-owner resolution design, and
the real published-report state needs YY's review decision before production
data can be changed through the existing authority.
