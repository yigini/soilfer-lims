Claudio pinned the repair evidence threshold in the native LIMS Audit / Lab
workflow audit and plan thread, directly observed at 17:39 UTC on October 10:
no second whole pre-merge copy is needed. #287 can be formally audited after
green CI, all 21 measured installer peaks at 768 MiB/no heap override, the real
20 READY events and supplemental read-only startup peak plus 31+6 API probes.
The parser failure remains referenced. Windows's 6 GiB heap run is not an audit
gate because the full Linux CI is green; its diagnostics must remain reported.
The final merged-main release kit still requires a complete fresh-copy PASSED
coordinator rehearsal, including the parser repair, and exact kit review.

Those supplemental checks now PASS at exact PR head
`0685d34d851ef6f115ae88bc772679929d8eee25`:

- Candidate image `sha256:e2ed0a732e5e34050e42f7796e1d745cb4e18eb991e049ee804993cdc792c9e6`.
- 21 installer APPLY/NO_OP results and peaks are in `repair-partial-startup.json`.
  Actual matrix: 11 APPLY / 10 NO_OP; every repeat NO_OP/0 changes and identical
  database bytes. All 90 original tables/fields and 18 receipts preserved;
  #190 adds 17 attempts / 19 approved NULL links / 0 flags; integrity ok/FK0.
- The retained-copy supplement rechecked the earlier installed table hashes,
  then started the real entrypoint at 768 MiB with no heap override, confirmed
  every ordered READY event, passed 31/31 APIs and all six read-only probes,
  and verified unchanged complete rows/schema and database bytes after stopping.
- Actual startup/probe cgroup peak: **319,590,400 bytes**, limit 805,306,368.
- Immutable supplemental receipt:
  `/opt/lims/releases/combined-eb6de2e8-repair-pr-0685d34d-supplement-20261010T173400Z/supplement-receipt.json`,
  SHA256 `e4849266b57fdf652da5c22945504b003dabdeee0bce3fe5c355082be0a49a77`.
  This is a passed supplement; the earlier failed full receipt remains failed.
- Full CI 38068632476 PASS: 339 suites / 5,079 tests, client build/lint and real
  Docker acceptance checks. Local focused checks PASS 154/154 across 8 suites;
  current client build 21.80s/lint 0 errors/14 existing warnings.

Windows diagnostics: the 6 GiB full run passed 200 suites then exited 134 on heap
exhaustion. The 8 GiB/exposed-GC diagnostic run passed six suites then ended with
native exit `0xC0000409` without a Jest assertion failure or completed summary.
Neither is claimed as a full local pass. A standard full `npm test` with CI's
8 GiB limit and no GC instrumentation is running as additional verification.
All logs are retained; no tests, assertions, source or selection were weakened.

The kit source is pushed on `audit/release-eb6de2e8`; the repair source is pushed
on `audit/193-stream-fingerprints`. Production has not been deployed. #205 and
#284 remain excluded; #274 retains the unchanged 225 missing-order deferral.
