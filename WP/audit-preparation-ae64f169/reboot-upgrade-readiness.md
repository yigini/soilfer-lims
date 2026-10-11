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

Pip requested a correction to Claudio's initial failure advice around 12:17 UTC: its database/snapshot restoration suggestion conflicts with YY's retained forward-only post-installer rule. Any failure must retain evidence and maintenance/jobs holds and require a separately audited forward fix; no database restoration, rollback to a previous image, installer replay or override. A same-container restart on current feac is ordinary restart, not a rollback. Provider console/rescue boot repair must preserve current database bytes.

The reboot preparation has not been done. This document is neither permission to reboot nor release execution authorization. The separately built ae64f169 image remains parked; its fresh-copy proof, exact-kit audit and fresh production execution gate remain outstanding after disk capacity is confirmed.
