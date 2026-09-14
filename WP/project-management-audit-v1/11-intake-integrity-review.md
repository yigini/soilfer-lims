# Monitor: intake identity and provenance failures

14 September 2026, 02:08 Europe/Rome. Tested feature commit `7096730b253156e3e9c9bb695f641be1e85f7b93` on PR97. Its CI run 34791400306 passed. The requested actual reception/consignment guards, removal of the false Kobo sync timestamp and Overview fallback are present in source. Antigravity's six new happy/negative-path tests do not cover the two integrity failures below.

**Two independent isolated-fixture checks fail. No production data was changed.** Evidence: `monitor-intake-7096730-probes.cjs` and `monitor-intake-7096730-results.json`; source database hash unchanged. The script mounts the real reception router/authentication middleware on a separate schema-only fixture DB; it does not run the application scheduler.

## I01: request project overrides authoritative admission check

Create an EXPECTED sample PRE-PAUSED in PAUSED-P. POST `/api/reception/intake` with its originalId, `projectId: ACTIVE-P`, `isDraft: true`, `decision: DRAFT`. The API returns 200 and persists DRAFT while the sample remains in PAUSED-P.

Cause: the new `candidateProjectId` selects request projectId ahead of the existing sample's persisted identity. Resolve existing sample identity and authorization first. Validate the persisted project; reject conflicting request project identity or route it through a separately authorized, audited transfer. Do not merely switch the order of an OR lookup where id/code can contradict. Apply authoritative identity and admission checks within the mutation transaction and across batch/alternate intake entry points. Draft recovery of an already physically received record, if allowed by policy, must be explicitly distinguished from admitting a new expected sample.

## I02: mutable walk-in field changes discard from revert to hard delete

Create an EXPECTED sample PRE-ACTIVE belonging to an active OPEN_INTAKE project. Save an intake draft with `isWalkIn: true`; the API accepts it. POST `/api/reception/discard` with the sample id. API returns 200, says deleted, and the pre-existing sample record is gone.

Cause: new discard provenance trusts mutable `receptionData.isWalkIn` and heuristic metadata, then still falls back to current projectType. This is not immutable sample origin. Existing external/pre-registered identity must be preserved when intake is opened, saved, retried or discarded; UI/request flags cannot downgrade it into a newly created disposable desk draft.

Use a canonical sample-origin/reception-creation record set by trusted create/import paths, not a user-editable form field. Preserve it on all saves. Handle legacy ambiguity conservatively: do not hard-delete when origin cannot be proven. Only a demonstrably new, authorized disposable desk draft may follow the approved deletion contract; pre-registered records must revert safely with field provenance/history intact. Deduplicate this logic across reception discard, single delete and batch delete. Make deletion/revert, related work/result cleanup and audit atomic; the current multi-step revert is not one transaction merely because its comment says transactional. Add positive tests proving legitimate desk-draft discard still works as designed.

## Acceptance and next monitor

Reproduce I01/I02 as provided, then add permanent coverage of positive and denied paths, conflicting id/code, immutable origin across draft saves, legacy ambiguity, and audit rollback. Do not mutate production records for verification. Preserve the useful PR97 corrections and the existing safe release authorization; do not mark full acceptance until these integrity failures and the original remaining contracts are closed with evidence.

Monitor remains active. Next check should inspect Antigravity response/PR97 or successor, changes in origin persistence across creation/import paths, actual integration tests and deployment evidence. Avoid rerunning earlier unchanged probes or repeating this prompt while the defects are being fixed.

Delivery: I01/I02 handoff queued in LIMSI / LIMS Dev during running deployment script deploy_b342652.sh, without interrupting cutover. Earlier broad continuation is also queued. Next check should confirm consumption and avoid duplicate prompts. Deployment is not independently verified here.
