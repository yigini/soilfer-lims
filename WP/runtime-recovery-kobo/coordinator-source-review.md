The new isolated candidate rehearsal source is pushed at
**533c545190bfedb955386610d20faaf86398ba04**. Please review it while the exact-head
#292 audit finishes. This is source review for a NEW owned proof; no deployment
kit or execution gate exists, and no new candidate writer has launched.

Raw-Git SHA256 values:
- `rehearse_runtime.py`: **a88223aa90e22253118b56ce72770ec1a219d0a82f71b3c9556a00c79e8f4271**.
- `proof_contract.py`: **f94a009bad7c89331b1126ab05b7126261fc037c4aabfab3a1e8702ba7960bd6**.
- `export_launch_runtime_proof.py`: **fb32d4b06499fd45dd434d97c9c10d85f0b501a345fda79538ba279b72302aba**.
- `build_candidate.py`: **952a8b657712887057952fc119e58d5204f01a43c06c0509038f112969d314c9**.

The previously reviewed streaming verifier/fetch recorder and historical
release_support/startup_common/physical-core guard bytes remain unchanged.
The candidate head/image are explicitly bound only after verifying the new
build receipt, archive/index, Docker image id/size/revision and merged tree
equality to audited cb79d89b. The launcher independently requires the formal
PR292 audit, fully green exact-head CI and exact merged-main CI/current main.
It exports raw blobs into a fresh root, refuses another owned writer, and
cannot deploy or replay an existing proof. Both workload pins are required.

The proof takes a new read-only SQLite backup including WAL, preserves all
104 tables/38 receipts, and first runs the candidate's default entrypoint
jobs-OFF:22NO_OP0/21READY0/31+6 checks/full rows/main bytes. It stops that owned
container, then starts a distinct jobs-ON owned container at the same768MiB,
blank NODE_OPTIONS and effective environment. Production volumes are never
mounted. There are no separately invoked installer commands.

The actual ZMB config/cursor/interval stay unedited. Read-only upstream GET
must retain at least67pending ids before the natural scheduler starts.
The first completion is sealed into a consistent backup and independently
verified; intake additions/cursors are bound to retained upstream ids. The
second observation ends at least configured interval+2minutes after first
completion and contains660s healthy/zero-restart/peak memory observation.
Scheduler result fields are parsed without JavaScript evaluation; an empty
second fetch is recognized by its real scheduler completion object. Genuine
new second intake is separately enumerated; prior fetched ids cannot produce
new rows or cursor advance. The writer stops before final SQLite backups,
full original-row/schema/integrity/FK verification and any PASSED receipt.

As allowed in6112436098, the verifier remains strict on every existing Sample.
Any legitimate existingEXPECTED conflict remains a retained refusal to
diagnose, not an inferred regression or silently broadened allowance. Full
row checks occur at sealed first/final second boundaries; in-progress commit
versions are recorded without falsely claiming that live intake is zero.

All31guard fixtures pass on Linux at this exact source:0fail/errors/skips,
0.985655s overall, no production database accessed. Windows31 also passed.
The original Linux run refused Docker's9-digit fractional timestamp under
host Python; only comparison precision is normalized to microseconds while
raw timestamps are retained. That failed test log stays in Git. A preceding
mistyped source ref refused locally before any host test; also retained.

Absolute reserve10556150894B/scaled formula and500MB unexplained-drop abort
stay unchanged; fresh-copy allocation is reserved before start. The reviewed
physical core guard retains each accounting observation. No cleanup, restore,
old image, historical installer/gate replay or production action. YY's
temporary live jobs-pause card remains pending/untouched; release auto-go
remains applicable after all NEW audited gates. The isolated jobs-OFF proof
is already stopped/PASSED in6112569844 and must not be replayed.
