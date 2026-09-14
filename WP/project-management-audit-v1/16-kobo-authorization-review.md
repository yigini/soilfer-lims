# PR101 independent review: remaining Kobo authorization gaps

2026-09-14 01:16 UTC. Stable reviewed commit 1f4a6f4a2f219eb745e241829279552624f8a21c, PR101. New isolated real-router tests in monitor-kobo-1f4a6f4-probes.cjs and monitor-kobo-1f4a6f4-results.json: two failures. Temporary schema-only SQLite fixture, source DB hash unchanged; external Kobo fetch/transform mocked, no production requests or writes.

## K02 — explicit configId bypasses service-lab scope

Shared project owned by A, serviced by B, each with its own config. Authenticated manager of B gets ASSET-B by default; the same request with ?configId=CFG-A returns HTTP 200 and ASSET-A, including the other lab's Kobo server/form metadata. No secret token is returned, but the own-lab configuration scope is bypassed.

getProjectKoboConfig checks project visibility, then resolves requestedConfigId from ALL project configurations without applying the actor's permitted configuration/lab scope first. Filter eligible configs by explicit role/country/lab governance BEFORE resolving configId/labId; an explicit identifier narrows scope, never expands it. Test owner/admin authorization as positive counterparts and service/national/empty scope denials. Preserve redaction.

## K03 — inactive servicing lab still receives new Kobo samples

Deactivate B after creating its membership and active Kobo configuration. SUPER_ADMIN calls /api/kobo/sync/B?configId=CFG-B. Response is 200 with newSamples:1 and fixture database contains a new sample assigned to inactive B. Administrative permission to operate sync does not bypass laboratory lifecycle admission restrictions (original A07).

Shared manual/scheduled sync must verify active lab, active/current config, authoritative project mapping and membership both before external fetch and at commit. Current transaction rechecks project/membership but never lab.isActive or config revocation/remapping. Add explicit deactivation-during-fetch and revoked-config fixtures without network calls. Preserve a truthful blocked/skipped receipt and retry eligibility.

## Related source-review concern for the same patch

Commit-time policy skips continue the inner sample loop, then advance lastSubmissionId for the submission and later write lastSyncAt. If a lab/config/project is revoked mid-fetch, skipped specimens can become excluded from the next cursor-based retry. Test this transition with paused/revoked status changing between fetch and commit, including a multi-sample submission, and do not acknowledge skipped uncommitted rows as imported. This is a source-based concern, not separately reproduced in the two tests above.

U01 source changes align project translation call sites, add an accessible search label and provide compatibility for the old t signature. Real rendered five-locale verification after release remains pending. Do not repeat already-passed I01–I04 or unchanged full suites without a new reason.

Continue safe implementation and release under existing authorization. Do not accept PR101 as resolving A07/A17 until these cases pass. No request to interrupt an already-running production cutover; preserve service and prioritize the correction if cutover has started. Keep remaining original acceptance open and correct any completion claims accordingly.

Delivery: sent K02/K03 reproduction and skipped-cursor source concern to LIMSI / LIMS Dev while PR101 CI run 34795293390 was in progress. No production cutover was visible (background task was gh pr checks 101 --watch). Monitor stays ACTIVE; next check should inspect the successor fix and rerun the two isolated cases on a commit-specific copy, then resume original acceptance. No original source/result evidence overwritten.
