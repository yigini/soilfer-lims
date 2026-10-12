Deployed f830f900f597f20e12570b583e4e32ce9cb50a1d to production

Completed 2026-10-12T01:57:11.788150+00:00; the single original unit is inactive/exit 0. Independent read-only verification passed 2026-10-12T02:02:22.664396+00:00. Image sha256:4894eabc1d2e70528b83e6e77b151b43c8e67adff15228cfd067485ffd7c5413; Docker healthy with 0 restarts, blank NODE_OPTIONS and 805306368 B limit. HTTPS health and login return 200; health status ok/version 1.9.0. Ingress is open before jobs, background jobs enabled, auto-push/auto-seed disabled; retained unauthorized receipts POST returns 401. Volumes remain lims_lims-data and lims_lims-assets.

Original immutable mode0400 production receipt:
/opt/lims/releases/runtime-kobo-release-f830f900-20261012T012552Z/production-receipt.json
SHA256: 0b8c3f54ab70e404d5797266f349d3b2a819151dc3afa9c5059f63a27727a8d7

Both default startups passed 22 NO_OP/0 installers and 21 READY/0 events, with 0 startup changes. Jobs-OFF readiness 102.679960s; jobs-ON readiness 102.942098s. All 31 API checks plus six read-only probes passed with 0 probe changes. The jobs-enabled observation covered 660.999770s and 23 healthy samples, 0 restarts, maximum application peak 276758528 B <=805306368 B.

The stopped WAL-aware backup and second stopped jobs-OFF seal match the complete original logical state: all 104 tables/schema/rows, all 38 receipts, integrity ok/FK0. Full logical-state SHA256 7cb20bb4c766011f226d434d77da0d7933c653e796c650c8c8f25a92e7853da2; both backup SHA256 4cb003f1ef84c59789d3636de79ed212e29dec37fe9d5640f4beeb97df8ba4e7. Sealed raw DB/WAL/SHM triples remain retained. Database changes before jobs: 0. Normal application writes are enabled after that boundary. The existing accepted attempt/event, ReviewDecision attemptId=NULL and PUBLISHED report remain intact; no new scientific acceptance occurred.

Reviewed manifest 0e0339e23c7cb9ea32b25d8e26b486c94a63889c00b317af76b7cadffd1e6fe9; coordinator 72baa9cb901aec8baaf35d33284eea2c23395150ee8cca211239b1ffa61d445d; original PASSED proof receipt 257196f530a0494ca0ba43023091febe670bc894c063d4bdd99e98f23d979c0d. Actual Source PASS 6116073246 and exact-kit PASS 6116173459; all 41 frozen files and historical #292 receipt independently unchanged. Single-use gate 8aeb1413000b22491d028496c41f9c56d971bf21e66f37732be0df0cac6002ae was consumed by this completed execution and must never be reused. Both workload pins retained: labAndHubBuildsOwnedByYY=true / RELEASE_DAY_DISK_ABORTS_ACCEPTED.

Independent free space 98035896320 B exceeds required reserve including allocations 14502202229 B. Raw final receipt, attributes, unit journal, observations and independent verification are pushed at checkpoint 4f11acc9 in WP/runtime-recovery-kobo/pr291-wal-deploy-observation-015716Z and pr291-wal-independent-verification-020000Z.json.

Claudio: please perform your actual post-deploy check, close/tick #291 and #278/#279/#281/#283 as appropriate, and record the #162 handoff. I have not claimed your verification or closed your issues. #213 remains a separate next release; #274 remains deferred and #284 parked. Other application merges remain held until your postcheck. Failed 004200Z/e274 remains FAILED and immutable; no replay, new gate, restore, older image, cleanup or YY card answer.
