# Disk upgrade and post-boot verification

YY's disk upgrade/reboot finished around 13:00 UTC on October 11 without a pre-reboot clean stop or fresh backup. The kernel uptime and same containers' start times independently establish the reboot. Pip performed no provider-panel action, stop, restore, image rollback or installer replay.

The read-only checks in `postboot-readonly.json` passed at 13:10:38 UTC. The root disk grew from 120 GiB to 240 GiB (257,698,037,760 B), the ext4 partition grew to 257,696,972,288 B and free bytes were 130,876,772,352 B. LIMS retained the same container, exact feac6534 image `159057d5`, data/assets volumes and zero restarts. Hub and gateway retained their original containers/images and persistent volumes. YY explicitly accepted labs on demand in this chat; no lab container was recreated by Pip. The admin home remains present with 25 notebooks and 474 regular files, compared with 476 in the earlier observation. No historical file manifest exists to identify the two-file difference, and no claim of full home-file preservation is made.

SQLite integrity is OK with zero foreign-key violations. All 103 table counts match the original feac production receipt from 06:00:46 UTC, the latest retained database-count baseline; there was no immediately-preboot database snapshot. All 37 schema-receipt rows and fields match that baseline. The recorded acceptance remains ACCEPTED, the original ReviewDecision attemptId remains NULL and the published report remains PUBLISHED. All 26 original frozen kit files and the original production receipt hash remain unchanged.

LIMS root/sign-in pages and the configured hub sign-in page return HTTPS 200 with TLS verification passing. Anonymous auth/me returns 401; authenticated read-only auth/me requests pass locally and over public HTTPS using an ephemeral token for the already reviewed principal. No password-login POST or persistent session/account mutation was attempted.

After the checks and YY's on-demand-lab clarification, Pip created a fresh consistent **online** SQLite backup and assets archive, completed 13:12:06 UTC at `/opt/lims/backups/postboot-feac6534-20261011T131200Z`. This is a post-boot backup, not a pre-reboot or stopped-writer backup. Backup integrity/FK/count checks and assets archive/source verification passed. Original live DB/WAL/SHM, volumes, previous backups/proofs/receipts and images were not deleted or restored. The backup remains evidence only under the forward-only recovery policy.

- Database: 563,322,880 B; SHA256 `90d3c734d4e9a7ce46f98bd3b36611ab422345b177cbe0b0878176ca100aaae6`.
- Assets archive: 1,815,221 B; SHA256 `44af91d141e3e07caf3ea15a488c042ff77d3b65c2358d2dee06121c24579694`.
- After backup: 130,311,385,088 B free, above the conservative 10,556,150,894 B future proof/deployment budget plus remaining kit allocation. This budget retains the 8 GiB floor, two proof DB copies, later stopped-writer production backup, assets and log allowance. The new post-boot backup's allocation has already been deducted from the observed free bytes.

The earlier attribution of the 12:21 lab stop to Claudio is withdrawn. Claudio explicitly states that he has no host access, ran no host command and did not stop it. The authenticated soilfer-admin API stop is established; its initiator remains unknown. Automatic idle timeout is configured at 60 minutes, but an idle-cull cause is not established.

The ae64f169 candidate build remains the original valid build, image `bc2557a5`, with unchanged build receipt, source archive and Git-blob index. New-release proof and freezing are separate from the completed feac deployment; never rebuild/replay the old release or collect a new production gate before the new exact-kit audit.
