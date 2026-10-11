YY's Remove old images decision was relayed in the current trusted user request
on October 11, 2026, with an explicit instruction to free space and deploy
feac6534 now. The request named #162 comment 6105830882 as the cleanup scope.

Pip fetched that original GitHub comment: created/updated 05:27:52 UTC, author
yigini, recording YY's original card choice at 05:27 UTC. This is the source
for the reported card timestamp. Pip did not freshly inspect the original card:
Computer Use navigation failed twice with "failed to activate captured window".
Pip stopped UI input and preserved human drafts and decisions. Cleanup proceeded
under the explicit current user request, rather than an inferred new permission.

Authorized scope: remove only unreferenced images by digest, checking running
and stopped containers; preserve production/release images, their bases and
builders, and YY's lab/hub/gateway images. No force, system/volume prune, DB,
WAL/SHM, backup, proof or receipt cleanup. Record image inventories and df -B1
before/after and two free-byte samples at least five minutes apart. Require the
8 GiB reserve plus stopped backup headroom and abort on unexplained 500 MB drop.

Deployment remains authorized by YY's previously inspected Main now / Auto
after review decisions once the unchanged kit, audit, CI, reserve and data
preservation gates pass. Both workload pins remain required. This note does not
replace or change either frozen YY authorization file or any reviewed kit byte.

Guard source: https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6105830882
Cleanup progress: https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6105901247
