# Review evidence for soil profile and reception work

## Review baseline

Reviewed on 3 October 2026 using read-only GitHub queries and local source inspection. Local HEAD was `878e894472708076228f590e58bd35ba2a8ecbfa`, branch `docs/issue155-final-records`. Actual GitHub main is the later documentation merge `cb86b207def4d58c40eb2ef7caa1f34368cb145d`. PR157 added 172 lines to three documentation files; it did not change product code. Agy must start implementation from current main and recheck any intervening product changes.

Merged-main CI run [37137546597](https://github.com/yigini/soilfer-lims/actions/runs/37137546597) was independently read as completed/success on the exact merged commit. Theme software remains accepted and live; this review does not reopen it. Hardware and human qualifications remain separate.

## GitHub requests

| Source | Actual current request |
|---|---|
| [Marcos issue 156](https://github.com/yigini/soilfer-lims/issues/156) | Configurable conformity checklist and dynamic sample-context fields by project or commercial origin, including defining/editing criteria and simplified/custom external forms. Open; one owner comment at the latest read. |
| [Eloi successful staging import](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5888715148) | Receiver schema and initial scoped import worked. Requests a two-layer pit with profile identity for remaining grouping/crosswalk tests. |
| [Eloi clarification](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5896898640) | API meets requirements; existing sample data still lacks profile codes. |
| [Eloi performance report](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5910614372) | Approximately five seconds with three returned specimens versus occasional fast empty responses under the same key. Exact requests/timestamps not supplied. |
| [Owner issue 140 update, comment 5972150911](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5972150911) | `yigini` explains typed retryable 503, request ID, `Retry-After`, one policy resolution, measured phases and the isolated fixture. Updated in place for authorized delivery without waiting for a reply; link is the receiver notice. |
| [Owner issue 156 update, comment 5972151075](https://github.com/yigini/soilfer-lims/issues/156#issuecomment-5972151075) | `yigini` explains the staged reception configuration delivery. Updated in place to distinguish B1 from full B1+B2 fulfillment and include existing offline intake. |
| [OpenNSIS project](https://github.com/un-fao/OpenNSIS) | The maintained receiver supports soil profiles, layers, observations and ETL. This corroborates the system boundary; it is not proof of this connection's live ingestion. |

Marcos's other authored issues 116, 118, 119 and 120 were closed. Other open repository issues 102 and 103 concern physical device qualification and project-lab reconciliation; they are outside this package and must not be closed by it.

The latest read on 3 October 2026 found nine comments on #140 and one on #156; neither contributor had replied to the two latest owner updates. The owner explicitly authorized proceeding with the changes and safely updating their replies without waiting. That removes response-waiting as a delivery dependency; it does not claim OpenNSIS qualification or product deployment has occurred.

## Source findings

Line numbers refer to the reviewed source and may move during implementation.

| File and location | Observed behavior | Implication |
|---|---|---|
| `server/services/sisAdapterService.js:377` | `site_id`/`plot_id` precede explicit profile/pit aliases. | Capture and resolve explicit identity deliberately; preserve site separately. |
| `server/services/sisAdapterService.js:394` | Namespace is derived at export from country/project; supplied namespace is ignored. | Persist a stable canonical namespace. Do not silently regroup released records. |
| `server/services/sisAdapterService.js:392` and `:415` | Weak scalar/boolean parsing. | Validate types and unwrap consistently. |
| `server/prisma/schema.prisma:95`–`:151` | `Sample` has JSON metadata/fieldMetadata and no dedicated profile-code column. | Missing data is not proof that a profile column migration failed. An additive structured reference is sufficient initially. |
| `server/services/koboService.js:188`–`:251` | Provided field mapping is unused by `transformSubmission`; only site ID is captured for this reference. | Add explicit per-form pit/profile mapping with source paths and conflict handling. |
| `server/controllers/koboController.js:353`, `:1116`, `:1510` | Fingerprint, normal sync and force sync omit explicit profile reference. | Cover all paths and version new fingerprint semantics. |
| `server/controllers/sampleController.js:1864` | Generic metadata editing accepts arbitrary keys on released specimens. | Protect profile identity and aliases from an amendment bypass. |
| `server/services/exchangeStateService.js:256` and `:411` | Field-metadata changes are already journaled. | Reuse existing amendment/change-feed machinery. |
| `server/services/exchangePolicyService.js:25`–`:67` | Hold lookup parses metadata over the whole Sample table. | Inspect scoped eligibility queries on a production-sized copy. |
| `server/services/exchangePolicyService.js:116`–`:132` | Lookup errors become an impossible ID, yielding a successful empty list. | Emit a typed retryable error while continuing to withhold records. |
| `server/controllers/sisV2Controller.js:143`, `:173` | Eligibility policy is built independently for list and count. | Resolve once per request; preserve count/list consistency. |
| `server/controllers/sisController.js:90`–`:92`; `sisV2Controller.js:218`–`:220` | Controller catches return generic 500 instead of forwarding a typed eligibility failure. | Connect the actual routed failure to the shared exchange handler and preserve status/code/request ID/retry hint. |
| `server/app.js:309`–`:312`, `:1017`–`:1027` | Four v1/v2 exchange aliases are mounted; the global error response does not provide the proposed machine code, request ID or retry hint. No request-ID middleware was found in the inspected server. | Add bounded server-generated correlation before authentication on all four aliases. Do not assume an existing correlation mechanism. |
| `server/services/exchangePolicyService.js:279` | Strict OpenNSIS filtering requires a laboratory accession, not a profile code. | Missing profile alone is not the cause of an empty registry in the inspected code. |
| `server/prisma.js:19`, `:46`; `exchangeStateService.js:26` | SQLite busy waits can reach five seconds. | A latency hypothesis to measure, not an established incident cause. |
| `server/prisma.js:18`–`:19` | Initialization explicitly configures `journal_mode = WAL` and a 5000 ms busy timeout. | Verify effective deployed handles; do not claim WAL is absent or that this proves the reported latency cause. |
| `server/middleware/apiKeyAuth.js:101` | API-key last-used telemetry schedules a database write. | Measure lock effects; never cache authorization to optimize this. |
| `server/services/exchangeStateService.js:769` | First exchange DB access initializes exchange schema/triggers. | Measure cold initialization separately. |
| `client/src/components/reception/ComplianceChecklist.jsx:22` | Fixed five-item checklist with walk-in-specific N/A logic. | Use one server-resolved immutable intake revision. |
| `server/controllers/receptionController.js:110`, `:393` | Server hardcodes checklist and uses submitted walk-in flag in evaluation. | Resolve authoritative origin before allowing template/N/A differences. |
| `client/src/pages/Reception.jsx:1187`, `:1193` | Third fixed checklist and fixed commercial context requirements. | Remove divergent client requirement definitions. |
| `server/controllers/receptionController.js:2012` | Batch path does not use single-intake conformity evaluator. | Shared evaluation for each accepted row. |
| `client/src/components/reception/BatchIntake.jsx:42` | Starts with 0–20 cm and checklist PASS defaults. | Replace invented facts/attestations with unknowns and explicit bulk confirmation. |
| `server/controllers/sampleController.js:1370` | Older acceptance path does not evaluate reception conformity. | Route through canonical acceptance or redirect with no bypass. |
| `server/services/projectPolicyService.js:310` | Existing project templates govern admission channels, not dynamic context/checklists. | Preserve admission rules; add distinct intake-form configuration. |
| `server/controllers/projectController.js:583` | Project update allowlist does not include intake binding configuration. | Add dedicated scoped binding operation. |
| `server/controllers/receptionController.js:2364` | Context resolver lacks template binding/version. | Return effective template/revision/source alongside saved answers. |
| `client/src/pages/Reception.jsx:491` | Global local autosave key without revision scope. | Scope draft recovery; migrate legacy drafts without destroying them. |
| `client/src/pages/Reception.jsx:1343` | Network failure queues an existing `RECORD_INTAKE` operation with the full payload. | Offline intake is already a supported path, so it belongs in B1's canonical save operation. |
| `server/services/syncService.js:834`–`:903` | `RECORD_INTAKE` creates a standalone received sample; stored reception data only includes notes/capture time, with the institutional lab value used for `labId`. It ignores draft intent and drops much of the intake payload. | Preserve facts/project/profile/template/revision, draft intent, custody/photos and genuine specimen accession semantics. Reuse idempotent receipts and give recoverable outcomes. |

## Small parsing probes

Read-only, stateless calls to the current adapter reproduced these behaviors; they did not access a database or alter data:

- `{site_id:'SITE-1', profile_id:'PIT-2'}` chooses `SITE-1`.
- An explicit profile namespace is ignored.
- An arbitrary object can become the string `[object Object]`.
- `isComposite:'false'` is treated as composite.
- Wrapped `{value:true}` confirmation is not recognized.
- Numeric zero disappears through truthy fallback.

The parser changes proposed in the plan address these cases. No product test suite was rerun during planning.

## v2 independent spot-check (3 October 2026)

A second read-only review re-inspected the key findings against the local checkout (`878e894`, identical in product code to `origin/main` `cb86b20`). Confirmed:

- `exchangePolicyService.js:116`–`:132`: `buildSampleWhere` calls `getHeldSampleIds()` without a connection; on any error it sets `where.id = '__denied_held_lookup_failure__'`, which returns HTTP200 with an empty list.
- `exchangePolicyService.js:25`–`:72`: `getHeldSampleIds` evaluates JSON over the whole `Sample` table; if `exchangeStateService.getDb()` is unavailable it opens a new `better-sqlite3` connection with a 2-second timeout. Held IDs are applied as a growing `notIn` list.
- `sisV2Controller.js`: `buildSampleWhere` is called independently at lines 143 and 173 (list and count) and at roughly ten call sites overall.
- `sisAdapterService.js:377`–`:432`: `site_id`/`plot_id` precede `profile_id`/`pit_id`; namespace derived from country/project; `Boolean(field.isComposite)` treats the string `"false"` as true.
- `BatchIntake.jsx` row defaults: `depthTopCm: 0`, `depthBottomCm: 20`, all five checklist items `PASS`, `receivedMass: 500`.
- `receptionController.js:111`, `:393`: `isWalkIn` taken from request options and used for checklist evaluation and intake channel.
- Latest migration is `20260930140000_add_sitewide_theme_appearance`; no intake-template schema exists yet.

Issue 156 text (Marcos, 30 September, Spanish) asks for: configurable "Conformidad de Recepción" criteria that the manager can define, edit, activate or deactivate per origin type (commercial, SoilFER, project X); context-field templates per sample type or project (land use, sampling date, depth, composite, custody sheet); and the current set kept as the SoilFER default with simplified/custom options for external samples. B1's predefined switches are a useful increment, but custom criteria/context fields in B2 complete the request. A focused publication/upgrade workflow protects those configurable revisions; it is bounded implementation support, not a new governance subsystem. Existing offline integrity and minimum conflict recovery are mandatory in B1.

The independent follow-up review also identified two ambiguous instructions now resolved in this owner-authorized revision: saved valid intake revisions stay pinned when defaults change, and legacy exported profile identities must stay stable after project/country edits. Canonical profile resolution distinguishes absent, valid, explicit unknown and invalid states. Historical journal/snapshot inventory determines compatibility work; malformed already-exported values need reviewed correction rather than silent replacement. No product implementation or database inventory was performed to validate those proposed changes.

## Limits of this review

No new signed-in live reproduction, production query trace, database audit, hardware test or receiver import was performed. A failed hold lookup is a proven code path, but its correlation with Eloi's exact failures remains unverified. Missing registry indexes are a checked-in schema observation; actual deployed indexes must be inspected before proposing additions. The fixture, UI and performance thresholds are proposed requirements, not claims of completed implementation.

The interactive preview is a local HTML concept. Browser automation rejected the `file:` URL under its protocol security policy; no browser workaround was attempted. Static structure/script checks can establish valid assets but do not establish rendered visual or interactive browser acceptance. Actual product acceptance remains the implementation checklist.

Completed asset checks (v1): all seven expected files exist and are nonempty; all relative document links resolve; the 53 acceptance IDs are unique; static HTML IDs/accessibility references resolve; the preview JavaScript passes Node's syntax check; and the JSON example has two distinct specimen/bag/accession IDs sharing one profile reference. These are local asset-integrity checks only. No application tests or production requests were added for this validation.

Owner-authorized v2 supporting-asset checks: all relative links in the edited supporting Markdown resolve; the preview has 18 unique static IDs and nine valid accessibility references; its script passes Node's syntax check; and the concept remains self-contained with no network calls or external scripts. The five edited supporting files are README, handoff, change record, evidence and preview. These checks do not establish rendered browser acceptance, product behavior, deployment or receiver acceptance.
