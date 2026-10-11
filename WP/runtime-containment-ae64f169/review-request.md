New exact source proposed for review under #162 pin6112115233; **not executed**.

Raw Git commit22174264 on audit/release-eb6de2e8, directory WP/runtime-containment-ae64f169:

- known_core_disk_guard.py SHA256 **631d994d51d799b6ac2a717ca1ff7b327992835be95dd3561f51715898be026f**.
- rehearse_jobs_hold.py SHA256 **7fb9cad192f07d0e0fdfb61ffcbc6b2e3165f08bfe41fce6d88af59d213d9af8**.
- Original leaf startup_common.py remains **e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00**; release_support.py **9db6932a9b1502bc2db65c816a925e7d9f54611d54d4027d418bb2574b837810**. Historical source/proofs never edited.

The first new proof175017Z remains FAILED, original receipt **ffeb1f607b78c468ec503eb67ed4a9740c1a990e4459aff5e8548630c162ecd0**, owned container stopped/retained; no production mutation. A second125s read-only watch captured systemd-coredump PID299889/fd5, device64769/inode145884, deleted-open raw1GiB core with **1,073,745,920 allocatedB**, plus compressed output. Final25-27MB retained dumps alone miss this transient physical allocation. The raw observation is pushed in core-process-allocation-watch.json.

Proposed guard meets the five pins: absolute reserve **10,556,150,894B** and original **500,000,000B unexplained abort** remain; only measured physical same-device blocks are credited, core-storage regular files or active systemd-coredump FDs, deduplicated by device/inode. Baseline conservatively takes the greater inode observation around df; current credit requires the same inode both before/after df and uses the smaller count. Unreadable, expired or newly appearing-after-df candidates receive no credit. No core-content reads, deletion/truncation/disable/settings change. Every before/after attribution, pid, blocks, inode and arithmetic is logged and embedded/bound in the final or failed receipt. Six Linux guards pass at these exact source hashes, exit0,0.012s; logSHA256 **b1cf977b433146a8a34588ddf6ad6267474d14d2b5f7a7d2a010b8c34ac48d9d**.

The new isolated proof stops its owned writer and checks stopped-copy preservation before creating a PASSED receipt. It retains same image/environment/768MiB,22 startup NO_OP0/21 READY0,31+6 probes, all104 tables/38 receipts/main bytes/data_version and660s healthy/restart-stable observation. This source has no production execution mode. After your source review I will export raw committed bytes into another NEW fresh-copy root, never retry175017Z. YY's native temporary jobs-pause decision stays pending and untouched; no live action under this proof review.

Independent PR292149/149 +scale replay is posted in6112174348; PR291122/122 +16 pure outcomes in6112182389. Runtime recovery292 remains priority. Both workload pins and forward-only recovery remain; original backups/failed and passed receipts/consumed gates retained.
