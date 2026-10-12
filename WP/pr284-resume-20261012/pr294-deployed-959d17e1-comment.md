Deployed 959d17e11c357266f7c2a41b0c84ab76914c591e to production

Completed UTC: 2026-10-12T22:04:33.865599+00:00. Independent read-only verification passed at 2026-10-12T22:07:04.899797+00:00.

- Exact image: `sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2`; same `lims_lims-data` and `lims_lims-assets` volumes; Docker healthy, zero restarts/OOM, jobs enabled, 768 MiB, blank NODE_OPTIONS, auto-push/auto-seed disabled.
- HTTPS health and login returned 200 with verified TLS; health status ok/version 1.9.0; unauthorized receipts POST returned 401.
- All 104 original tables, 38 receipts, original rows/schema and scientific audit data preserved. Installed state: 106 tables/39 receipts, empty additive import tables and one schema receipt; no analytical backfill or historical draft links. DRY 0 / APPLY 1 / immediate NO_OP 0; full detached repeat preservation passed.
- Both default startups: 23 NO_OP installers/22 READY events, all zero changes. All 31 checks and six probes passed. Stopped logical backups/raw DB-WAL-SHM triples and modes independently reverified; original acceptance/event, NULL ReviewDecision link and PUBLISHED report retained. All 67 frozen files unchanged.
- Ingress reopened before jobs. 661.126780 seconds/23 healthy samples, zero restarts; peak 324,808,704 B <=805,306,368 B. Free 63,693,156,352 B versus 20,152,939,429 B required including 16 retained allocations/assets/logs.

Original root: `/opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z`; ONE213000 unit inactive/exit0. Immutable mode0400 production receipt SHA256 `03e3309714cadd956e13e9b34576ed774f1e56c482fdc2b07a828a52c1fcb953`; manifest `39b054dbc89889493ac02984675ca72e5fc0da1593706a6abcab450ed481b76e`; coordinator `24479eb79a6bdf9d900321dcbc25f2b15e6aa56c110aaf9028e205a5139d6d6d`. Exact-kit PASS6132886810/source PASS6132712806/single consumed gate `fac9e2418ba7376b99e2e57b2e66ad4e66edf3d417bc2b8f083adfb1da56212a`; original144000 PASSED proof and135400 build retained unchanged. Both workload pins held: `labAndHubBuildsOwnedByYY=true` / `RELEASE_DAY_DISK_ABORTS_ACCEPTED`.

[Original receipt and unit journal](https://github.com/yigini/soilfer-lims/tree/b47e818eeb97668c2279e0c25ad3ec37ab47383f/WP/pr284-resume-20261012/completed-production-213000); [independent verification](https://github.com/yigini/soilfer-lims/blob/b47e818eeb97668c2279e0c25ad3ec37ab47383f/WP/pr284-resume-20261012/completed-production-213000-independent-verification.json).

@claude: ready for your actual post-deploy check, #200 closure and #162 tick/handoff. Other application merges remain held until that check. No Claudio postcheck is claimed here. No replay/restart/recollect/retry/restore/older image/cleanup; any failure requires a separately audited forward fix. Failed161000 and superseded202400 remain untouched and excluded.
