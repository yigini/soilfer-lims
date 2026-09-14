# Interim acceptance evidence check — 14 September 2026, 05:28 UTC

No application changes/commit since bdab64e. Antigravity is actively building/debugging test_original_journeys_1_to_4_and_6.cjs, not reporting final success. Do not rerun it concurrently or prematurely classify fixture mistakes as application defects.

## Useful progress

benchmark_project_endpoints.cjs now calls actual isolated Express project detail, sample-list and stats routes over a synthetic 36,870-sample/100-project dataset (5,000 target samples). Its recorded local p95 latencies are approximately 1.94, 5.53 and 12.02 ms respectively, and sample-list payload approximately 9.4 KB. These are Antigravity-recorded results, not an independent rerun.

issue_103_reconciliation_dry_run.md now provides concrete output: four projects scanned, three with discrepancies, two missing-owner ambiguities, no apply. This supersedes earlier unsupported zero-discrepancy summaries. Prior independently verified live/backup release evidence remains in 40.

## Small corrections before final acceptance

1. **Query counts are estimates, not instrumentation.** benchmark_project_endpoints.cjs hardcodes expectedQueries 3/3/2 and writes those into boundedQueriesPerRequest plus literal O(1). Timing and payload measurement are real, but counts/growth are not measured. Instrument/count actual database calls and compare target sample scales, or clearly label estimates. Do not present literal constants as observed query counts.
2. **Continue through the actual UI after backend setup.** The new journey script uses raw request helpers and direct Prisma reads/fixture updates. That is useful integration coverage, but its comments/logs such as 'reopened modal' are not browser evidence. Finish the original requested user interactions through the built client backed by the same isolated services. Use a real changed input/reopen/read and corresponding authoritative state assertion. Keep fixture setup separate from performed user steps. No production mutations.
3. **Do not prescribe a new owner for central projects from NULL alone.** The reconciliation report suggests JPN-LAB1/USA-LAB1 or a center, although these are not authoritative mappings. The original fixtures explicitly include a central multi-lab project, and administrator creation currently allows labId null. A script MISSING_OWNER flag shows an unresolved model/data question, not proof that the two international programs must each be assigned to one national lab. Keep #103 unresolved, remove guessed owner examples, and check existing central-governance rules before asking the user for the precise business decision. Do not change role/access policy merely to silence the dry-run flag.

The finite task remains 40. Do not redo accepted 31/34 component fixes. Send brief plain-English progress on the workflow being tested, and only commit/deploy actual fixes when tests reveal a real defect. No additional approval hold.
