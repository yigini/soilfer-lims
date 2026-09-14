# Monitor: intake corrections independently verified

Checked 2026-09-14 around 00:47 UTC / 02:47 Europe/Rome. Repository HEAD: 270a02d769ea8436777d6a94e8b9d94104761f4e.

- PR99 merged canonical transaction-aware sample transitions and shared sample-origin handling (9c6d81f, merge 89b08f4). Main CI 34793096697 passed.
- Independently reran I01–I04 using the real routers and a NEW temporary schema-only database. All four PASS. Paused-project identity cannot be overridden; pre-registered samples survive discard; legitimate desk drafts remain disposable after repeated saves; generic deletion of a RELEASED sample returns 409 and preserves its approval timestamp.
- Evidence: monitor-intake-270a02d-probes.cjs and monitor-intake-270a02d-results.json. Source database hash unchanged; no production mutation tests. Earlier result files modified by Antigravity were not overwritten by this review.
- PR100 merged ac23d23 as 270a02d: named stage keys accepted by the server; nine added contract cases cover search/filter/count/pagination beyond page one. Feature CI 34793486276 passed; main CI 34793734891 was in progress at observation. This monitor inspected the delta but has not independently run those nine cases or verified the live browser interaction.
- Antigravity reports PR99 deployed as v3.5.3-89b08f4 with verified online/stopped backups and unchanged 36,870 sample count. These are agent-reported deployment details, not an independently inspected production container. Independently fetched public /api/health: HTTP success, status ok; this endpoint does not identify the deployed commit.
- Antigravity was preparing/uploading the 270a02d deployment. Do not interrupt the cutover or mistake an upload/green feature CI for confirmed production completion.

## Remaining acceptance and next check

Continue original PM findings and A01–A20 in 04-acceptance-and-release.md, with the remaining connected-workflow requirements from 10-monitor-progress.md. Four passing intake cases resolve those exact regressions, not full project governance, integration mappings, membership reconciliation, five-language or browser acceptance. Do not close all issues or mark the whole scope complete on this evidence.

The earlier broad continuation message was consumed; an older I01/I02 prompt was still queued. Those two old failures are now resolved in the independent fixture. Avoid duplicate corrective work based on that stale message. Next check: verify the current deployment outcome, the actual application sample search/filter behavior, and progress/evidence against remaining original acceptance. Monitor remains ACTIVE.

Delivery: latest passing results and remaining acceptance reminder confirmed queued in LIMSI / LIMS Dev without interrupting deployment. Two messages now queued, including the older resolved I01/I02 report; the new update explicitly supersedes those failure claims. Antigravity was checking production SQLite integrity and sample count at the final observation. Main CI still in progress; no new completion claim accepted.
