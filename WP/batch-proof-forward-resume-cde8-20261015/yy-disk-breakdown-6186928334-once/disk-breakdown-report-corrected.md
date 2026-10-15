# Read-only disk breakdown for YY, request 6186928334

Captured 2026-10-15T07:38:46.429989+00:00 to 2026-10-15T07:40:20.152941+00:00; extra summary 2026-10-15T07:42:51.878198+00:00. All commands completed exit0. No deletion, prune, move, container/settings change, SQL connection or database content fetch.

## Filesystem

`/`, `/opt/lims`, Docker and containerd are the same ext4 filesystem, /dev/vda1. Size 253,548,216,320 B (253.548 GB / 236.14 GiB), used 209,987,596,288 B (209.988 GB), available 33,128,968,192 B (33.129 GB). The 10,431,651,840 B difference between size-used-available is unavailable/reserved filesystem capacity; it is not another directory to add to du.

## Physical usage (decimal GB)

| Location | Physical GB | Bytes |
|---|---:|---:|
| /opt/lims/releases (whole parent) | 109.465 | 109465116672 |
| /var/lib/containerd | 43.261 | 43260563456 |
| /opt/lims/audit-backups | 16.211 | 16211320832 |
| /var/lib/docker (includes live volumes) | 11.095 | 11095085056 |
| /opt/lims/backups | 6.157 | 6156845056 |

The releases parent contains 127 directories using 105.425 GB plus 181 loose root files using 4.040 GB (mostly retained source archives). The small remainder is parent directory allocation. Every directory, measured birth time and honest outcome is in `release-roots-corrected.csv` and `release-roots-derived-corrected.json`. A missing own terminal record is labelled unknown; copied build/prior receipts do not make that root PASS or FAILED.

Live data volume: 9.903 GB; live assets: 0.006 GB. These are already inside Docker's physical total. The data volume has 26 regular root files; the current dev.db allocates 563,326,976 B, and most of the remaining space is retained .bak/backup database files. Only file metadata was read.

Other backup directories and exact commands are in the original capture. `/opt/lims/server/backups` uses 0.292 GB. Journalctl reports 144.0M; `/var/log` uses 0.814 GB. These are nested, not additive.

## Docker accounting

34 unique image IDs / 35 image tag rows, 35 tagged references, 0 dangling IDs. Containers: 74 total, 16 running, 58 stopped.

| Docker summary category | Count | Rounded size | Docker reported reclaimable |
|---|---:|---:|---:|
| Images | 34 | 43.19GB | 19.36GB (44%) |
| Containers | 74 | 56.19MB | 761.9kB (1%) |
| Local Volumes | 17 | 10.69GB | 271.3MB (2%) |
| Build Cache | 379 | 9.72GB | 4.14GB |

The Docker summary and verbose image/cache sizes share layers and use rounded values. Do not add them to each other or to physical du. Docker-reported reclaimable does not authorize pruning; retained images/containers remain unchanged.

## Ten largest other depth-2 directories

| Directory | Physical GB |
|---|---:|
| /root | 6.793 |
| /usr | 6.243 |
| /usr/local | 2.500 |
| /root/soilfer-qc186-d6b19c1-20261007 | 2.471 |
| /root/soilfer-qc186-d7653cf-20261007 | 2.353 |
| /opt/soilfer-learn | 1.904 |
| /usr/share | 1.438 |
| /root/soilfer-qc186-e7c2661-20261007 | 1.127 |
| /usr/lib | 1.075 |
| /var/log | 0.814 |

These paths overlap (for example /usr contains /usr/local); do not sum this list.

## Conditional estimate for closed failed/STOP roots

Own terminal receipts identify 33 failed/STOP roots, occupying 52.030 GB. For 16 of those roots this report also independently verified a published original terminal receipt or full closed retention record as an exact Git blob at dd496777400e9c2f4f0ace73009f8cf8c86022d0; their root-only physical estimate is 33,613,312,000 B (33.613 GB). The stricter subset with a full closed retention record is 6 roots / 25.443 GB.

This is a conditional size estimate, not permission or a safe-to-delete list. Exact source paths, publication roles and blob hashes are in the JSON. Raw database/WAL/SHM/backup bytes remain on the server; published JSON/log evidence does not replace those bytes. Input dependencies (including 070000 and the newly sealed installed209 result in 080000) remain retained. No images, stopped containers, live volumes, successful roots, backups or unknown-outcome roots are included in the estimate. Nothing is removed unless YY explicitly asks and the exact retained dependencies are resolved.

## Largest release directories

| Directory | Physical GB | Own outcome |
|---|---:|---|
| workflow-batch-stopped-copy-cde8c889-20261015T080000Z | 16.371 | FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY |
| instrument-import-proof-959d17e1-20261012T144000Z | 9.143 | PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF |
| instrument-import-release-959d17e1-20261012T213000Z | 7.470 | DEPLOYED_NEW_IMPORT_FORWARD |
| workflow-batch-stopped-copy-cde8c889-20261015T070000Z | 5.094 | FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY |
| runtime-kobo-release-f830f900-20261012T012552Z | 3.472 | DEPLOYED_NEW_RUNTIME_FORWARD |
| runtime-kobo-release-51f67988-20261012T044924Z | 3.456 | DEPLOYED_NEW_RUNTIME_FORWARD |
| instrument-import-proof-959d17e1-20261012T134000Z | 3.416 | FAILED_NEW_IMPORT_NATURAL_KOBO_PROOF |
| instrument-import-release-959d17e1-20261012T161000Z | 2.307 | FAILED_IMPORT_FORWARD_HOLD |
| runtime-kobo-proof-171dd36c-20261011T215600Z | 2.298 | PASSED_NEW_CANDIDATE_NATURAL_KOBO_PROOF |
| runtime-kobo-proof-f830f900-20261011T234650Z | 2.296 | PASSED_NEW_CANDIDATE_NATURAL_KOBO_PROOF |
| runtime-kobo-proof-51f67988-20261012T041721Z | 2.294 | PASSED_NEW_CANDIDATE_NATURAL_KOBO_PROOF |
| workflow-batch-stopped-copy-cde8c889-20261015T050000Z | 2.271 | FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY |
| qc187-rehearsal-a14ff63-20261007T105522Z | 2.254 | PASSED |
| runtime-kobo-proof-171dd36c-20261011T211630Z | 1.731 | FAILED_NEW_CANDIDATE_NATURAL_KOBO_PROOF |
| runtime-kobo-stopped-wal-e274-20261012T005800Z | 1.713 | NO_OWN_TERMINAL_RECORD_OBSERVED |
