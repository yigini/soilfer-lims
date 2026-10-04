# Acceptance checklist for profile and reception improvements

All items start pending. For completion record the environment, commit, actual action, pass/fail and evidence path. A mockup or proposed JSON scenario is not executed evidence. Reuse previously accepted unchanged evidence; do not rerun unrelated suites.

## Profile identity and capture

| ID | Required check | Status |
|---|---|---|
| P01 | Explicit pit/profile reference and site ID coexist; new canonical identity uses the verified pit without losing site. Released legacy grouping is not silently changed. | Pending |
| P02 | Conflicting explicit profile aliases surface a review conflict; no arbitrary winner. | Pending |
| P03 | Wrapped values, valid zero, blank/null, invalid objects/arrays/booleans and explicit false flags parse correctly. | Pending |
| P04 | Saved namespace/key remains stable through project rename, country-label change and lab transfer; same code in another namespace stays separate. | Pending |
| P05 | Site point/composite/unknown are not relabeled confirmed profiles from depths or GPS. | Pending |
| P06 | Kobo exact configured mappings work in normal sync, force sync and replay. Legacy fingerprints remain compatible; true corrections follow revision rules. | Pending |
| P07 | Verified manual values, duplicate/provenance holds and PR154 replay protections survive source refresh. | Pending |
| P08 | Manifest and batch mapping preserve row-specific code/depth and shared namespace only when explicitly selected. | Pending |
| P09 | Single intake/draft save/reopen preserves reference, evidence and typed values; no fabricated missing source facts. | Pending |
| P10 | Generic metadata edit cannot bypass released-reference protection through canonical keys or aliases. | Pending |
| P11 | Authorized post-release correction records reason, old/new value, actor and change event; analytical values remain intact. | Pending |
| P12 | v1/v2/GeoJSON/current snapshot/change payloads agree; old frozen snapshot remains unchanged after correction. | Pending |
| P13 | A read-only historical inventory counts verified/missing/conflicting/held candidates; any approved correction is row-specific, auditable and idempotent. | Pending |
| P14 | Unknown profile remains null and does not block ordinary laboratory operations or silently change existing OpenNSIS eligibility. | Pending |

## Exchange reliability and performance

| ID | Required check | Status |
|---|---|---|
| E01 | Injected hold-lookup failure yields typed retryable service error, no HTTP200 empty masquerade and no protected payload. | Pending |
| E02 | Genuine empty authorized dataset yields truthful HTTP200 empty data; revoked/disabled/unauthorized access retains explicit errors. | Pending |
| E03 | One eligibility resolution supplies both count/list; cursor seeks affect only list and preserve documented total semantics. | Pending |
| E04 | Unchanged first-page query/scope returns the same eligible specimen IDs across bounded repeated reads. | Pending |
| E05 | Malformed metadata, holds, unreleased data, disjoint labs/projects and unavailable policy remain protected on touched v1/v2 paths. | Pending |
| E06 | Pagination/signed cursor/changed scope/expiry/amendment/withdrawal behavior survives changes; snapshots remain frozen. | Pending |
| E07 | Phase timings and deployed-instance correlation distinguish slow data response from empty/error response without secrets or scientific payload logging. | Pending |
| E08 | Production-sized read-only copy/query plans justify any added index or scoped hold query; no global hold semantics weakened. | Pending |
| E09 | Proposed warm p95 below one second for the three-specimen cohort is measured under named normal load; cold/network timings and one larger page recorded. | Pending |
| E10 | If telemetry or initialization is changed, show the measured reason and relevant startup/revocation behavior; no cached authorization. | Pending |

## Actual receiver acceptance

| ID | Required check | Status |
|---|---|---|
| J01 | Guarded fixture loader refuses production, is idempotent and records only its own synthetic IDs for cleanup. | Pending |
| J02 | Eloi ingests the fixture through the actual OpenNSIS path: one profile, two layers, two distinct specimens with bag/lab identity. | Pending external |
| J03 | Different namespaces and decimal depths are retained; observation/method/unit semantics remain correct. | Pending external |
| J04 | Real replay is idempotent; amendment/withdrawal and expired-checkpoint rebaseline are reconciled. | Pending external |
| J05 | Actual scoped counts/checkpoint/receipt are recorded. Fetch-only proof is not called ingestion. | Pending external |

## Intake templates and governance

| ID | Required check | Status |
|---|---|---|
| T01 | Compatible SoilFER seed retains admission/hold/reception safeguards; other research and commercial soil templates differ appropriately. | Pending |
| T02 | Effective template follows saved revision/project/lab/seed precedence and explains its source. A walk-in request flag cannot downgrade persisted origin. | Pending |
| T03 | Own-lab manager can draft/preview/publish/retire; unauthorized lab manager, reception, technician and consumer cannot. | Pending |
| T04 | Project binding requires actual project/lab authority; no membership or data-scope expansion. | Pending |
| T05 | Custom required field/criterion is enforced server-side, including direct API omission/tampering; unknown or invalid schema answers give useful errors. | Pending |
| T06 | NA/notes/failure severity and manager exceptions follow the bound version; changing labels/language does not change meaning. | Pending |
| T07 | Single, batch, manifest and legacy acceptance produce the same conformity decision; receipt alone is not acceptance. | Pending |
| T08 | Batch confirmation is explicit, actor/time recorded, with per-row exceptions; missing observed depths/checks are not fabricated. | Pending |
| T09 | Drafts may be incomplete; reopening keeps input/photos/source/version. Publishing revision 2 does not silently reset revision-1 drafts. | Pending |
| T10 | Explicit draft update previews differences and preserves values; concurrent/revoked-version conflict keeps draft recoverable. | Pending |
| T11 | Accepted historical intake retains its old schema/answers/outcome; legacy reads are pure and do not backfill writes. | Pending |
| T12 | Local/offline draft storage is account/lab/project/sample/revision-scoped; logout/shared-device and synchronization conflict handling preserve confidentiality and input. | Pending |
| T13 | SoilFER, research and commercial operator journeys show only applicable fields; unknown source facts remain unknown where allowed. | Pending |
| T14 | Mass interpretation follows ordered-analysis planning; observed moisture/foreign material is separate from template conformity rules. | Pending |
| T15 | Sample provenance/history, permitted report context and exchange reference agree with reception; workbench/result approvals remain unchanged. | Pending |
| T16 | New interface content exists in five configured languages; admin template variants have visible fallback/completeness. | Pending |
| T17 | Keyboard labels/focus, 320px layout and existing light/dark theme components remain usable; physical evidence distinguished from emulation. | Pending |
| T18 | Schema validation rejects executable content, forbidden canonical mappings, duplicate binding selectors and stale concurrent updates. | Pending |

## Release and completion

| ID | Required check | Status |
|---|---|---|
| R01 | Separate PR A/B show exact heads, relevant CI/tests, code/docs and finite evidence. Product baseline/unrelated owner work preserved. | Pending |
| R02 | Additive migration and any separate reviewed historical correction rehearse safely on copy; second execution idempotent; counts/integrity verified. | Pending |
| R03 | Independent acceptance, guarded merge and exact merged-main CI precede established backup/cutover/deployment. | Pending |
| R04 | Live version and touched role/flow/API behavior independently verified using designated safe accounts/data. | Pending |
| R05 | Post-write rollback preserves new work and additive answers/audit; no unreviewed old DB restore. | Pending |
| R06 | #140 reports actual LIMS/receiver status and stays open for genuine external acceptance; #156 closes only after requested flows pass. #102/#103 untouched. | Pending |

These are finite checks for the proposed changes. Agy may group related cases in meaningful tests/journeys; it need not manufacture a separate test file for every row.
