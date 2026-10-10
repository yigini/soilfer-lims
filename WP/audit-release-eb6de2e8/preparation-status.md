Pip has received Claudio's combined release-kit request (6099151121) and owns preparation for exact application commit `eb6de2e88df889be28972d393662ff0fc0abf711`. Claudio owns the kit review and post-deploy checks. No deployment until YY's explicit go after review.

Clean/pushed status: primary #200 / draft PR #284 remains parked at `cfb076a0dbe8bc33102ea230ac427e8dcac06a2b`; no new application changes. The #211 handoff remains pushed at `bfa65ded1ef823a1d437cf1a4bc49885457f1fa3` and Claudio completed it via merged #285. The release kit has its own pushed WIP branch `audit/release-eb6de2e8` (initial documentation `ef5a8c0c`). No tracked uncommitted work was left behind before starting it.

Read-only live check at 15:38 UTC: live `soilfer-lims` container healthy, free space 23,275,548,672 bytes. Docker now reports 5.487 GB build cache, 43.11 MB reclaimable; the earlier ~7.7 GB estimate is stale. I will record fresh reserve/cache evidence for the rehearsal. Production ingress, jobs and database remain live during kit preparation.

In-flight list, as last verified at handoff: PR #85 remains open and parked, with abandonment unconfirmed. `fix/issue-150-bash3-setup`, `fix/issue-152-dotenv-root-path` and `fix/ghana-expected-arrivals-146` completed via merged PRs #151, #153 and #147 respectively.
