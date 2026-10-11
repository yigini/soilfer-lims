# Provider disk upgrade / reboot advice

YY asked Pip to ask Claudio whether a provider upgrade that requires a reboot can be performed safely. This is an advice request. No provider purchase, upgrade, reboot, service stop, database checkpoint, backup creation, maintenance change or new deployment has been executed by Pip.

Pip sent the question to Claudio's existing native LIMS Audit / Lab workflow audit and plan thread on October 11 around 12:15 UTC. Claudio answered that a planned upgrade can proceed after preparation and estimated 15–30 minutes of downtime for services on this host. This is his estimate, not a provider guarantee.

## Read-only observations, October 11 12:15 UTC

- Docker service enabled and active. No active LIMS release unit or build/rehearsal/coordinator process found.
- Current LIMS image remains sha256:159057d56c456a0c7cdef917fd04f53f9a66d6285cc476d7203d63047bfff8e1, healthy, zero restarts; public health status ok/version 1.9.0.
- Persistent LIMS volumes remain `lims_lims-data` mounted at `/app/server/prisma` and `lims_lims-assets` mounted at `/app/server/uploads`.
- LIMS, hub and gateway container restart policies are `unless-stopped`. Lab-admin is `no`, so the reboot plan needs an explicit manual lab-admin restart. Explicitly stopped containers also need their restart behavior handled; do not assume automatic return.
- Root disk is 128,849,018,880 B (120 GiB), ext4 partition already fills the disk. Free bytes 7,052,607,488 B. Provider must actually add disk capacity; a larger CPU/RAM plan alone does not clear the disk hold.
- Completed feac production receipt remains mode 0400, SHA256 1f2e2d6621456bc11664ab7800ba0ab9e95d783b4efafde2a1175d3e1fade8c6. All original backups/proofs/receipts remain retained.

## Preconditions Claudio proposed

1. YY schedules a quiet maintenance window and informs affected users.
2. Record every current container, exact image, restart policy, volume, service state and LIMS database baseline.
3. Hold ingress/jobs and stop LIMS cleanly so there are no writers; checkpoint/integrity-check the stopped database and retain a new consistent backup with its hash. No installer or schema/data reconciliation is involved.
4. Retain a provider snapshot if available, as additional evidence. Use the provider's normal restart rather than a forced power-off.
5. After boot, verify the same current image/volumes, database integrity and baseline, service restarts including lab-admin, public health/HTTPS and actual added filesystem capacity. Re-measure full release reserve and required spaced free-byte samples before the separate release proof.

Pip requested a correction to Claudio's initial failure advice around 12:17 UTC: its database/snapshot restoration suggestion conflicts with YY's retained forward-only post-installer rule. Claudio directly confirmed the corrected advice around 12:19 UTC: any failure must retain evidence and maintenance/jobs holds and require a separately audited forward fix; no database restoration, rollback to a previous image, installer replay or override. The backup/provider snapshot is evidence only and must never be restored. A same-container restart on current feac is ordinary restart, not a rollback. Provider console/rescue boot repair must preserve current database bytes. He also confirmed explicit same-container restarts and manual lab-admin recovery, and that the provider plan must actually enlarge the disk rather than CPU/RAM alone.

The reboot preparation has not been done. This document is neither permission to reboot nor release execution authorization. The separately built ae64f169 image remains parked; its fresh-copy proof, exact-kit audit and fresh production execution gate remain outstanding after disk capacity is confirmed.

## Read-only follow-up, October 11 around 12:27–12:28 UTC

YY asked whether he could proceed now. Claudio directly confirmed in the existing native audit thread that nobody had completed the reboot preparation and instructed YY to wait for a clean stop and hashed backup. Pip has still performed no service stop, checkpoint, backup, reboot, deployment or cleanup.

At 12:28:09 UTC free bytes were 9,200,201,728 B, with the same root filesystem size. Docker build cache was zero, compared with the earlier 2.552 GB cache; this is consistent with the space increase but does not establish its actor or complete cause. Current LIMS, hub and gateway retained their recorded exact images, were running and had zero restarts. The new ae64 build image, previous LIMS images, both lab images and original production receipt hash were retained. `soilfer-lab-admin`, which had been running during the 12:15 observation, was absent from both `docker ps -a` and `docker inspect`; its bce8e4dd image remained. Pip reported this external change to Claudio and asked whether YY or another owner had intentionally removed the container. Pip did not recreate or restart it. No claim is made that every protected database, volume or proof was independently verified unchanged by these limited observations.

## Notebook-container investigation after YY denied removing it

The read-only investigation in `lab-admin-investigation-20261011.json` establishes that JupyterHub stopped the admin notebook server at 12:21:52 UTC and removed its runtime container at 12:21:54 UTC after an authenticated admin API DELETE request. The hub is configured to remove runtime containers on stop while keeping home volumes. `soilfer-home-admin` remains present with 476 files including 25 notebooks; both lab images remain present. This is a notebook-session lifecycle event, not evidence of LIMS deletion or notebook-file deletion. The request's initiating person/process remains unidentified, and a full historical file-content comparison was not performed.

Native Antigravity history independently confirms its build-cache prune and a prune of ten stopped containers during the 14:20 Rome reboot-preparation job. The lab-admin container ID is not in that prune's deleted list. Reviewed saved scripts attempt restart-policy changes and portal hardening but contain no admin-server DELETE call. These separate observations must not be combined into an unsupported attribution of the notebook stop to Antigravity. Findings were communicated to Claudio. Pip has still not stopped/recreated services, prepared the fresh backup, rebooted or performed cleanup.
