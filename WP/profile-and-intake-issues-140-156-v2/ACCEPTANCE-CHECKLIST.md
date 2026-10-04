# Acceptance checklist for profile and reception improvements

All items start pending. For completion record the environment, commit, actual action, pass/fail and evidence path. A mockup or proposed JSON scenario is not executed evidence. Reuse previously accepted unchanged evidence; do not rerun unrelated suites.

The **PR** column assigns finite evidence to A0 → A → B1 → B2. All four increments are owner-authorized without waiting for issue replies. Before deployment, its tagged implementation checks and applicable R01–R03/R05 safeguards must pass. R04 live verification and R06 issue updates are post-deployment completion evidence; they cannot be prerequisites for that same deployment. External J02–J05 belong to Eloi's team, remain tracked on issue 140 and do not block LIMS delivery. Split items state their phase explicitly. Do not label pending work completed or repeat unrelated accepted suites.

## Profile identity and capture

| ID | PR | Required check | Status |
|---|---|---|---|
| P13 | A (first) | Read-only copy plus retained journals/snapshots inventory current and historically emitted keys, verified/missing/conflicting/held candidates and affected rows. Zero-current is not assumed zero-historical. Compatibility preservation and scientific correction are distinguished; mutations are reviewed, scoped, auditable and idempotent. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P01 | A | Explicit pit and site coexist; new canonical identity uses verified pit and preserves site. Absent canonical retains compatible legacy identity; valid explicit unknown stays null; invalid present canonical reports a conflict without silent legacy substitution. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P02 | A | Conflicting explicit profile aliases surface a review conflict; no arbitrary winner. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P03 | A | Wrapped values, zero, blank/null, invalid objects/arrays/booleans and false flags parse correctly. Explicit unknown does not resurrect an alias. Previously emitted malformed keys require reviewed correction, not silent replacement. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P04 | A | Both canonical and already exported legacy identities remain stable through project rename, country-label change and lab transfer. Exact legacy preservation is materialized before mutation or mutation is guarded; same code in another namespace stays separate. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P05 | A | Site point/composite/unknown are not relabeled confirmed profiles from depths or GPS. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P06 | A | Kobo exact configured mappings work in normal sync, force sync and replay. Legacy fingerprints remain compatible; true corrections follow revision rules. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P07 | A | Verified manual values, duplicate/provenance holds and PR154 replay protections survive source refresh. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P08 | A | Manifest and batch mapping preserve row-specific code/depth and shared namespace only when explicitly selected. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P09 | A | Single intake/draft save/reopen preserves reference, evidence and typed values; no fabricated missing source facts. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P10 | A | Generic metadata edit cannot bypass released-reference protection through canonical keys or aliases. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P11 | A | Authorized post-release correction records reason, old/new value, actor and change event; analytical values remain intact. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P12 | A | v1/v2/GeoJSON/current snapshot/change payloads agree; old frozen snapshot remains unchanged after correction. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| P14 | A | Unknown profile remains null and does not block ordinary laboratory operations or silently change existing OpenNSIS eligibility. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |

## Exchange reliability and performance

| ID | PR | Required check | Status |
|---|---|---|---|
| E01 | A0 | Actual routed injected hold failure yields typed `503 EXCHANGE_ELIGIBILITY_UNAVAILABLE`, bounded server-generated request ID and Retry-After, no successful-empty masquerade/protected data, for every enumerated caller. Controllers forward typed failure; correlation starts before auth on all four v1/v2 aliases and unrelated error behavior is preserved. | Verified (PASS in `tests/contracts/exchange_error_semantics.test.js` across all 4 aliases and query endpoints: samples, detail, geojson, results, observations, spectra, sync, stats, snapshots, changes) |
| E02 | A0 | Genuine empty authorized dataset yields truthful HTTP200 empty data; revoked/disabled/unauthorized access retains explicit errors. | Verified (PASS in `tests/contracts/exchange_error_semantics.test.js`: truthful 200 OK with `data: []` and total: 0) |
| E03 | A0 | One eligibility resolution supplies both count/list; cursor seeks affect only list and preserve documented total semantics. | Verified (PASS in `tests/contracts/exchange_error_semantics.test.js`: `buildSampleWhere` invoked exactly 1x per `getSamples` request) |
| E05 | A0 | Malformed metadata, holds, unreleased data, disjoint labs/projects and unavailable policy remain protected on touched v1/v2 paths. | Verified (PASS in `tests/contracts/exchange_error_semantics.test.js` and `tests/contracts/nsis_policy_and_scoping.test.js`) |
| E11 | A0 | OpenAPI/operator docs describe retryable 503 and link the owner's delivered issue-140 notice before deployment: honour delay, retain checkpoint/previous data, never interpret failure as withdrawal/empty data. No contributor acknowledgement gate or claimed receiver completion. | Verified (`docs/openapi-data-exchange-v2.yaml` 503 schema/headers, `docs/nsis-operator-runbook.md` Section 7 with link to issue #140 comment 5972150911) |
| E04 | A | Unchanged first-page query/scope returns the same eligible specimen IDs across bounded repeated reads. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| E06 | A | Pagination/signed cursor/changed scope/expiry/amendment/withdrawal behavior survives changes; snapshots remain frozen. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| E07 | A0 / A | A0: bounded correlation and minimum phase timings verified on actual routes without secrets/scientific payloads. A: deployed-instance correlation and measured comparison distinguish slow data, genuine empty and failed eligibility. | A0: Verified (`server/middleware/exchangeCorrelationMiddleware.js` pre-auth generation, phase timing instrumentation; PASS in contract suite). A: independently live;20stable routed cohort reads p95256ms (loopback), RELEASE-EVIDENCE-A.md. |
| E08 | A | Production-sized read-only copy/query plans justify any added index or scoped hold query; no global hold semantics weakened. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| E09 | A | Proposed warm p95 below one second for the three-specimen cohort is measured under named normal load; cold/network timings and one larger page recorded. If lock contention dominates and the target needs a larger change, measured options are presented to the owner instead. | PASS for named synthetic copy cohort and actual stable routed reads; cold/WAN distinction recorded in A evidence. |
| E10 | A | If telemetry, initialization or the hold-lookup connection is changed, show the measured reason and relevant startup/revocation behavior; no cached authorization. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |

## Receiver fixture and external acceptance

| ID | PR | Required check | Status |
|---|---|---|---|
| J01 | A | Guarded fixture loader refuses production, is idempotent and records only its own synthetic IDs for cleanup. | PASS; accepted PR160/merged477cc1f/live v3.5.34. See ACCEPTANCE-EVIDENCE-A.md and RELEASE-EVIDENCE-A.md. |
| J02 | External | Eloi ingests the fixture through the actual OpenNSIS path: one profile, two layers, two distinct specimens with bag/lab identity. | Pending external |
| J03 | External | Different namespaces and decimal depths are retained; observation/method/unit semantics remain correct. | Pending external |
| J04 | External | Real replay is idempotent; amendment/withdrawal and expired-checkpoint rebaseline are reconciled. | Pending external |
| J05 | External | Actual scoped counts/checkpoint/receipt are recorded. Fetch-only proof is not called ingestion. | Pending external |

## Intake templates and governance

| ID | PR | Required check | Status |
|---|---|---|---|
| T01 | B1 | Compatible SoilFER seed retains admission/hold/reception safeguards and produces the same decisions as today's five-check flow; other research and commercial soil templates differ appropriately. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T02 | B1 | Effective template follows saved revision/project/lab/seed precedence and explains its source. A walk-in request flag cannot downgrade persisted origin. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T03 | B1 / B2 | **B1:** own-lab manager can choose templates and toggle catalogue criteria/fields; unauthorized lab manager, reception, technician and consumer cannot. **B2:** the same authorization holds for draft/preview/publish/retire. | B1 local PASS; B2 still required. ACCEPTANCE-EVIDENCE-B1.md. |
| T04 | B1 | Per-project template selection requires actual project/lab authority; no membership or data-scope expansion. (B2 extends this to finer project + material + origin bindings.) | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T05 | B1 | Required field/criterion is enforced server-side, including direct API omission/tampering; unknown or invalid answers give useful errors. (B2 repeats for custom fields.) | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T06 | B1 | NA/notes/failure severity and manager exceptions follow the bound revision; changing labels/language does not change meaning. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T07 | B1 | Single, batch, manifest, legacy acceptance and existing offline RECORD_INTAKE use the same canonical operation/revision and conformity decision. Receipt alone is not acceptance; institution ID is never used as specimen accession. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T08 | B1 | Batch confirmation is explicit, actor/time recorded, with per-row exceptions; missing observed depths/checks are not fabricated (no PASS or 0–20 cm defaults). | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T09 | B1 | Incomplete drafts preserve answers/photos/source and pinned valid revision through save/reopen/accept/sync. New binding/default does not invalidate them; retire stops new selection only. Revoked/invalid revision, token tampering and concurrent edits produce recoverable 409 with minimum recovery, not erased input. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T10 | B2 | Explicit draft update previews differences and preserves values; concurrent/revoked-version conflict keeps draft recoverable. | Pending |
| T11 | B1 | Accepted historical intake retains its old schema/answers/outcome; legacy reads are pure and do not backfill writes. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T12 | B1 / B2 | B1: scoped autosave and legacy recovery without deletion; shared-device confidentiality; queued draft and receipt/accept preserve full payload/context/profile/revision/custody/photos and intent; revalidate scope and issue durable receipts; replay never duplicates or silently receives a draft. Legacy missing context and revoked/concurrent conflicts retain recoverable device input. B2: repeat for custom fields and explicit upgrade. | B1 local PASS; B2 still required. ACCEPTANCE-EVIDENCE-B1.md. |
| T13 | B1 | SoilFER, research and commercial operator journeys show only applicable fields; unknown source facts remain unknown where allowed. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T14 | B1 | Mass interpretation follows ordered-analysis planning; observed moisture/foreign material is separate from template conformity rules. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T15 | B1 | Sample provenance/history, permitted report context and exchange reference agree with reception; workbench/result approvals remain unchanged. | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T16 | B1 / B2 | **B1:** new interface content exists in five configured languages. **B2:** admin-authored template label variants have visible fallback/completeness. | B1 local PASS; B2 still required. ACCEPTANCE-EVIDENCE-B1.md. |
| T17 | B1 | Keyboard labels/focus, 320px layout and existing light/dark theme components remain usable; physical evidence distinguished from emulation. (Re-check in B2 for the editor.) | B1 local PASS; ACCEPTANCE-EVIDENCE-B1.md. Exact candidate/release pending. |
| T18 | B1 / B2 | B1: duplicate binding selectors/stale concurrent settings saves rejected; saves atomically create immutable revision/audit. B2: managers create/edit/enable custom criteria and supported typed context fields with stable IDs, validated bounds and safe canonical mappings; executable content rejected. | B1 local PASS; B2 still required. ACCEPTANCE-EVIDENCE-B1.md. |

## Release and completion (apply to each PR)

| ID | PR | Required check | Status |
|---|---|---|---|
| R01 | each | PR shows exact head, relevant CI/tests, code/docs and finite evidence for its tagged items. Product baseline/unrelated owner work preserved. | Pending |
| R02 | A, B1, B2 if needed | Actual additive migrations and separate reviewed preservation/correction rehearse safely on copy; second execution idempotent; counts/integrity verified. A0 has no migration; inspect actual B2 needs rather than assuming none. | Pending |
| R03 | each | Independent acceptance, guarded merge and exact merged-main CI precede established backup/cutover/deployment. Releases are sequential: A0 → A → B1 → B2. | Pending |
| R04 | each | Live version and touched role/flow/API behavior independently verified using designated safe accounts/data. | Pending |
| R05 | A, B1, B2 | Post-write rollback preserves new work and additive answers/audit; no unreviewed old DB restore. | Pending |
| R06 | each, post-release | #140 records actual LIMS/receiver status and remains open for external acceptance. #156 reports B1 as initial delivery and closes only after authorized B1+B2 custom configuration and operator safeguards are verified live; no reply gate. #102/#103 untouched. | Pending |

These are finite checks for the proposed changes. Agy may group related cases in meaningful tests/journeys; it need not manufacture a separate test file for every row.
