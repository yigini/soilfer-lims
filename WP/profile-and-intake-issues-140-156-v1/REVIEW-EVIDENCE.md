# Review evidence for soil profile and reception work

## Review baseline

Reviewed on 3 October 2026 using read-only GitHub queries and local source inspection. Local HEAD was `878e894472708076228f590e58bd35ba2a8ecbfa`, branch `docs/issue155-final-records`. Actual GitHub main is the later documentation merge `cb86b207def4d58c40eb2ef7caa1f34368cb145d`. PR157 added 172 lines to three documentation files; it did not change product code. Agy must start implementation from current main and recheck any intervening product changes.

Merged-main CI run [37137546597](https://github.com/yigini/soilfer-lims/actions/runs/37137546597) was independently read as completed/success on the exact merged commit. Theme software remains accepted and live; this review does not reopen it. Hardware and human qualifications remain separate.

## GitHub requests

| Source | Actual current request |
|---|---|
| [Marcos issue 156](https://github.com/yigini/soilfer-lims/issues/156) | Configurable conformity checklist and sample context by project or commercial origin. Open, with no comments when read. |
| [Eloi successful staging import](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5888715148) | Receiver schema and initial scoped import worked. Requests a two-layer pit with profile identity for remaining grouping/crosswalk tests. |
| [Eloi clarification](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5896898640) | API meets requirements; existing sample data still lacks profile codes. |
| [Eloi performance report](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5910614372) | Approximately five seconds with three returned specimens versus occasional fast empty responses under the same key. Exact requests/timestamps not supplied. |
| [OpenNSIS project](https://github.com/un-fao/OpenNSIS) | The maintained receiver supports soil profiles, layers, observations and ETL. This corroborates the system boundary; it is not proof of this connection's live ingestion. |

Marcos's other authored issues 116, 118, 119 and 120 were closed. Other open repository issues 102 and 103 concern physical device qualification and project-lab reconciliation; they are outside this package and must not be closed by it.

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
| `server/services/exchangePolicyService.js:279` | Strict OpenNSIS filtering requires a laboratory accession, not a profile code. | Missing profile alone is not the cause of an empty registry in the inspected code. |
| `server/prisma.js:19`, `:46`; `exchangeStateService.js:26` | SQLite busy waits can reach five seconds. | A latency hypothesis to measure, not an established incident cause. |
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

## Small parsing probes

Read-only, stateless calls to the current adapter reproduced these behaviors; they did not access a database or alter data:

- `{site_id:'SITE-1', profile_id:'PIT-2'}` chooses `SITE-1`.
- An explicit profile namespace is ignored.
- An arbitrary object can become the string `[object Object]`.
- `isComposite:'false'` is treated as composite.
- Wrapped `{value:true}` confirmation is not recognized.
- Numeric zero disappears through truthy fallback.

The parser changes proposed in the plan address these cases. No product test suite was rerun during planning.

## Limits of this review

No new signed-in live reproduction, production query trace, database audit, hardware test or receiver import was performed. A failed hold lookup is a proven code path, but its correlation with Eloi's exact failures remains unverified. Missing registry indexes are a checked-in schema observation; actual deployed indexes must be inspected before proposing additions. The fixture, UI and performance thresholds are proposed requirements, not claims of completed implementation.

The interactive preview is a local HTML concept. Browser automation rejected the `file:` URL under its protocol security policy; no browser workaround was attempted. Static structure/script checks can establish valid assets but do not establish rendered visual or interactive browser acceptance. Actual product acceptance remains the implementation checklist.

Completed asset checks: all seven expected files exist and are nonempty; all relative document links resolve; the 53 acceptance IDs are unique; static HTML IDs/accessibility references resolve; the preview JavaScript passes Node's syntax check; and the JSON example has two distinct specimen/bag/accession IDs sharing one profile reference. These are local asset-integrity checks only. No application tests or production requests were added for this validation.
