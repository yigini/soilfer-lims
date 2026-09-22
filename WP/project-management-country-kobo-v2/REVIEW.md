# SoilFER country projects and Kobo intake: review

21 September 2026. Source baseline: `762c46e`. Status: handed off to Antigravity's existing LIMSI / LIMS Dev session; see DELIVERY.md. No application or production changes by this review task.

## Decisions confirmed by the user

- Separate SoilFER projects for each country.
- Kobo is the default registration source; manual/CSV registration requires an authorized, recorded exception.
- Platform administrators manage connections and exceptions; laboratory managers may do so within their own laboratory.
- Move existing and future SoilFER samples into country projects while preserving history.
- Start with Guatemala, Honduras, Ghana, Kenya, Zambia, Mozambique and Tunisia.
- The platform must remain generic: new non-SoilFER projects can onboard with Kobo, open intake or walk-in samples. SoilFER requirements belong in a configurable, versioned template, not name/country checks in shared application code.

Proposed design: keep USA/Japan as programme/reporting groupings, with country projects beneath them. Programme membership must not itself grant access to every country or laboratory. Ordinary non-SoilFER projects may retain open intake or manifest-based registration.

The migration decisions have been answered. See IMPLEMENTATION-PLAN.md for the final planning direction and ANTIGRAVITY-HANDOFF.md for the ready-to-send message. USA/Japan programme grouping is a proposed implementation choice, grounded in the existing profile relationships.

## Evidence and limits

- Inspected current project, reception, Kobo, sample, membership, dashboard-scope, report-filter and SIS code; profile seeds; project UI and help; earlier audit evidence.
- Opened local `server/prisma/dev.db` using better-sqlite3 with `readonly: true, fileMustExist: true`. Selected only project metadata and non-secret connection metadata. No credential values were read or printed.
- Local data has three projects: SoilFER USA, SoilFER Japan and Routine Soil Testing. Both SoilFER projects are `OPEN_INTAKE`, have no coordinating lab and have targets 33,672 and 6,858 respectively.
- Of eleven local Kobo configurations, one maps to `SOILFER-US`; six have no project mapping (five active); four refer to project codes absent from the local Project table. These are local findings, not a production inventory. Do not delete or remap them automatically.
- Live browser visit to `https://lims.yigini.net/projects` redirected to `/login?expired=true`. No authenticated live screen, production data or deployed revision was verified.
- Findings below are source-confirmed inconsistencies and local-data observations. No mutation probes or release tests were run. Older reports describe older baselines and are not current proof.

## Findings

| ID | Finding and practical effect | Current source evidence |
|---|---|---|
| F01 | Both SoilFER seeds say Open Intake. Rerunning the profile seed overwrites project type, status, target and assigned-lab JSON, so a one-time database correction can be undone. | `profiles/soilfer/projects.json:6,14`; `server/seeds/profile.js:65-81` |
| F02 | Kobo connection lookup returns `configured:false` before querying connections unless project type is `KOBO_LINKED`. A valid connection can therefore be hidden. | `server/controllers/projectController.js:1576` |
| F03 | New Project offers Kobo Linked but submits no Kobo form/token fields; the server requires them. The UI cannot complete that choice successfully. The form also submits `client`, which createProject does not persist. | `client/src/components/projects/NewProjectModal.jsx:42-55,143`; `server/controllers/projectController.js:281-296,354-370` |
| F04 | Project creation commits before connection setup, silently catches setup failure, and only creates the connection when an owner lab exists. Updates use the first project connection without lab selection, occur after the project transaction/receipt, and also swallow failures. A global or multi-lab project can appear saved with missing or incorrect connection changes. | `server/controllers/projectController.js:415-453,649-690` |
| F05 | Legacy lab connection save writes only a lab-level configuration with null project mapping. Scheduled sync requires an explicit projectCode. Save and sync contracts disagree. | `server/controllers/koboController.js:103-153,341-350` |
| F06 | The project UI expects `formId`, while the endpoint returns `koboFormId`. It shows the project's owner lab rather than the selected connection's lab. Multiple configurations return `ambiguous:true, configured:false`, which the UI reduces to Not linked. Inactive/error/unauthorized/loading states are not distinguished from connection absence. | `client/src/components/projects/DataConnectionsTab.jsx:63-90`; `client/src/pages/ProjectWorkspace.jsx:184-190`; `server/controllers/projectController.js:1685-1718` |
| F07 | Reception treats every non-template project, including Kobo Linked, as permitting a new unknown ID. Server desk registration checks some lifecycle states but has no corresponding source/exception policy. Batch receipt also needs that shared gate. | `client/src/pages/Reception.jsx:835-851`; `server/controllers/receptionController.js:164-242,1380-1600` |
| F08 | Admission lifecycle checks differ by path. Manifest upload omits CLOSED from its blocked states; desk and Kobo paths omit DRAFT/PENDING_MANIFEST from their blocked states. Define operation-specific allowed states centrally, including whether a manifest may prepare a draft before activation. | `server/controllers/projectController.js:790-797,865-913`; `server/controllers/receptionController.js:150,179`; `server/controllers/koboController.js:361,463` |
| F09 | Single-sample Kobo resync chooses the first active lab connection, without project matching. Its handler has no target-sample scope check and directly rewrites metadata/fieldMetadata without a lifecycle/amendment guard or audit entry. Route-level MANAGE_ANALYSES is not target authorization. Treat as a priority integrity/access defect to reproduce safely. | `server/routes/koboRoutes.js:23`; `server/controllers/koboController.js:650-814` |
| F10 | The sample workspace's hasKoboConnection flag checks any active configuration in the lab, not the sample's project/source connection. A sample can be offered resync against the wrong form. | `server/controllers/sampleController.js:1153-1186` |
| F11 | Project IDs and codes are not interchangeable: local SoilFER USA is ID SoilFER-USA / code SOILFER-US. New desk registration writes the ID to both fields; batch consignment writes the code to both fields. Other readers use code-only filters. This can produce inconsistent associations and foreign-key failures, especially during country migration. | `server/controllers/receptionController.js:222-237,1580-1585`; `server/services/dashboardScope.js:310-350`; `server/controllers/reportController.js:228-239`; `server/controllers/sisController.js:58-63` |
| F12 | The connections tab can override a false canImport capability using a broad role fallback. Workspace defaults missing canImport to true. The server returns separate edit-plan/access/lifecycle capabilities, but the UI collapses management into a different canManage value. Use exact operation capabilities throughout. | `client/src/components/projects/DataConnectionsTab.jsx:14`; `client/src/pages/ProjectWorkspace.jsx:281-285`; `server/controllers/projectController.js:253-257` |
| F13 | Every awaiting-arrival record is labelled overdue regardless of an arrival deadline. This inflates project attention warnings and must not carry into country dashboards. | `client/src/pages/Projects.jsx:96-103` |
| F14 | Legacy SoilFER behavior relies on country-code/name heuristics to apply the std-soil bundle and metadata keys to label deletion protection as Google Sheet. These do not express the new country/Kobo/exception model. Preserve conservative deletion protection while replacing misleading source detection and labels. | `server/controllers/sampleController.js:454-471,1418-1421,1617-1625`; `server/services/sampleOriginService.js` |
| F15 | Help describes editable project Kobo settings, form selection and sync controls that the current connections tab does not provide. The tab claims server-side encryption, but the inspected application paths store apiToken directly; application-level encryption was not found. Make behavior and copy truthful; infrastructure encryption was not assessed. | `docs/book/src/usage/kobotoolbox.md:7-30`; `client/src/components/projects/DataConnectionsTab.jsx:90`; `server/prisma/schema.prisma:810`; connection create/update code |

## Existing improvements to preserve

- Kobo creates EXPECTED records with null receptionDate; a field submission is not physical receipt.
- The scheduled/bulk sync path verifies explicit project mapping, active lab, membership and config/project state before and during writes. Keep submission transactions and cursor recovery.
- Project trash refuses projects with samples; restore does not rewrite sample links.
- Keep current preview receipts, idempotency, catalogue validation, role scope, physical receipt gates and immutable released outputs. Do not replace these with older audit proposals.

## Initial country mapping to validate against production

| Proposed country project | Existing profile programme | Configured laboratory |
|---|---|---|
| SoilFER Guatemala | USA | GTM-LAB1 |
| SoilFER Honduras | USA | HND-LAB1 |
| SoilFER Ghana | USA | GHA-LAB1 |
| SoilFER Kenya | USA | KEN-LAB1 |
| SoilFER Zambia | USA | ZMB-LAB1 |
| SoilFER Mozambique | Japan | MOZ-LAB1 |
| SoilFER Tunisia | Japan | TUN-LAB1 |

These are profile relationships, not evidence that every lab owns the project or has a healthy production Kobo connection. Afghanistan, Peru and Uganda occur in a legacy bundle heuristic, which does not establish current programme assignments, labs or Kobo forms. Missing country setup should remain draft/unconfigured until verified. Do not invent per-country planned targets by evenly dividing programme targets.

## Proposed implementation workstreams

1. **Inventory and country model.** Establish actual production revision and a read-only inventory of projects, programmes, labs, sample country/provenance, Kobo mappings, user grants, API-key scopes and report references. Introduce stable country-project identity, country and programme links. Preserve existing programme identifiers as historical/aggregate references. Resolve ID and code once at API boundaries. Avoid country-name or first-project inference.
2. **Kobo connection management.** Implement project/lab/config-specific create, test, edit, disable and sync contracts. List all visible connections with destination, form, health, last successful sync and meaningful failures. Admins manage all permitted connections; lab managers only their own lab. A disconnected Kobo project remains Kobo-based and shows setup required; it must not become open intake. Use explicit setup outcomes and durable retry semantics instead of success after swallowed errors. Separate loading, denied, ambiguous, missing, disabled and unhealthy states. Recheck exact sample/project/lab authorization for resync and media access.
3. **Shared source and admission policy.** Separate default registration source from permitted exception operations. Gate desk registration, manifest preview/commit, batch reception, generic sample/file import, legacy backfill and Kobo sync on the same policy. Exception records identify actor, approving actor where needed, lab, project, reason, source evidence and affected sample IDs. Recheck policy/membership at commit. Retain originating Kobo form/submission identifiers and original source even after authorized enrichment. Reconcile later Kobo arrivals with exception-created samples explicitly, without duplicate creation or silently overwriting field corrections.
4. **Migration and programme rollups.** Implement only the historical scope the user selects. Prepare an idempotent dry run with explicit old-to-new project/lab/config mappings; conflicting or missing sample country/source evidence goes to an unresolved queue. Never use destination lab country alone to infer where soil originated. Preserve sample IDs, original IDs, laboratory IDs, chain of custody, results, attachments, release snapshots, report bytes/checksums and audit history. Record membership changes as explicit migration events; retain original programme/project provenance. Reconcile grants and SIS scopes without widening access. Preserve sync cursors only where form identity remains the same and record any controlled replay.
5. **All connected screens and readers.** Update Projects list/workspace/create/settings, Reception scan and consignment flows, Samples/field metadata/resync, workbench context, dashboard filters and totals, analysis-plan defaults, import/backfill tools, reports/exports and SIS. Country totals must reconcile with programme aggregates without double counting. Distinguish planned target, registered, awaiting arrival, physically received and released. Overdue requires a defined due date. Refresh cached/offline drafts through a versioned mapping without silently changing their project.
6. **Profile/help and acceptance.** Replace conflicting SoilFER seeds; seed reruns must not reset operational status, connection choice or customized project settings. Update relevant help and en/es/es-419/fr/pt translations. Use exact server capabilities for UI actions. Rehearse migration on a production-shaped backup, demonstrate rollback/recovery and verify the actual deployed revision only if deployment is subsequently authorized.

## Required verification matrix for Antigravity

- Kobo-country creation works; connection failure produces truthful setup state; multi-lab selection does not edit a first arbitrary configuration.
- Country project displays Kobo default and the correct per-lab connection even when missing, disabled, unauthorized or failing.
- Unknown ID and CSV additions require a valid exception; standard walk-in projects remain usable. Direct API requests cannot bypass UI restrictions.
- All blocked lifecycle states behave consistently by operation; a pause leaves already-received laboratory work operable.
- Admin, national oversight, lab manager, reception, technician, project manager and viewer see permitted projects and exact allowed actions; no cross-country/lab access through connection, resync or export endpoints.
- Single-sample resync cannot fetch a foreign form or rewrite released provenance outside the amendment workflow.
- Country migration conserves counts and identities, released report hashes and result relations; reruns produce no duplicate projects, samples or grants.
- Legacy links, project grants, consignment references, report searches, SIS scopes and queued drafts resolve correctly; retained programme views aggregate once.
- Form changes, partial failed submissions, connection disablement, membership revocation, retries and cursor replay preserve the existing import integrity guarantees.
- Country targets and overdue warnings are grounded in real planning data, not registration counts or guessed allocations.

The implementation handoff has been submitted to the existing LIMSI / LIMS Dev session and the UI showed Working. All current product questions have been answered and incorporated into IMPLEMENTATION-PLAN.md. Authenticated production inventory remains an explicit implementation prerequisite, not a claim already established here.
