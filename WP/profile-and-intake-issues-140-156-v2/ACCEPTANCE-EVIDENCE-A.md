# Increment A: profile identity acceptance evidence

Recorded 3 October 2026, 22:09 UTC. Implementer: Codex; Antigravity remains idle. Candidate branch: `codex/issue-140-profile-identity`, based on accepted live main `8b0ac597f7ce527dfe13397a379f5f383fdd4cbc`. This record is committed with the candidate; its exact head, independent review, CI, merge and live postflight must be recorded before claiming release completion. A0 acceptance stays closed.

## Product behavior

Canonical references distinguish absent, valid, explicit unknown and invalid-present provenance. Codes preserve finite zero, wrapped values and decimal depth; conflicting aliases and malformed provenance fail recoverably. New capture does not infer a confirmed pit from GPS or depth. Exact legacy keys are preserved before relevant context changes. Shared adapters retain transport compatibility across current exports, snapshots and journal payloads.

Single intake/drafts, manifest/batch, manual edits and Kobo normal/force/replay are wired to these rules. Kobo mapping writes use current membership, revision checks and atomic audit; a changed mapping during fetch cannot commit obsolete evidence. Released provenance correction uses a reasoned, scoped clerical amendment without changing results or frozen snapshots. Generic aliases cannot bypass released protection. Ordinary lab operations and existing OpenNSIS eligibility still permit an unknown profile.

No table migration, automatic identity backfill, national registry mutation or result editing was performed. B1/B2 template and offline integrity changes remain separate required increments.

## Read-only inventory (P13)

The production-sized copy is 563,322,880 bytes, SHA256 `61551adf698668f696f93aa0742610316e1943e3309734fa237b1ad94032275e`. Aggregate inventory: 38,566 samples; 0 canonical references; 37,898 compatible legacy keys; 668 missing source references; 7 held; 0 malformed metadata; 0 conflicting explicit pit aliases. Retained copy journal: 3 rows; independently captured live journal: 3 rows, overlap possible; 0 frozen snapshot items and 0 historical non-null profile keys in these retained artifacts. This does not prove that every past live read had an unknown key. Exact preservation remains required. The private row report and source database are outside Git. `server/scripts/inventory_profile_identities.js` opens a selected existing database read-only and does not initialize Prisma or write a backfill.

## Focused automated verification

Disposable small test database, Windows local environment, no real lab results. Each Jest command used `--runInBand --runTestsByPath` and `--testMatch '**/*.test.js'` because this checkout is under `.codex`. Initial no-test path-matching attempts are not counted. The following distinct tests passed across focused runs, rather than being presented as one combined run:

| Suites | Passed | What they establish |
|---|---:|---|
| profile_identity + existing sis_adapter_service | 43 | Four states, scalar/flag/alias semantics, namespace compatibility and current serializers |
| profile_identity_routes | 7 | Mounted scope, released alias block, project preservation, revision conflict, idempotent amendment, current rights before receipt, frozen snapshot/results retained |
| kobo_profile_capture | 16 | Exact mapping, legacy hash comparison, true revisions, source precision and impossible collection-date rejection |
| intake_profile_capture | 8 | Trusted capture, draft reopen, source evidence, explicit unknown/zero and actual two-row batch with distinct accessions |
| profile_capture_safety | 9 | Rejection retention, concurrent final/batch checks, legacy mapping preservation/CAS, removed member, malformed refresh and mapping changes during fetch |
| profile_fixture_workflow | 2 | Loader guards/idempotency and all five specimens through mounted reception → bench → submission → review → approval → scoped export |
| exchange_publication_hold_candidates | 7 | Conservative JSON/hold predicates and missing-schema fallback; infrastructure failure stays an error |
| existing nsis_v2_exchange | 9 | Replicate data, OpenNSIS accessions, actual V2/GeoJSON/snapshot/change/receipt/keyset contracts |
| existing reception_compliance | 18 | Today's five-check decisions, NA/notes/exception/reject and incomplete draft safeguards retained |
| existing kobo_duplicate_provenance + kobo_explicit_mapping | 43 | Provenance ambiguity, replay, force refresh, membership and fetch revocation retained |
| existing issue140_remediations + issue149_codex_932cb6a_remediations | 24 | Frozen snapshots, credential/connection isolation, monotonic journal, amendment/withdrawal, scope and retention/replay contracts |

**186 distinct related checks passed.** The routes/fixture were rerun after the final revision guard and exported decimal/namespace assertions: 9/9 passed. The two remediation suites passed 24/24. Final Kobo date verification passed16/16. The final client production build passed after the focus/layout adjustments, in7.08 seconds. Existing Browserslist/chunk-size warnings are recorded, not turned into unrelated upgrades.

## Measured exchange improvement (E04/E08/E09/E10)

The old broad scan reads every sample's provenance; the candidate selects publication-eligible rows before evaluating the same conservative hold predicate. Other callers retain broad default behavior. No permission/hold cache, timeout increase, index or last-use-write change was introduced.

Read-only SQLite comparison, 20 alternating warm reads: old median 1,530.662 ms, p95 1,609.033 ms; publication-candidate median 118.343 ms, p95 136.619 ms. Seven globally held rows, zero held publication candidates, identical eligible-held intersection. Both EXPLAIN plans scan Sample; deployed copy has no status index. This supports the narrowly scoped query, without an unmeasured index migration.

Authenticated mounted HTTP comparison on an isolated mutable clone of the same 38,566-sample copy, Windows loopback, one sequential client, no concurrent database writers, synthetic restricted machine connection:

| Read | Median | Warm p95 | Maximum |
|---|---:|---:|---:|
| Old broad hold scan | 1,740.149 ms | 1,958.693 ms | 3,223.415 ms |
| Candidate publication scan | 343.732 ms | 357.299 ms | 384.621 ms |

20 alternating reads per mode; the same three eligible specimen IDs across all 41 reads, 41 unique bounded server correlation IDs. Cold candidate: 234.943 ms. Page limit 200: actual three rows, 222.712 ms. Revoked key: HTTP401. Request-count/scope/mapping logic was the actual mounted application, not mocked authentication. A client build overlapped part of the measurement, so the comparison includes that host CPU load; it is not a production/network p95 claim. Private identities, keys and raw payloads are not published. No lock-contention-dominated trace or authorization-cache justification was observed. Deployment-instance correlation and bounded live timing remain postflight work, not falsely marked completed here.

## Browser inspection

Isolated synthetic accounts and guarded fixture database, real Chromium via Playwright CLI, application at loopback 3909 with the actual backend. Reception in English and French; profile input preserves zero and missing collection date remains blank. New fieldset fits 320px viewport: width272/right296. Graphite was verified through the existing reversible full-screen preview (actual root `data-appearance=dark`), rather than trusting a screenshot name. New text/controls are readable; screenshot retained locally at `output/playwright/profile-field-mobile-dark.png`. Light mode also inspected. Desktop width1440 inspected.

Manager sample page shows distinct field/profile identities and permission-gated correction. At 320px the dialog is width288/right304 and scrollable. Shift+Tab remains inside; Escape closes; focus returns to the correction button after the new parent trigger restoration. The project connection's mapping editor renders ten source inputs and a meaning selector at320px, width214/right267, with no alert or runtime error. No mapping save or external fetch was triggered by browser inspection. The synthetic country code produced two existing admin-unit404s on reception; this is recorded as a fixture context limitation, not hidden as a successful location journey. Existing router future warnings remain. Session-header appearance selection was not used as dark evidence; no accepted theme code changed.

All new `profileReference` translation keys exist in en/es/es-419/fr/pt. This is a focused new-component browser check, not physical mobile, human screen-reader or OS contrast qualification.

## Fixture and receiver boundary (J01–J05)

The loader creates five EXPECTED specimens only in a guarded disposable database. Mounted workflow releases all five normally. It verifies two independent bags/accessions share a verified pit, different namespace stays separate, 20.5 cm exports unchanged and explicit unknown remains null. The returned manifest identifies only owned synthetic setup/specimens and database cleanup boundary. See [the operator guide](../../docs/profile-reference-guide.md).

Eloi's real receiver grouping/replay/amendment/withdrawal/expired-checkpoint acceptance remains external and pending on #140; it is not a LIMS merge gate. No production fixture or national ingestion was performed. Live A verification will use read-only designated data; B1/B2 are still required before full #156 completion.

## Release gates still open

Exact candidate review/CI, guarded merge, merged-main CI, pinned backup/cutover and independent live postflight are pending. A has no schema migration; backup preservation and no-old-database-restore-after-writes apply. Release follows [UPGRADING.md](../../docs/UPGRADING.md). B1/B2 and six separate actual theme qualifications are not claimed completed by this record.
