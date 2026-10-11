# New same-image jobs-hold containment preparation

NEW current proof183405Z is RUNNING, not yet passed. Claudio source confirmation
6112305172 covers raw63a352683e2d83aaf5cd531f4b741be0855c6905, guardf4712a7c and
coordinatorc366cc4e. Seven exact-source Linux guards passed; root/unoptimized
Python and zero baseline enumeration errors are explicitly enforced/recorded.
The sole unit/source/root are retained in owned-proof-launch-20261011T183405Z.json.
Copy is healthy/zero restarts with326467584B peak during its660s soak. Do not
replay, relaunch or create a concurrent writer. Live jobs-pause card stays for
YY. No production operation occurred. Earlier failed proof175017Z remains FAILED.

First NEW proof FAILED at17:52:14.396020UTC before healthy: the unchanged
500MB unexplained disk-growth guard tripped. Root
/opt/lims/releases/runtime-jobs-off-ae64f169-proof-20261011T175017Z,
sourcec7e6a75a/coordinator0bc2474680a23e1bd1150ffa554d63e7ebeb636c85ab29f70638e94432527641.
Original proof/root/container retained; owned container exited with zero
restarts. No production mutation. This receipt must never feed a PASSED kit.
Do not replay this proof or override the abort. Read-only allocation diagnosis
found recurring25-27MB compressed host core dumps from the live crash loop;
the next crash was measured directly by a second read-only watch.
The first75second watch missed the next crash and recorded no core temporary
files; it is not evidence that those files do not exist.

The second watch (18:01:25.769706 to18:03:30.714966UTC) captured systemd-coredump
PID299889 holding /var/lib/systemd/coredump/#145884 (deleted), fd5:1,073,741,824
logical bytes and1,073,745,920 physical allocated bytes on device64769/inode145884.
Its compressed output also allocated24.8MB. Retained25-27MB compressed dumps alone
understate this temporary allocation. See core-process-allocation-watch.json.
No core was removed/disabled and no production setting changed.

PROPOSED, NOT EXECUTED: known_core_disk_guard.py accounts measured physical core
allocation on each guarded filesystem, including active systemd-coredump FDs
and retained regular core files, deduplicated by device/inode. It never reads
core contents. The original500MB unexplained-growth refusal and absolute
reserve floor remain. Six accounting tests pass using the original check_drop:
measured1GiB allocation, remaining unexplained500000001B refusal, other-device
refusal absolute reserve and transient-allocation sampling races. Historical frozen helpers are unchanged.
The updated isolated proof stops its owned writer and checks stopped-copy
preservation before writing a PASSED receipt. The accounting source and new
proof require Claudio's review before another NEW root is launched.

Separate runtime incident: #162 comment6111808236. This is new preparation,
not authority to mutate production. Claudio has presented a YY decision for
the temporary operational jobs hold. Never answer that decision for YY.

rehearse_jobs_hold.py creates ONE new isolated fresh-production-copy proof.
It has no production execution mode. It uses SQLite's read-only backup API,
including committed WAL, then the exact current ae64 image/default entrypoint
with jobsOFF, the same effective environment and768MiB/no heap override.
The copy must preserve all104tables/38receipts, main bytes/data_version and
the retained acceptance/report;22entrypointNO_OP0/21READY0 and31+6probes pass.
It then observes660seconds of healthy/stable-restart state after readiness.
Only the new owned container is stopped; proof/source/DB/receipts retained.
The current production container, ingress, volumes and jobs are never changed.

The imported leaf helper/probe files must be exported from exact raw Git blobs
into a NEW source root, mode0400 and SHA256 bound in source-index.json. Importing
these helpers performs no operation. Do not call their old held_state or old
coordinators, replay historical gates, or repurpose a historical proof.

Only after a PASSED new proof, separately frozen reviewed containment coordinator
and resolved YY jobs-hold authority may a live operation proceed. Recovery stays
forward-only; no restore, old image, heap increase, installer replay or cleanup.

Claudio pinned five accounting conditions on #162 comment6112115233. The proposed source records every physical attribution in an append-only ledger and embeds its rows/hash in the final or failed receipt. Current blocks must be observed on the same device/inode on both sides of df; only the smaller allocation is credited. Unreadable/expired/new-after-df allocations receive no credit. Baseline uses the larger observation on either side of df. Linux in-memory guard verification passed6/6, exit0; no host files changed.
