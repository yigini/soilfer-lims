# Separate preparation/results release

Target: ae64f169e56e7677a920a3b60a7b1fe0dbfa4ccf.
Current live: feac653495d6b8a21e082cec596f1e14672fb389 / image 159057d5.

Both new PRs merged Oct 11 at 10:58 UTC after independent review, exact-head audit and CI. #288 merged a3614600, tree identical to audited 77e38c21; #290 merged ae64f169 at audited 15a826be. Combined main CI 38133894755 is pending.

This kit is under preparation. No production execution gate exists. No production installer/quiesce/deployment has occurred for this release. The completed combined release and all original backups/proofs/receipts remain preserved.

Only the additive #205 preparation installer may apply. Existing installers and recorded acceptance are read-only verification, never a backfill/reconciliation replay. Require new measured production-copy proof, zero-change repeat/startup/API checks, preservation of every original field and receipt, exact kit review, fresh GitHub gates, both workload-control pins, reserve/drop aborts and stopped-writer backup. After any installer attempt recovery is forward-only through a separately audited fix.

Coordination: https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6108316915.

## Current checkpoint: October 11, 11:11 UTC

Both PRs are merged and the candidate build passed at 11:06:56.367551 UTC.
Image: sha256:bc2557a5dee2a8599d31cf96407088d67ce863c4ad3fc7e6989b8671e10c597a (413,546,358 B).
2,234 source blobs verified; archive 1305719cc92601e3c7babe6c074d1f06462a909b924509b74c717943a19ddecd; index a9b018930c4206fcea46f54a6db20cddb04c58df4dd938fc41319b2535193f62.
Original retained build root: /opt/lims/releases/preparation-ae64f169-build-20261011T110500Z. Its completed unit is inactive, exit 0; do not replay it.
Build receipt SHA256: 08714c72470839d5cb8011423e1510f08d63a998a97b6e5a1fc25ce4f418a2b1.

Nine Linux release guard tests passed, exit 0, 0.155s. Guard log SHA256: 27eaa501effd30792488565401116c71d38413aae8da17a0db4464aa5b84247b.
The first guard invocation had a fixture syntax typo before any tests ran; corrected invocation is the retained passing log. It is not production evidence.

DISK HOLD BEFORE FRESH COPY OR QUIESCE: free 7,050,317,824 B at 11:08 UTC. Required conservative total: 10,556,150,894 B plus remaining kit/log allocation (8 GiB floor + three 563,322,880 B DB allocations + two 3,906,103 B assets copies + 256 MiB logs). 2.552 GB unused new build cache exists; cache cleanup alone does not cover the full budget. No further deletion/prune is authorized by the completed old cleanup and none has occurred. The completed old release's images/data/backups/proofs/receipts remain preserved.
Storage handoff: https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6108380995.

Native Claudio directly acknowledged the new merge freeze and source/patch identities at 11:11 UTC. He will review the new exact kit, bind this scope/standing-go evidence and workload pins, then perform post-deploy checks. Pip sent the concrete disk hold and request for original new-scope authorization evidence in that same existing thread. The current authorization file is explicitly unresolved and cannot authorize production; the old Main now record excluded #205.

Main CI 38133894755 remains running. No fresh production-copy rehearsal, PASSED proof, frozen executable manifest, execution gate or production receipt exists for this new release. No production installer, quiesce or deployment has run. Do not run the incomplete coordinator. Resume from the valid original build only when sufficient authorized headroom exists; complete the fresh-copy proof, freeze unchanged sources and obtain Claudio's exact-kit pass before fresh gate collection.