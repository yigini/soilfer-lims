# Issue 140 — Safe LIMS–NSIS implementation plan

Implementation plan · drafted 26 September 2026 · LIMS implementation authorized 27 September 2026

Issue: https://github.com/yigini/soilfer-lims/issues/140

## 1. Outcome and boundary

Deliver a documented, secure, manageable connection through which OpenNSIS, and subsequently other national SIS implementations, can retrieve authorized laboratory data, import it without losing identity or scientific meaning, and recover safely from interruptions and corrections.

LIMS remains the authority for specimens, laboratory identifiers, analyses, quality control, approval and released laboratory results. OpenNSIS remains the authority for its national site/profile/layer model, spatial interpretation, national catalogue and publication. The exchange is a read-only data service plus narrowly separated connection administration and optional delivery receipts. It does not give OpenNSIS laboratory write access.

**Laboratory staff continue their existing work.** No new mandatory profile entry at reception, new approval stage, changed barcode scheme, automatic reassociation, historical result rewrite, or dependency on OpenNSIS availability is introduced. A sample lacking national spatial metadata can still be received, analysed and approved. Its suitability for a particular NSIS import is a separate, visible decision.

Kobo is one possible provenance source. Manual intake, other field systems and existing records must also work. No connector assumes that using LIMS requires Kobo.

On 27 September 2026 the owner explicitly authorized starting this plan in the existing Antigravity LIMS Dev task and announcing implementation on issue 140. Proceed through the LIMS work packages as one continuous assignment, resolving routine choices from source evidence and the safe defaults below. Record genuine cross-system/data-owner decisions without inventing semantics, and continue independent work while those decisions remain open. The established independent review and safe release process remains in force. This instruction does not authorize new grants, national production ingestion, changes in the OpenNSIS repository without its owner's assignment, or monitoring resumption. Existing monitoring remains paused.

## 2. What “seamless and connected” must mean

An unconditional promise that any two evolving systems will always connect perfectly is not testable. Replace it with an explicit supported contract and demonstrated outcomes:

- A named national connection has a supported LIMS contract version, receiver version, responsible owners and approved scope.
- Every eligible record is imported once logically, even when HTTP deliveries are retried. Every exclusion or rejection has a visible reason.
- Specimens, profiles, layers and observations retain their distinct identities. A replay does not duplicate them or overwrite another dataset.
- Updates and withdrawals reach the receiver; an outage, expired credential or failed page does not silently lose records.
- Operators can understand current status, resolve errors and rotate credentials without asking a developer to inspect a database.
- Documentation, machine schemas and real responses agree. A working reference client and receiver integration test prove the documented path.

Use distinct status terms: **Configured**, **Authentication verified**, **Data fetched**, **Import verified**, **Current**, **Delayed**, **Attention needed**, **Paused**, **Revoked**. Successful LIMS HTTP requests or a key's last-used time alone never mean “import verified.”

## 3. Evidence reviewed and limitations

Read-only source review used LIMS commit `27d7d861eb7553c891282421c3b304272d169d04` and OpenNSIS commit `a13a290d2cfb88db2d12af0efa937fd10a861549`. These are source observations, not a new production security audit or completed integration test. Re-pin both implementations at the start of implementation. Existing unrelated working-tree changes remain untouched.

| Observation | Consequence for this plan |
|---|---|
| LIMS mounts the same router at `/api/v1/data-exchange` and `/api/v1/sis`. | Keep the neutral route primary and preserve the legacy alias. |
| The current formatter exposes no profile identifier. Kobo stores `site_id` for depth samples, both in metadata and wrapped field metadata. | Verify source semantics; expose an explicit source identifier without inferring pits from coordinates or barcodes. |
| Field metadata can contain `{value, source, ...}` objects; the SIS formatter often treats fields as scalars. | Build one tested provenance adapter for wrapped and legacy values. |
| `Sample.id` is an internal identifier; `originalId` is the field identifier; `Sample.labId` is the laboratory specimen accession; `assignedLab` identifies the institution. Existing docs confuse these meanings. | Publish separate, unambiguous identifiers and preserve legacy aliases. |
| The current formatter may substitute reception date for collection date, defaults missing depths to 0/20, and uses truthiness for coordinates. Separate `depthTopCm`/`depthBottomCm` columns also exist. | Define field precedence, missingness and provenance. Preserve zero coordinates and decimal depths; do not invent measurements. |
| Analytical results are keyed by parameter, so multiple current determinations can overwrite one another in that representation. `/results` is a flattened matrix and omits much of the richer result metadata. | Introduce lossless observation records; do not advertise the legacy matrix as a complete scientific interchange. |
| `/sync` takes up to 1,000 samples and 1,000 spectra, has no continuation cursor, and returns the current time. Samples use `updatedAt`; spectra use acquisition timestamp. | A receiver advancing to that returned time could miss capped or independently changed records. Design a complete resumable feed. |
| Samples and spectral/statistics branches use different eligibility/scope logic; statistics overrides a status for one count. | Verify every endpoint and count against one external publication policy. These are source review concerns requiring focused reproduction, not claims of proven unauthorized access. |
| Existing docs show different response envelopes, identifiers and sync parameters from the implementation. The small NSIS contract test checks authentication/200 responses, not full semantics. | Replace illustrative claims with executable contract documentation and meaningful conformance tests. |
| OpenNSIS migration 023 adds field and lab specimen IDs; migration 024 makes lab ID compulsory for `lims-api` datasets. | Enforce this receiver-specific requirement at the exchange boundary, without changing laboratory approval. |
| OpenNSIS migration 006 explicitly treats profile codes as labels, not globally unique identifiers. | Carry a namespace and stable identity; never join projects using the bare code. |
| The reviewed OpenNSIS ETL converts depths with `int(float(...))`, caches specimens per element, checks contiguous layers and exact coordinate agreement within a profile code. | Receiver work is necessary for decimal depths, repeat specimens, partial profiles and GPS variation. Adding `profileCode` alone does not prove safe integration. |

No live private dataset was fetched for this plan. Future representative data review must stay private and bounded; public examples and test fixtures must be synthetic.

## 4. Responsibility split

| Responsibility | LIMS | OpenNSIS / national operator |
|---|---|---|
| Reception, accession numbers, analyses, QC, approval | Own existing process | Consume released facts only |
| Scientific values, methods, units, result revisions | Publish faithfully with provenance | Map to national concepts; retain original values and mappings |
| Source point/profile reference | Expose verified stored reference, namespace and quality | Construct national site/profile/layer entities and maintain crosswalks |
| Coordinates and depth intervals | Expose recorded values, uncertainty, source and missingness | Validate national suitability, resolve spatial discrepancies, apply documented transformations |
| Composite samples, repeat visits, replicate bags | Preserve their available source descriptions and separate specimen IDs | Decide appropriate national representation; quarantine unsupported cases |
| Access authorization | Enforce explicit approved institution/project/country/dataset permissions | Protect received data and enforce national downstream permissions |
| Scheduling and retries | Serve bounded resumable reads | Pull, stage, validate, upsert, checkpoint and retry |
| Delivery status | Record fetch evidence; show authenticated receipt evidence separately | Produce import receipts and error summaries |
| Published maps, interpolation, profile interpretation | No automatic scientific inference | Own national publication and spatial products |
| Support | Own API contract and service faults | Own ingestion, mappings and national data decisions |

There is no shared-database integration, direct OpenNSIS write to LIMS, browser-stored machine key, or LIMS copy of the national profile database.

## 5. Contract and compatibility strategy

### 5.1 Two bounded delivery milestones

**Milestone A: resolve the immediate issue-140 payload gap.** Verify profile semantics, expose the verified source profile reference consistently, repair scalar metadata serialization, document identifiers and dates accurately, and demonstrate a bounded OpenNSIS staging import. Additive v1 fields may be used where they do not change existing field meaning or type. The old flat matrix remains a compatibility view.

**Milestone B: support the durable managed connection.** Deliver a versioned lossless representation, cursor feed, correction/withdrawal handling, operator status, security conformance and complete documentation. A bounded successful import is not evidence that continuous synchronization is finished. Track milestone B under explicit linked work packages; do not silently close all connectivity promises when only milestone A passes.

### 5.2 Versioning proposal

Prefer an explicit `/api/v2/data-exchange` for changed envelopes, identifier semantics, observation arrays, truthful missing-value rules and new synchronization behavior. Keep v1 routes and `/api/v1/sis` available during a documented migration period. Do not silently repurpose `id`, `sampleId`, `labId`, `collectionDate`, `/results` or `/sync`.

Security defects are fixed in all affected versions; backward compatibility is not a reason to retain unauthorized disclosure. Release notes must explain tightened access behavior and affected consumers. Inventory actual consumers before deprecation; no automatic retirement date is assumed in this draft.

Use a capabilities response to advertise implemented contract/schema version, endpoint limits, supported matrices, filter support, cursor retention and optional spectra/receipt capabilities. Unsupported features must be absent or explicitly false, never optimistic placeholders.

The following is a **proposed design inventory**, not a list of deployed endpoints. Final route names and schemas are agreed in P0/P3 and published together:

| Proposed v2 operation | Purpose and contract boundary |
|---|---|
| `GET /capabilities` | Supported schema, datasets, query limits and recovery capabilities; no unrelated institutional inventory. |
| `GET /samples` and `/samples/{specimenId}` | Authorized publication projection and stable specimen identity; bounded pagination and explicit quality/eligibility. |
| `GET /observations` | Lossless result records with stable identities, revisions, method, unit, basis and censoring; preferred over the v1 parameter matrix. |
| `GET /geojson` | A spatial view of the same publication projection with the same identities and restrictions. |
| `POST /snapshots` and `GET /snapshots/{snapshotId}/pages` | Create/read a bounded, expiring export artifact and its stable high-water boundary. This is an exchange artifact operation, never a sample or result mutation. Apply per-connection creation limits. |
| `GET /changes?cursor=...` | Durable ordered publication revisions and withdrawal events after a snapshot; no mutable live-row substitute. |
| `GET /stats` | Authorized publication/eligibility counts with declared snapshot/time context and no global leakage. |
| `GET /spectra` and optional export | Preserve the separately documented spectral contract, gated by release linkage and explicit dataset authorization. Not a prerequisite for the first chemistry import. |
| Optional `POST /receipts` | Bounded acknowledgement for this connection's issued batches; cannot alter laboratory records. |

Administrative connection/key operations remain separately authenticated and permission-checked. A sample-reader credential must not automatically gain key management, receipt submission or unrestricted snapshot creation. The phrase “read-only exchange” refers to laboratory data; artifact creation and receipts have their own narrow capabilities and audit trail.

Every v2 page needs an explicit envelope with `schemaVersion`, `sourceSystemId`, publication/snapshot boundary, `count`, `hasMore`, `nextCursor` and items. A missing continuation field must not be interpreted as proof of completeness. Cursors are opaque; clients must not construct or decode them to decide ordering. Specify both syntactic schema constraints and semantic invariants—for example, profile identity consistency cannot be validated by JSON types alone.

### 5.3 Proposed identity and data dictionary

| Field / concept | Rule |
|---|---|
| `sourceSystemId` | Stable identifier for the LIMS installation, independent of hostname, migration or key rotation. Restore/move procedures must preserve it; cloned staging systems must use a distinct identity. |
| `specimenId` | Stable internal specimen identity, based on `Sample.id`; not a barcode or profile label. Receiver upsert key is `(sourceSystemId, specimenId)`. |
| `fieldSampleId` | Canonical field identifier from `originalId`. Document the historical v1 `sampleId` fallback behavior rather than claiming it has always been a field ID. |
| `labSampleId` | Actual laboratory accession from `Sample.labId`. Never substitute `assignedLab`, an internal UUID or a manufactured accession. |
| `laboratoryId` | Laboratory institution identity, resolved through authoritative assignment/ownership. Kept distinct from the accession number. |
| `profileCode` | Original verified field profile/point label, or null. No prefix stripping, GPS clustering, guessed code or use of specimen ID as a fake profile. |
| `profileNamespace` / `profileKey` | A documented field-programme identity plus code and, where required by source semantics, sampling event. Deterministic namespacing may create an exchange key for an already evidenced relationship; it must not create a new physical relationship. |
| `profileRelation` | Confirmed profile, confirmed sampling point, composite, unknown or ambiguous. A point label is not automatically a described soil pit. |
| `collectionDate` | Valid recorded field date as `YYYY-MM-DD`, otherwise null in v2. Separate recorded timestamp, precision and source when available. No implicit timezone-day shift. |
| `receptionDate` | Separate actual laboratory receipt date. The receiver may use an explicitly labelled fallback if its policy allows; never relabel receipt as field collection. |
| `depth.topCm`, `depth.bottomCm` | Finite numeric centimetres, including decimals and zero; missing stays null. D1/D2 require an authoritative form-specific interval definition. No universal 0–20 default. |
| `coordinates` | Finite longitude/latitude within valid ranges, source, uncertainty and capture context where stored. Preserve zero. Invalid or conflicting values carry a quality reason, not fabricated geometry. |
| `elevation` | Optional recorded value with unit and datum/reference where known. Do not infer from map services or silently emit uncertain altitude as a third coordinate. |
| `observations[]` | Separate stable result identities and revisions; preserve parameter, method/procedure, unit, basis, censoring, validity, provenance, dates and replicate identity. |
| `revision` / `release` | Version of the externally published record and explicit publication state; not simply the current workflow label or an arbitrary wall-clock time. |
| `qualityIssues[]` | Machine-readable missing/ambiguous/unsupported reasons; no secret, raw survey, personal contact or internal traceback content. |

Profile namespaces must not be defined by a receiving laboratory if the same field programme can send bags to several laboratories. Likewise, a form ID alone is not sufficient proof of physical identity across form revisions or repeat surveys. Preserve source form/server references privately as provenance, and agree a stable public-safe programme namespace. Changes to that mapping must be versioned and audited; they must not silently merge national profiles.

### 5.4 Immutable identity and legitimate correction

Audit every path capable of altering `originalId`, `labId`, source profile relationships or externally visible result revisions, including imports, metadata edits, resync and amendments. Do not promise immutability based on one controller.

Freeze the chain-of-custody identifiers in the first approved exchange publication. Routine edits cannot silently change published identity. If a legitimate governed correction changes an external identifier or relationship, publish an explicit supersession/correction with old and new references and a stable specimen ID; preserve the original release. Do not rewrite historical records or prohibit normal scientific amendments merely to satisfy an integration shortcut.

Records missing an actual lab accession cannot enter the strict `opennsis` import profile. Report them as exchange exceptions to the authorized operator. They remain valid LIMS records and their laboratory workflow continues. The normative guarantee must be precise: **every specimen emitted as eligible for that profile has a genuine lab accession**. Do not falsely guarantee that all historical approved records already have one.

### 5.5 One provenance adapter and one publication policy

Create a pure exchange adapter shared by samples, detail, observations, GeoJSON and synchronization. It reads approved typed values, unwraps recognized field metadata, supports documented legacy scalars, and never mutates the source.

Agree precedence per field using the existing provenance authority rules. For example, `depthTopCm` versus `depthTop` must be resolved deliberately; contradictory values yield an exception rather than arbitrary fallback. Explicit null or an unresolved provenance hold must not be overridden by a stale secondary copy. Preserve the chosen source and any relevant quality reason.

The publication policy must follow the existing authoritative release evidence, including approved history after archiving/disposal, withdrawal, reopening and amendment. It must not equate every `COMPLETED` or spectral `VALIDATED` record with external release. Unapproved subsequent metadata/result edits must not leak into an already published snapshot. Decide how an existing governed metadata correction becomes a revised publication; do not invent a second laboratory approval workflow.

Use versioned exchange snapshots/projections of authorized released data. Admission to an NSIS import profile is separate from laboratory approval and from general API access. A missing field may make a record ineligible for a national import without suppressing a laboratory report or changing its status.

## 6. Spatial exposure without spatial invention

Return recorded WGS84 point geometry as `[longitude, latitude]`, using GeoJSON rules from [RFC 7946](https://www.rfc-editor.org/rfc/rfc7946). The new representation must avoid the obsolete GeoJSON `crs` member. A valid zero coordinate is retained. Geometry is null when missing, invalid, ambiguous or unavailable under the connection's spatial permission; expose a reason to authorized consumers.

Represent specimen observations at a sampling location, not invented pit boundaries, plot polygons or soil maps. Preserve positional uncertainty and composite radius as attributes if recorded. A point for a composite sample is not proof of the sampled area's footprint.

Validate bbox syntax, coordinate order, numeric ranges and antimeridian behavior. Apply geographic filtering before pagination, within the same authorized dataset. GeoJSON must have stable feature IDs, continuation links and explicit counts; do not silently cap a country dataset. A bbox-filtered query excludes null geometry, while an unfiltered collection can carry it with a reason. The full nonspatial record remains available when authorized.

Country polygon validation, choice of a representative profile coordinate, reconciliation of GPS jitter, layer continuity, spatial aggregation and publication belong to OpenNSIS. Record its transformations and retain the original LIMS values. Never move coordinates to satisfy a boundary check or pretend discontinuous sampled intervals are a complete profile.

Precise spatial data are not automatically public because they are available through an API. Connection authorization must explicitly cover spatial detail and permitted downstream use. Public/coarsened datasets, if wanted later, are separately governed products; no rounding or publication policy is invented here.

## 7. Reliable initial import and continuous synchronization

### 7.1 Target mechanism

Use an append-only exchange change journal with immutable publication revisions and a monotonic sequence. Capture publication, result correction, withdrawal and relevant eligibility changes durably through existing transactions/outbox integration. The exact journal schema and capture points require a reviewed design against every relevant write path. A timer that scans only `Sample.updatedAt` is insufficient.

Laboratory actions must not depend on the remote receiver being online. Local durable event capture may participate in the existing database transaction; remote transmission never does. Capture failure must be visible and recoverable, with no silent declaration that the exchange is current. A reconciliation job checks capture completeness and alerts; it is not a substitute for reliable event capture.

Initial synchronization produces an immutable authorized manifest/snapshot at a sequence boundary, followed by changes after that boundary. Pages must use a stable snapshot or stored publication revisions; querying changing current rows below a watermark is not snapshot isolation. Expiring staging artifacts contain only the permitted projection, live outside public build contexts, and follow an approved retention policy.

Each response includes schema version, snapshot/high-water identifier, next opaque cursor, `hasMore`, item count and reconciliation metadata. A cursor is bound to connection identity, authorization version, filters and schema; key rotation within the same unchanged connection can preserve progress. A changed scope invalidates incompatible cursors. Use deterministic sequence/tie handling; never checkpoint to the request's finish time.

### 7.2 Receiver guarantees

OpenNSIS stages a page, validates it, applies idempotent changes using stable source identities, and persists its checkpoint in the same receiver transaction. Network retries are at-least-once delivery with exactly-once logical effects, not a claim of distributed exactly-once transport.

Store failed records durably with reasons. Do not mark a page fully imported if a record has merely been skipped. A checkpoint may advance past a rejected item only if the rejection is durably accounted for, visible and independently replayable. Retrying a poison record must not endlessly block all other laboratories.

Handle 429/`Retry-After`, bounded exponential backoff with jitter for transient failures, timeouts and connection resets. Authentication failures pause the connection and alert its operator; they do not trigger endless rapid retries. Page limits, response-size limits and retry budgets are documented.

### 7.3 Withdrawals, scope changes and recovery

Emit explicit withdrawal/supersession events for previously published records where appropriate; disappearance from a list is not enough. Preserve receiver audit history while removing withdrawn data from active national views under its policy.

Scope revocation needs special treatment: never expose a newly unauthorized record just to describe its withdrawal. Invalidate the connection checkpoint/authorization version and require receiver reconciliation of its previously imported source identities. Full key revocation stops fetching and pauses receiver publication as configured; owner-to-owner withdrawal/deletion obligations remain governed. An API cannot remotely erase already downloaded data, so document the national operator's responsibilities.

Expired cursors return a specific recovery response (proposed `410 CURSOR_EXPIRED`) with a new snapshot procedure. Version/source mismatches must not look like an empty successful page. After database restore or exchange rollback, use an epoch/version safeguard so old cursors cannot silently skip reused sequence numbers. Reconcile all already delivered revisions; do not reset counters and claim continuity.

## 8. OpenNSIS implementation work package

The OpenNSIS owner implements and tests these changes in its own repository. No assumed authorization to modify or deploy that system is granted by this LIMS plan.

1. Server-side connector with approved HTTPS base URL, secure credential storage, connection identity and selected national target dataset/project. Prevent arbitrary URL fetching, redirect-based credential disclosure and unintended internal-network requests.
2. Persist `sourceSystemId`, specimen/result identities, publication revisions and profile namespace crosswalks. Keep field and lab IDs as chain-of-custody attributes, not the sole upsert key.
3. Import into staging marked `lims-api`, preserving the existing mandatory lab-ID validation. Keep a clear mapping preview and reject report before national publication.
4. Scope profile resolution by the agreed source namespace and national dataset. Review both database lookups and in-memory caches; bare profile-code reuse must not cross sites/projects.
5. Preserve distinct specimens within the same profile/depth interval. Replace assumptions that one element implies one bag. Test replicates, repeat visits and split specimens; do not collapse their observations.
6. Preserve decimal depths, or quarantine unsupported precision until a documented receiver schema change is made. Silent `int(float(...))` truncation is not acceptable. Do not make LIMS alter recorded depths to fit the receiver.
7. Treat GPS disagreements and noncontiguous depth intervals as explicit receiver quality decisions. Sampling a few intervals does not guarantee a complete pedological profile. No automatic coordinate averaging or gap filling.
8. Preserve raw/normalized result values, unit and method mapping, censoring and provenance. Unsupported categorical or censored observations are explicitly accounted for, never converted into zero or an uncensored numeric result. Store them when supported or report a counted exclusion.
9. Idempotent import/replay, amendment and withdrawal processing with durable checkpoints and transaction boundaries.
10. Operator screen showing fetched, imported, quarantined and withdrawn counts, last successful checkpoint, lag, mapping version and next action. Supply an import receipt or signed-off reconciliation artifact to LIMS operators.

A staging proof must use the actual receiver import path, not a mock that merely parses JSON. Start with synthetic data; use an authorized, minimized real cohort only when needed to confirm source mappings.

## 9. Security and privacy implementation package

- Maintain HTTPS and existing secure principal validation. Do not broaden CORS to make machine-to-machine integration work; the connector belongs on the receiver server.
- One connection/key per consuming institution and environment. Explicit finite laboratory, project, country and dataset scope for new national connections; wildcard grants require a separate owner decision. No inherited widening from empty lists or ambiguous `labId` semantics.
- Apply the same authorized publication projection to list, detail, results, maps, spectra, delta, stats and diagnostics. Counts, lookup errors and excluded-record reports must not disclose other laboratories' data. Audit actual result ownership and attachment relationships, not only a top-level query.
- Verify API-key roles against an allowlist and dataset capabilities. An arbitrary role string must not imply broader access. Malformed scope JSON fails closed with a safe error and audit evidence.
- Preserve hashed-at-rest API keys, one-time display, expiry and revocation. Provide deliberate rotation with a bounded overlap, distinct production/staging keys, and verification of the replacement before retiring the old key. No credentials in URLs, public examples, screenshots, source, analytics or browser local storage.
- Explicitly authorize precise coordinates and optional spectral datasets. Default scientific projection excludes collector names, client details, signatures, personal contacts, free-text internal notes, raw Kobo payloads and attachment URLs. File download access, if needed later, is a separately authorized endpoint and is outside the first chemistry/profile milestone.
- Add per-connection rate/concurrency/response limits alongside infrastructure limits. Ensure several authorized connectors sharing an IP do not accidentally exhaust one another's intended budget. Validate filters and request bounds.
- Record sanitized request ID, connection, contract version, status, duration, returned counts, checkpoint and administrative actions. Never log full secrets or source payloads. Define retention and operator access before collecting new telemetry.
- If optional receipts are added, use a separate receipt capability and bounded schema. A receiver can acknowledge its own import, not change results, laboratory status or eligibility. Label the evidence “receiver reported”; validate it against issued batches and prevent replay/cross-connection submissions.
- Review spatial/country authorization and receiver retention/publication terms with the relevant data owner before activating a real connection. This plan does not grant new access.

## 10. API and operator documentation deliverables

Maintain a machine-readable [OpenAPI 3.1 contract](https://spec.openapis.org/oas/v3.1.1.html), generated readable reference, and a short operator guide. Pin a supported specification/toolchain version; do not claim a schema exists before it is delivered. Validate examples against actual HTTP responses in CI using synthetic fixtures.

The documentation package must include:

| Deliverable | Required contents |
|---|---|
| Quick start | Staging URL placeholders, obtaining an approved scope, secret storage, first authorized request, validation and first receiver import. |
| Endpoint reference | Every available samples/detail/observations/results/GeoJSON/sync/stats/spectra/capabilities route; both v1 aliases; field/filter differences and feature support. |
| Schema/data dictionary | Types, nullability, required fields, units, enum meanings, provenance, matrix applicability, identities, namespace rules and examples. |
| Publication contract | Exact eligibility, strict OpenNSIS import profile, missing lab IDs, holds, archived approved records, amendments and withdrawals. |
| Sync guide | Snapshot, cursors, atomic checkpoint, replay, rejection handling, scope changes, expiry, restore epoch and full reconciliation. |
| Errors | Stable codes and examples for malformed filters/cursors, unauthorized/out-of-scope, unsupported versions, throttling, expiry and transient server failure; request IDs. |
| Security guide | Key issue/rotation/revocation, scope review, transport, data minimization, secret redaction and permitted downstream use. |
| Consumer examples | Tested curl and one small reference client with environment-variable secrets, pagination, retries, checkpoint and import-receipt examples. No real keys or private fixtures. |
| OpenNSIS mapping guide | Source-to-target mapping, ownership split, namespace crosswalk, unit/method mapping and explicit unsupported cases. |
| Operator runbook | Onboard, preview, activate, pause, resume, investigate lag, resolve rejected records, rotate, revoke and recover. |
| Version/change policy | Compatibility guarantees, supported versions, release notes, migration instructions, consumer inventory and agreed deprecation process. |
| Evidence/limitations | Which receiver/version/connection has passed end-to-end acceptance; known exclusions and pending national decisions. |

Existing `docs/nsis-exchange-v1.md`, spectral documentation, in-app API examples and the API playground must be reconciled with the real contracts. Clearly distinguish a laboratory institution filter from the specimen accession in payloads. Public documentation uses placeholders and synthetic records only. A public reference page must not expose a live secret-bearing “try it” session.

## 11. Manageability and operator experience

Extend the existing integration administration surface, rather than adding new steps to a laboratory workbench. Show connection owner, national receiver, approved scope, key expiry, contract compatibility, fetch health, receiver import health, lag and exception counts.

Connection workflow: **select approved scope → test authentication → preview eligibility/mapping → run staging import → review reconciliation → activate schedule**. Scope selection displays existing grants; it does not silently grant more. Pause stops the connector schedule without changing LIMS laboratory work; revoke disables its credential.

Show separate “last fetched” and “last confirmed imported.” If the receiver does not implement receipts, show “import status not reported” and use its reconciliation report for acceptance. Do not simulate a green connection badge. Receipts can be a later capability; reliable receiver evidence cannot.

Define named LIMS and OpenNSIS support owners, a common request/batch ID and escalation path. Proposed pilot operating targets, to be agreed before activation: a 15-minute polling interval, warning after two missed successful cycles, and seven-day offline catch-up capability through retained changes or a documented fresh snapshot. These are draft targets, not existing service guarantees; size retention and load from measured volume. Alert on failures or required action, not every successful poll.

## 12. Implementation sequence and reviewable packages

| Package | Owner | Concrete deliverable / exit evidence |
|---|---|---|
| P0 — Contract discovery | LIMS reviewer + field/NSIS owners | Pinned sources; private bounded field inventory; all profile/date/depth/identifier decisions recorded; consumer inventory and endpoint threat model. No production changes. |
| P1 — Publication adapter and compatibility | LIMS implementer | One pure metadata adapter, source namespaces, explicit identifiers, additive v1 fields where safe, contract fixtures and documentation corrections. Existing workflows unchanged. |
| P2 — Shared access/publication policy | LIMS implementer + independent reviewer | Endpoint-by-endpoint eligibility and scope checks including stats/spectra/detail; focused negative HTTP tests; no unauthorized payload/count leakage. Reproduce suspected defects before fixing. |
| P3 — Lossless v2 representation | LIMS implementer | Versioned schemas, observation arrays, coordinates/depth/date quality, capabilities and paginated projections; legacy consumer regression evidence. |
| P4 — Durable exchange state | LIMS implementer | Reviewed journal/projection schema, capture-point inventory, snapshot/cursor mechanism, withdrawal/correction events, restore strategy, bounded migration and capacity evidence. |
| P5 — Receiver connector | OpenNSIS owner | Actual staging import, namespace and specimen crosswalks, decimal/censoring policy, idempotent replay/checkpoint, counted exception handling and withdrawal processing. |
| P6 — Operator tools and docs | Both owners | Tested quick start, OpenAPI/reference client, connection status and runbook; an operator completes onboarding/recovery without database access. |
| P7 — Joint pilot and rollout | Both owners + data owner | Reconciled authorized pilot, interrupted/replayed sync, key rotation/revocation proof, scoped production activation and named handover. |

P0 precedes semantic commitments. P1/P2 can be separate focused changes. P3/P4 require a reviewed contract before P5 targets them; OpenNSIS can prepare its mapping design earlier. Milestone A ends only with its bounded receiver proof; milestone B includes P4–P7 continuous-operation acceptance. Use small PRs with exact-head CI and independent review. No bulk refactor of unrelated workflow controllers.

Proposed LIMS file areas: `server/controllers/sisController.js`, `server/routes/sisRoutes.js`, `server/middleware/apiKeyAuth.js`, a dedicated exchange service/adapter module, focused exchange tests, versioned schema/docs and `client/src/components/admin/ApiKeyManager.jsx`. Journal/projection schema changes need their own migration review. Existing laboratory actions are touched only where durable publication capture or a proven invariant requires it, with focused regression coverage.

No production deployment or national key is created during planning. Agy remains the LIMS implementer/deployer; Codex reviews independently. OpenNSIS changes need a separately assigned receiver owner. Do not dispatch duplicate tasks from monitoring.

## 13. Acceptance matrix

| Scenario | Required result |
|---|---|
| Two depths at one verified source point | Shared namespaced profile reference; two layers and distinct specimen IDs in receiver. |
| Same profile label in two programmes | Separate national identities; no cross-project overwrite. |
| Several specimens at one depth / repeat sampling | Separate specimens and observation identities; no element-based collapse. |
| Missing/ambiguous source profile | Null/reason and explicit receiver quarantine; no guessed relationship or blocked laboratory work. |
| Wrapped/legacy metadata, nulls, zeros | Correct scalar values and source; no object-valued date, NaN/null geometry from wrapping, or loss of zero coordinate. |
| Conflicting depth fields, missing interval, decimal depth | Deterministic quality handling; no default invented interval or silent truncation. |
| Field date versus receipt date | Correct date and source; explicit optional receiver fallback; no history mutation. |
| Released record without actual lab accession | Excluded from strict OpenNSIS profile with scoped reason; no substituted institution ID. |
| Several methods/replicates for one parameter | No lost observations; stable IDs, units, basis, censoring and provenance retained. |
| Unreleased sample/result or unapproved amendment | Not exposed as released; prior release/withdrawal semantics match approved policy. |
| Cross-country/project/lab request, empty/malformed scope | Denied consistently, including detail, stats, GeoJSON, spectra and sync. |
| More than 1,000 records and identical timestamps | Every eligible record accounted for across pages; no silent cap or skipped tie. |
| Concurrent changes during initial snapshot | Stable baseline plus complete subsequent changes; no duplicates or missing revisions. |
| Result-only change, metadata correction, retraction | Correct new revision/event; no dependency on an unrelated sample timestamp update. |
| Crash before/after receiver commit; replay page | Same final national dataset, no duplicate specimen/result, durable rejection accounting. |
| Expired cursor, restored LIMS DB, changed scope | Explicit recovery/reconciliation; no empty-success data loss or old epoch reuse. |
| Expired/revoked key, rotation, throttling/outage | Safe pause/retry/recovery, bounded load and meaningful operator action. |
| GeoJSON bbox/zero/missing geometry | Correct authorized features, coordinate order and complete pagination; no false coverage claim. |
| Documentation/reference client | All published examples schema-valid and exercised against the implementation. |
| Laboratory regression | Existing receive/accept/analyse/approve/amend/report/label behavior preserved; receiver outage never requires laboratory work to stop. |

Run tests in disposable isolated databases and staging instances. Use private minimized cohorts only with the necessary authorization; never upload raw field surveys or production secrets as fixtures. No synthetic production reception or release mutations. Reuse prior passing unrelated evidence; new tests target changed contracts and the risks above.

Reconciliation must report: eligible source specimens and observations; delivered distinct revisions; imported/upserted national identities; quarantined records and reasons; withdrawals; unexpected differences. Counts alone are insufficient—compare stable IDs and a canonical permitted-field digest for the agreed pilot. Receiver skipped censored results must appear in the reconciliation rather than disappearing.

## 14. Rollout and recovery

1. Deploy additive/isolated changes to staging with exact source/image identity. Rehearse any migration on a consistent disposable copy; verify backup/restore and journal epoch handling.
2. Have OpenNSIS prove initial import, retry, correction and withdrawal using the real connector. Complete negative authorization tests before any external real-data access.
3. Review a bounded authorized pilot and its reconciliation with both owners. Start with one national connection and minimal scope; success for one does not certify every country.
4. Deploy LIMS via the established reviewed release process. Preserve v1, current laboratory records, mappings, approvals, keys and concurrent work. Publish measured change notes.
5. Activate only the approved receiver schedule and scope. Observe lag, exceptions, scoped access and receiver acknowledgements over an agreed pilot window, including at least one recovery exercise in staging.
6. If a connector fails, pause its import schedule and preserve checkpoint/evidence. If new exchange code fails, disable the new capability or roll back the compatible app release; do not rewind laboratory data to repair a consumer.
7. If wrong data were already imported, use receiver quarantine and explicit supersession/withdrawal reconciliation. Do not hide the event with destructive bulk deletion. Preserve private audit evidence and notify the responsible owners.

Any rollback involving database state requires a separate reviewed migration/restore procedure; an app image rollback alone is not proof that journal cursors and already delivered data remain consistent.

## 15. Decisions required before implementation

| Decision | Proposed safe default | Who confirms |
|---|---|---|
| Meaning of each source `site_id` | Expose as a source point reference until evidence establishes profile semantics. Review repeated visits and composites. | Field data owner + OpenNSIS owner |
| Namespace and repeat-event model | Stable programme namespace; distinguish sampling event where required; no lab-based or GPS-based grouping. | Both data-model owners |
| Missing dates/depths/profile/accession | Preserve null/reason; receiver quarantine or documented fallback; no invented laboratory data. | Both owners |
| Identifier correction after publication | Stable specimen identity and immutable release history, explicit governed supersession. | LIMS governance + OpenNSIS owner |
| Release/withdrawal behavior | Existing authoritative release evidence and audited amendments, including archived history; explicit receiver withdrawal. | LIMS release owner |
| Contract migration | Additive v1 unblock, explicit v2 for changed meanings and durable feed; inventory existing consumers. | API and consumer owners |
| National mapping/precision policy | Preserve decimals and source coordinates; national reconciliation on receiver side. | OpenNSIS scientific/data owner |
| Spatial access and publication | Minimum expressly authorized detail and scope, no implied public publication. | Relevant data owner |
| Receiver connection and service target | Named staging/production owners, actual deployed receiver version, measured interval/retention/SLO and support contacts. | Operations owners |

These decisions can be settled in a short joint contract review and recorded once; they are not repeated approval gates for each routine implementation step. Work that does not depend on an unresolved decision may proceed when implementation is authorized, but no guessed field semantics may reach production.

## 16. Definition of done and reporting

**Issue 140 payload acceptance:** documented profile source/namespace, consistent exposure, canonical identifier semantics and released-export accession guarantee, truthful dates, compatibility tests, and an actual OpenNSIS staging import agreed by its owner. If it closes at milestone A, link named remaining synchronization/management work explicitly.

**LIMS–NSIS connection acceptance:** complete versioned contract and docs; scoped secure endpoints; lossless identity/value transfer; full snapshot and incremental recovery; receiver correction/withdrawal and rejection handling; usable operator tools; reconciliation evidence; supported deployed version pair; operating owners and runbook. No “fully connected” claim from LIMS-only tests, credentials issued, sample counts, or successful GETs.

No universal scientific equivalence or formal standards certification is asserted by endpoint labels. Coverage is reported by supported dataset, receiver version and tested scenario. A national operator must be able to see and resolve incomplete data without asking laboratory staff to change how they do their work.

## References

- [LIMS issue 140](https://github.com/yigini/soilfer-lims/issues/140).
- LIMS reviewed files: `server/controllers/sisController.js`, `server/middleware/apiKeyAuth.js`, `server/routes/sisRoutes.js`, `server/app.js`, `server/prisma/schema.prisma`, `server/services/koboService.js`, `server/controllers/koboController.js`, `server/controllers/sampleController.js`, `docs/nsis-exchange-v1.md`, `server/tests/contracts/nsis_exchange.test.js`, and `client/src/components/admin/ApiKeyManager.jsx`.
- [OpenNSIS ETL/API source, pinned revision](https://github.com/un-fao/OpenNSIS/blob/a13a290d2cfb88db2d12af0efa937fd10a861549/sis-api/main.py).
- [OpenNSIS profile code scoping migration](https://github.com/un-fao/OpenNSIS/blob/a13a290d2cfb88db2d12af0efa937fd10a861549/sis-database/migrations/006_plot_profile_code_not_unique.sql).
- [OpenNSIS specimen identifiers migration](https://github.com/un-fao/OpenNSIS/blob/a13a290d2cfb88db2d12af0efa937fd10a861549/sis-database/migrations/023_specimen_field_lab_ids.sql).
- [OpenNSIS API dataset source migration](https://github.com/un-fao/OpenNSIS/blob/a13a290d2cfb88db2d12af0efa937fd10a861549/sis-database/migrations/024_uploaded_dataset_source.sql).
- [RFC 7946: GeoJSON](https://www.rfc-editor.org/rfc/rfc7946).
- [OpenAPI 3.1.1 specification](https://spec.openapis.org/oas/v3.1.1.html).
