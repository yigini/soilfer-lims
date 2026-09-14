# Antigravity Implementation & Verification: Full Resolution of S01, C01, C02, R01 Contract Findings

**Date:** 2026-09-14 02:30 UTC / 04:30 Europe/Rome  
**Author:** Antigravity (Assistant Pair Programmer)  
**Reference Reviews:**
- `WP/project-management-audit-v1/18-acceptance-coverage-review.md` (Initial Monitor Review)
- `WP/project-management-audit-v1/20-pending-contract-implementation-review.md` (Contract Implementation Review)  
**Contract Baseline:** `WP/project-management-audit-v1/04-acceptance-and-release.md`  
**Automated Probe Suite:** `WP/project-management-audit-v1/a01-a20-acceptance-probes.cjs`  
**Structured Acceptance Evidence:** `WP/project-management-audit-v1/a01-a20-acceptance-results.json`  
**Local Database Hash Invariant (`dev.db`):** `388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B` (Verified 100% Intact)  
**Production Invariant:** `36,870` samples intact on `https://lims.yigini.net` (`soilfer-lims:v3.5.5-79cd43f`)

---

## 1. Executive Summary

This report documents the end-to-end implementation and comprehensive automated verification resolving the independent monitor's findings in `20-pending-contract-implementation-review.md`:
1. **S01 (SIS Release Policy)**: Removed `ACCEPTED` and `COMPLETED` from release inference. Applied `AUTHORIZED_RELEASE_STATUSES = ['APPROVED', 'RELEASED']` as a strict query invariant in `sisController.js:buildSisWhere`. Any query targeting pre-release states (`EXPECTED`, `RECEIVED`, `ACCEPTED`, `PROCESSING`, `SUBMITTED_PARTIAL`, `SUBMITTED_FULL`, `RECEIVED_REJECTED`) is trapped to `__denied_unapproved__` and strictly denied.
2. **C01 (Command Receipts & Atomicity)**: Relocated `commandReceiptService.recordReceipt` inside the atomic database transaction `tx` across `updateProject`, `uploadManifest`, and `updateProjectLabAccess`. Internalized `expectedRevision` inside the transaction. Bound normalized full payload hashes (`computePayloadHash`). Enforced reauthorization before replay. Wired idempotency keys, revision headers, and preview tokens into UI components (`ProjectActionsModal.jsx`, `ImportPreviewModal.jsx`). Added authorized operation lookup route `GET /api/projects/:id/operations/:key`.
3. **C02 (Preview Token Authoritative Binding)**: In `previewImport`, authorized against `destinationLabId` via `canImportProjectSamples`. Issued HMAC-SHA256 signed `previewToken` with 15-minute TTL binding `projectId`, `destinationLabId`, `actor`, `projectRevision`, and `sampleIdsHash`. In `uploadManifest`, verified signature, expiry, project match, destination match, actor match, and ID checksum.
4. **R01 (Reconciliation Conflict Prevention)**: In `reconcile_projects.js`, treated superset, subset, and disjoint mismatches between junction and legacy JSON as `UNRESOLVED_AMBIGUITY_CONFLICT`. Abolished automatic unioning (`[...new Set(...)]`). Added checks for inactive labs (`INACTIVE_OR_MISSING_LAB_CONFLICT`) and missing owner labs (`MISSING_OWNER_CONFLICT`). Preserved explicit-empty and country-only configurations.

The acceptance probe suite (`a01-a20-acceptance-probes.cjs`) was executed against an isolated temporary schema-only SQLite fixture. All 20 acceptance criteria and 80 subcases are **VERIFIED (20 / 20 PASS)** with zero mutations to `server/prisma/dev.db`.

---

## 2. Detailed Resolution of Monitor Findings

### 2.1 S01: SIS Release Policy Invariant & Query Bypass Prevention
- **Monitor Finding:** In `sisController.js:buildSisWhere`, the default allowlist included `ACCEPTED`. Per `workflowContract.js`, `ACCEPTED` represents intake validation, not analytical approval. The prior query branch accepted unapproved statuses (`RECEIVED`, `SUBMITTED_FULL`, `SUBMITTED_PARTIAL`) verbatim.
- **Contract Tested (A19):** *"archived project through reports/SIS -> Authorized released records remain available per release policy; unapproved/draft data inaccessible; project identity remains stable"*
- **Implementation:**
  - In `server/controllers/sisController.js:buildSisWhere`:
```javascript
const isRestrictedConsumer = sisAuth?.type === 'API_KEY' || ['VIEWER', 'EXTERNAL_VIEWER', 'NSIS_CONSUMER'].includes(sisAuth?.role);
const AUTHORIZED_RELEASE_STATUSES = ['APPROVED', 'RELEASED'];

if (isRestrictedConsumer) {
    if (query.status && (query.status === 'all' || query.status === '*')) {
        where.status = { in: AUTHORIZED_RELEASE_STATUSES };
    } else if (query.status) {
        const requested = String(query.status).trim().toUpperCase();
        if (AUTHORIZED_RELEASE_STATUSES.includes(requested)) {
            where.status = requested;
        } else {
            where.status = '__denied_unapproved__';
        }
    } else {
        where.status = { in: AUTHORIZED_RELEASE_STATUSES };
    }
}
```
  - Also added coordinate fallback to `sample.latitude` and `sample.longitude` in `formatSampleForSis`.
- **Subcases Verified in A19 (14 Subcases):**
  1. `eligible_project_archival_succeeds_200`: Project archives to `COMPLETED` when all specimens are accounted for.
  2. `project_identity_remains_stable`: Project `id` and `code` remain intact post-archival.
  3. `authorized_report_sample_lookup_published`: Official report accessible for released sample.
  4. `authorized_report_content_available`: Report content retrieved with valid report number.
  5. `unapproved_sample_report_denial_403`: Report generation denied for cancelled sample (`PUBLISH_DENIED`).
  6. `sis_default_query_restricts_to_approved_released`: Default SIS list returns ONLY `SMP-SIS-APP` and `SMP-SIS-REL` (excludes all 7 pre-release states).
  7. `sis_wildcard_query_restricts_to_approved_released`: Wildcard query `status=*` restricted to `APPROVED` and `RELEASED`.
  8. `sis_pre_release_status_query_bypass_strictly_denied`: Querying `ACCEPTED`, `SUBMITTED_FULL`, `SUBMITTED_PARTIAL`, `PROCESSING`, `RECEIVED`, `EXPECTED`, or `RECEIVED_REJECTED` returns 0 rows.
  9. `sis_approved_status_query_accessible`: Querying `status=APPROVED` and `status=RELEASED` returns exactly their respective records.
  10. `sis_by_id_pre_release_lookup_denied_404`: Direct ID lookup for pre-release samples returns `404 Not Found`.
  11. `sis_by_id_approved_released_lookup_accessible_200`: Direct ID lookup for approved and released samples returns `200 OK`.
  12. `sis_geojson_and_matrix_strictly_enforce_release_policy`: GeoJSON and results matrix strictly exclude pre-release samples.
  13. `archived_project_released_records_available`: Released specimens in archived project remain queryable.
  14. `unauthorized_scope_sis_denial`: Consumer scoped to foreign lab receives zero samples.

---

### 2.2 C01: Transactional Command Receipts & Full Payload Hashing
- **Monitor Finding:** `recordReceipt` was called outside the database transaction in `updateProject` and `uploadManifest`. Concurrent requests could act before receipt insertion; `expectedRevision` was checked outside `tx`; payload hash did not cover full inputs; UI lacked wiring.
- **Contract Tested (A12):** *"lost response and duplicate same idempotency key; concurrent revision change -> Exactly once effect; operation lookup returns result; stale conflict prevents overwrite"*
- **Implementation:**
  - Enhanced `server/services/commandReceiptService.js`: added `computePayloadHash(payload)` and validated `payloadHash` against parsed outcome to detect collisions.
  - In `server/controllers/projectController.js`:
    - In `updateProject`: atomic transaction covers revision validation, mutation, audit logging, and `commandReceiptService.recordReceipt(tx, ...)`. Re-verifies actor authorization before replaying cached receipt.
    - In `uploadManifest`: atomic transaction covers sample creation, project status update, audit logging, and `commandReceiptService.recordReceipt(tx, ...)`. Checks project authorization before replay.
    - Added `getProjectOperationReceipt`: handles `GET /api/projects/:id/operations/:key` with project access checks.
  - Mounted route in `server/routes/projectRoutes.js`.
  - In `server/services/projectMembershipService.js`: atomic transaction covers junction creation, project update, audit, and receipt recording. Reauthorizes actor before checking replay.
  - Wired UI components:
    - `client/src/components/projects/ProjectActionsModal.jsx`: sends `x-idempotency-key` and `if-match` revision headers.
    - `client/src/components/projects/ImportPreviewModal.jsx`: passes `targetLabId`, receives `previewToken`, and sends `previewHash`, `previewToken`, `x-idempotency-key`, and `if-match` revision headers.
- **Subcases Verified in A12 (7 Subcases):**
  1. `exact_once_manifest_execution`: Manifest executes exactly once on initial request (`200 OK`).
  2. `lost_response_replay_no_mutation_duplication`: Identical re-submission returns cached response without duplicate insertions.
  3. `operation_command_receipt_lookup`: Stored receipt confirmed in `CommandReceipt` table with `status: SUCCESS`.
  4. `operation_route_lookup_200`: `GET /api/projects/:id/operations/:key` returns operation receipt (`200 OK`).
  5. `scope_revocation_before_replay_denied_403`: Unauthorized actor attempting replay is denied (`403 Forbidden`).
  6. `payload_collision_rejected_409`: Reusing key with differing sample payload returns `409 Conflict`.
  7. `stale_revision_conflict_prevented_409`: Stale revision modification returns `409 STALE_REVISION`.

---

### 2.3 C02: Authoritative Preview Token Binding
- **Monitor Finding:** `uploadManifest` only computed a SHA256 checksum of identifiers, omitting actor, destination lab, project, revision, and expiry. `previewImport` did not validate `destinationLabId` against `canImportProjectSamples`.
- **Contract Tested (A14):** *"manifest invalid file/huge file/leading zero/localized header/duplicate/invalid target -> Safe mapping preview, bounded server validation, exact rejected rows; no script execution or unintended identifier conversion"*
- **Implementation:**
  - In `server/controllers/projectController.js:previewImport`:
    - Authorized destination laboratory: `canImportProjectSamples(req.user, project, destinationLabId)`.
    - Generated HMAC-SHA256 signed `previewToken` binding `projectId`, `destinationLabId`, `actor`, `projectRevision`, `sampleIdsHash`, and `expiresAt` (15-minute TTL).
  - In `server/controllers/projectController.js:uploadManifest`:
    - Structured validation sequence:
      1. User authorization for project (denies foreign/revoked actor with 403).
      2. Preview token / hash validation: signature integrity, expiry check (`409 PREVIEW_EXPIRED`), project match (`409 PREVIEW_PROJECT_MISMATCH`), destination match (`409 PREVIEW_DESTINATION_MISMATCH`), actor match (`403 PREVIEW_ACTOR_MISMATCH`), and ID checksum match (`409 PREVIEW_HASH_MISMATCH`).
      3. Destination laboratory verification and authorization.
      4. Admissions pause validation (`422 PROJECT_ADMISSIONS_PAUSED`).
      5. Identifier format validation (`400 INVALID_IDENTIFIER_FORMAT`).
      6. Idempotency replay check.
      7. Atomic mutation transaction.
- **Subcases Verified in A14 (10 Subcases):**
  1. `huge_payload_bounded_validation_400`: Manifests exceeding 5,000 items rejected with `400 PAYLOAD_TOO_LARGE`.
  2. `localized_header_mapping_es_fr_pt`: Multi-language headers mapped across Spanish, French, and Portuguese.
  3. `leading_zero_identifier_preservation`: Identifiers with leading zeros preserved verbatim (`0009871`).
  4. `script_injection_sanitization_400`: Script tags rejected with `400 INVALID_IDENTIFIER_FORMAT`.
  5. `foreign_conflict_confidentiality`: Foreign project conflicts hide project identity.
  6. `invalid_destination_lab_rejected_400`: Inactive destination lab rejected with `400 INVALID_DESTINATION_LAB`.
  7. `preview_to_commit_hash_tamper_detection_409`: Modified preview hash rejected with `409 PREVIEW_HASH_MISMATCH`.
  8. `destination_tampering_rejected_409`: Changing destination lab after preview rejected with `409 PREVIEW_DESTINATION_MISMATCH`.
  9. `expired_preview_token_rejected_409`: Expired preview token rejected with `409 PREVIEW_EXPIRED`.
  10. `preview_to_commit_match_succeeds_200`: Valid preview token commits cleanly (`200 OK`).

---

### 2.4 R01: Conservative Reconciliation & Conflict Prevention
- **Monitor Finding:** `reconcile_projects.js` only flagged conflict when both `missingInJunction` and `missingInAssigned` were non-empty. Superset mismatches (e.g. junction B, legacy [B, C]) automatically granted C.
- **Contract Tested (A16):** *"data reconcile dry run/apply/rerun -> No grant expansion or sample/result loss; exact before/after references and counts; repeat is a no-op; ambiguity unresolved rather than guessed"*
- **Implementation:**
  - In `server/scripts/reconcile_projects.js`:
    - Authoritative junction precedence: when servicing junctions exist (`servicingJunctions.length > 0`), any discrepancy (`missingInJunction.length > 0 || missingInAssigned.length > 0`) is classified as `UNRESOLVED_AMBIGUITY_CONFLICT` (with subtypes `STALE_SUPERSET_CONFLICT` and `MEMBERSHIP_MISMATCH_CONFLICT`).
    - Stale supersets never grant additional servicing labs.
    - Added lab activity checks for unmigrated legacy projects: inactive or non-existent labs flag `INACTIVE_OR_MISSING_LAB_CONFLICT`.
    - Added coordinating owner integrity checks: missing or inactive owner labs flag `MISSING_OWNER_CONFLICT` / `INACTIVE_OWNER_CONFLICT`.
    - Atomic transaction only runs when `!hasUnresolved`.
- **Subcases Verified in A16 (9 Subcases):**
  1. `dry_run_discrepancy_detection_no_mutations`: Dry run identifies discrepancies and unresolved ambiguities without database mutations.
  2. `apply_unambiguous_reconciliation`: Unambiguous unmigrated project receives servicing and owner junctions.
  3. `conflict_ambiguity_kept_unresolved_no_grant_expansion`: Disjoint conflict remains unresolved; no grant added.
  4. `stale_superset_kept_unresolved_no_grant_expansion`: Stale superset project (junction B, legacy B,C) does NOT grant C.
  5. `inactive_lab_conflict_kept_unresolved`: Inactive lab D is NOT granted to project.
  6. `missing_owner_conflict_kept_unresolved`: Project without owner lab is NOT modified.
  7. `country_only_no_automatic_grants`: Country-only project receives zero automatic servicing lab grants.
  8. `explicit_empty_remains_empty`: Project configured with empty servicing labs remains empty.
  9. `rerun_idempotent_no_op`: Second apply run applies 0 changes (`appliedCount === 0`).

---

## 3. Full Acceptance Contract Matrix (A01 - A20)

| Criterion | Exact Contract Title | Subcases | Status | Coverage |
|:---:|---|:---:|:---:|:---:|
| **A01** | foreign project detail/stats/labs/samples/import run/Kobo metadata by known ID | 5 | **PASS** | VERIFIED |
| **A02** | shared-project service manager list, detail, counts, samples, export | 3 | **PASS** | VERIFIED |
| **A03** | owner manager generic PUT with status/owner/assignedLabIds | 2 | **PASS** | VERIFIED |
| **A04** | national manager targets outside-country lab or multi-country governance beyond delegation | 1 | **PASS** | VERIFIED |
| **A05** | coordinator create/edit/read and empty grant | 2 | **PASS** | VERIFIED |
| **A06** | remove all explicit service labs, including country-only fallback case | 2 | **PASS** | VERIFIED |
| **A07** | inactive lab, lab transfer, staff deactivation/grant revocation | 2 | **PASS** | VERIFIED |
| **A08** | archive with expected unaccounted shipment, active work/import/transfer | 1 | **PASS** | VERIFIED |
| **A09** | eligible archive/restore | 4 | **PASS** | VERIFIED |
| **A10** | delete active/released project | 2 | **PASS** | VERIFIED |
| **A11** | injected audit/database failure during create/update/membership/import chunk | 2 | **PASS** | VERIFIED |
| **A12** | lost response and duplicate same idempotency key; concurrent revision change | 7 | **PASS** | VERIFIED |
| **A13** | duplicate sample in create/manifest | 1 | **PASS** | VERIFIED |
| **A14** | manifest invalid file/huge file/leading zero/localized header/duplicate/invalid target | 10 | **PASS** | VERIFIED |
| **A15** | counts and scope across all known/unknown states | 2 | **PASS** | VERIFIED |
| **A16** | data reconcile dry run/apply/rerun | 9 | **PASS** | VERIFIED |
| **A17** | Kobo missing explicit target, two assets/labs, partial failure/retry, pause queued job | 3 | **PASS** | VERIFIED |
| **A18** | project source/default plan changes with existing draft/ordered/released samples | 6 | **PASS** | VERIFIED |
| **A19** | archived project through reports/SIS | 14 | **PASS** | VERIFIED |
| **A20** | legacy endpoint/deep link/export/direct API and spoofed scope query | 2 | **PASS** | VERIFIED |

**Summary Metrics:**
- **Total Acceptance Criteria:** 20 / 20 PASS (100%)
- **Total Subcases Executed:** 80 / 80 PASS (100%)
- **Regression Suite:** `project_audit_regression.test.js` (15 / 15 PASS)
- **NSIS Exchange Suite:** `nsis_exchange.test.js` (4 / 4 PASS)

---

## 4. Verification Environment & Invariants

- **Isolation Strategy:** Schema-only SQLite fixture created in temporary directory (`os.tmpdir()/codex-a01-a20-acceptance-*`).
- **`server/prisma/dev.db` Integrity Check:**
  - Hash before test execution: `388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B`
  - Hash after test execution: `388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B`
  - Result: **100% Intact / Zero Mutation**.
- **Production Status:** `36,870` samples intact on VPS `46.19.33.37`. No remote writes or deployments performed.
