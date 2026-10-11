# Runtime recovery: audited merge and build complete; new release source proposed

PR292 formal exact-head audit PASS6112846321 and unchanged green CI were verified before merge.
Merged at19:30:41UTC as **171dd36c5b2dbeea8763520dd18fbdb158ffca05**; audited/merged tree
**5209112a0c66d8cef8578018b415a7511b4daba7** is identical. Main CI38168329149 is running.
PR291 and further application merges must stay held until this runtime recovery is live.

ONE NEW candidate build completed19:37:27.522725UTC, root
`/opt/lims/releases/runtime-kobo-build-171dd36c-20261011T193050Z`, unit inactive/exit0.
Original immutable BUILT_ONLY_NOT_DEPLOYED receipt SHA256
**e2437e978eed81244f6860e9a92c0755654e7945137f8c0146852b7d544b2f1d**.
Image **sha256:bac52bc8ee6a7d94d17fbdf2064fd09e8bc8dc533677304f4cc2d3e128fc4320**,
413547526B/exact revision,2234 verified Git blobs, no production DB mount.
Free114597490688B after build. Original archive538cf5cc57c56a0aa39a64a11bd392973099c8117f37d6334b85a85d8b4ea7bb
and indexd8ff825e0a1e31afb726b96441d93c020149a775dd9a4b4185431d8da3a39fc7 remain retained.
The target pin is prepared; the approved jobs-ON proof533c5451 remains unchanged and waits for main CI SUCCESS.

Proposed NEW kit/freezer/deployment source is pushed at **f61dc33cd70bfcbc73dd07f99a2e2e14ab015bff**. Please review it while CI runs.
There is no frozen kit, execution gate or production attempt yet; actual manifest/coordinator/PASSED receipt
hashes will follow after the new workload proof and freeze.

- `deploy_runtime.py`: **d5ebef6ef5b3a778ee79e47a190a546ae5682403e24d3fd9e01e838e13058697**.
- `freeze_runtime.py`: **32edb19ab53b5491bdb801698b0d3742dc49e1c9b060c210251ef6afe5e1b167**.
- `runtime_release_contract.py`: **1c9d909d09cb120a9a9e4c6b123bce3e6c42506fa46f2df2fdcf9f696a501682**.
- `collect_runtime_gate.py`: **d137afe1aac7211fc07c9a182b84be4428cc3fb4e2931111c97568e02393151b**.
- `export_freeze_runtime_kit.py`: **f5391a1454ed71d88d1fe6d4d6a077dfbaef5c4f2c3b47273f055a239ed74486**.

The freezer reads the original stopped/PASSED owned proof only, compares all measured helper bytes,
checks the original immutable receipt/upstream/preservation/log/disk records, and independently re-verifies
both original final-backup comparisons before binding its physical hash. It freezes fresh package/source
indexes, the exact target/build, original unchanged standing YY evidence and current ingress bytes into
one NEW root. No new copy or replay is used for packaging.

Gate collection first verifies the frozen kit, unchanged current live identity/environment, unused root/gate,
and reserve>=10556150894B/scaled formula plus stopped-backup/assets/allocation. It then reads current main,
exact PR/main CI, your formal292 pass and NEW exact-kit pass, refuses later Audit failed, and creates the
10-minute single-use gate with exclusive creation. Standing YY blanket-go evidence stays verbatim; its old
scopeHead is not rewritten. New releaseHead is a separate binding to that standing scope.

The coordinator has one NEW execution mode, plain root Python/apply lock, no explicit installer calls.
Pre-quiesce refusal leaves live untouched. It holds HTTPS/ws/POST ingress at503, stops the original writer,
checks Docker data/assets mounts plus writable SQLite host descriptors, takes/verifies a stopped hashed
DB/assets backup, retains the old container, then starts the candidate's default entrypoint jobs-OFF.
It requires22NO_OP0/21READY0/31+6 probes/full104table38receipt state/mainbytes/data_version before reopening
HTTPS/login/deniedPOST401. Ingress reopens BEFORE jobs. The same readiness code then starts a distinct
jobs-ON candidate, with660s healthy/0restarts/peak<=768MiB observation. Normal app writes after reopen are
not falsely labeled zero release writes. Every failure after quiesce holds maintenance/stopped jobs and
requires a separately audited forward fix; no restore, old-image fallback, retry/override or cleanup.
The reviewed physical core guard/floor/500MB unexplained abort and both workload pins remain unchanged.

12 synthetic contract fixtures pass Windows and exact-source Linux (0fail/error/skip), including stale/future
gates, later failures, changed main/tree, historical reviews, missing hashes/pins, moving roots and FAILEDproof.
These tests are guard evidence only, not a Docker workload proof or exact-kit audit.

No production mutation occurred. The separate YY jobs-pause card and the native workspace permission
card remain untouched. The completed183405Z isolated jobs-OFF proof and all consumed historical kits stay retained.
