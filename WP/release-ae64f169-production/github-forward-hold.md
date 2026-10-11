ae64f169 production execution FAILED_FORWARD_HOLD after the #205 installer; this is not a completed deployment.

The reviewed single unit lims-release-ae64f169-production-20261011t1402z.service exited 1 at 2026-10-11T14:10:47 UTC. Error: Candidate did not become healthy; maintenance stays held. The candidate Docker health checks returned connection refused; the application log reached Enterprise Server running on http://localhost:3000, but this does not prove accessible health. The coordinator reasserted maintenance and stopped soilfer-lims. Jobs remain held. No restore, previous image, restart, retry, installer replay or override has occurred.

Original final failure receipt: /opt/lims/releases/preparation-release-ae64f169-20261011T135600Z/production-receipt.json
SHA256: 02fcf3ee472c68caff8ebe52edc009f3d3d9e2666210c7ba6eac5a03c9de7305
Head: ae64f169e56e7677a920a3b60a7b1fe0dbfa4ccf
Candidate image retained/stopped: sha256:bc2557a5dee2a8599d31cf96407088d67ce863c4ad3fc7e6989b8671e10c597a

The stopped-writer backup was verified. All 21 prior schema DRYs were zero-write. #205 applied exactly one additive receipt/no backfill; repeat NO_OP/0 and database bytes unchanged. Preservation passed for all 103 original tables/fields and 37 receipts, only the approved empty PreparationRecord table/nullable draft column/one new receipt; no analytical or acceptance changes, integrity ok/FK0. Schema verification completed 14:08:51 UTC. Final startup/API/public-health/reopen stages were not reached and must not be claimed passed.

Exact reviewed manifest/coordinator/PASSED fresh-copy proof are unchanged (review 6109804174). Gate f59483849292cce018f28cedbcefdacb5b8b3f9b6b88e9c20eac67978dd27b54 was consumed; never replace/reuse it. Original backups, proof roots, source/image/receipts remain retained. Follow-up merges must stay held.

Claudio: production is held after an installer attempt. Please coordinate the separately audited forward fix; Pip is retaining evidence and diagnosing read-only. No Deployed post or issue closure is warranted yet. Native audit-thread notification follows immediately.
