# Connected laboratory operations — implementation plan

## Intended outcome

A technician opens a short list of **ready methods and active batches**, chooses a procedure such as pH in water, and works down a stable rack worksheet for approximately 40 samples. Preparation has its own station workflow and evidence. Texture is ordered and executed once, reports sand/silt/clay together, and calculates a versioned texture class. Managers and other roles land on scoped work that actually needs their attention.

This builds on the sample workspace revision 2. Reuse its order revisions, attempts, review decisions, command receipts, approvals and report snapshots. Do not create independent state transitions in each page. “Everything wired” means the same task identity, method revision, material, result set and eligibility are used from order through final report.

## 1. Separate six concepts that currently overlap

| Concept | Example | Required behavior |
|---|---|---|
| Orderable test | Particle-size distribution and texture | One selectable service; explicit output scope and allowed procedures |
| Procedure revision | A laboratory-approved hydrometer or pipette procedure | Immutable method definition: material, equipment, calculations, QC, fields, applicability |
| Executable task/attempt | Texture determination for one prepared aliquot | One assignment, one progress state, one grouped result set per attempt |
| Output analyte | Sand %, silt %, clay % | Individually identifiable/exportable results, inseparable for panel completion/review |
| Derived output | USDA texture class | Read-only, calculated from explicit compatible input versions and algorithm revision |
| Order bundle | Routine soil fertility package | Expands into orderables, not into arbitrary UI rows or manual calculated tasks |

Keep stable existing analyte codes for interoperability. Introduce a distinct orderable/procedure identifier such as `SOIL_PSD_TEXTURE`; preserve `SAND`, `SILT`, `CLAY`, and legacy `TEXTURE` as output/alias mappings. Do not reuse `TEXTURE` ambiguously for both a task and class. Legacy IDs require explicit mapping rather than renaming history.

Add an explicit task kind: PREPARATION, NUMERIC, MULTI_OUTPUT, STRUCTURED, SPECTRUM or CALCULATED. Category is display metadata only. A missing/unsupported result schema yields “Method setup required,” with result entry disabled and a manager action.

## 2. Preparation is a station operation

Create a preparation batch with selected eligible samples, a verified SOP revision and physical tray/container positions. Capture common settings once; record exceptions and per-sample completion separately.

**Drying:** identify material and containers, preparation mode, operator, actual start/end times, location/equipment when required, and the observations required by that SOP. Numeric temperature/mass observations are legitimate evidence when the procedure requires them; they are not a fake numerical “drying result.” Air drying must be representable without an invented oven. Do not assign temperatures, durations or constant-mass criteria from a universal software default.

**Preparation:** receive the correct dried material, record disaggregation/sieving/milling only as prescribed, fraction/mesh, contamination controls, recovered material, split/aliquot IDs, container labels and location. Preserve the relationship from original sample through prepared aliquots. Physical texture preparation must not blindly share fine milling intended for another analysis.

States: queued → started → evidence in progress → completed; with hold, failed and controlled rework states. Start can be recorded without all completion evidence. Finish requires the full current schema. Nobody checks boxes on behalf of the operator by default.

A batch finish action shows selected samples, common evidence and exceptions. Samples missing evidence remain open. Completion records operational provenance and unlocks dependent tasks immediately; it does not require waiting for analytical final approval. Later preparation invalidation identifies and holds dependent attempts and reports through the existing amendment process.

Preparation applicability belongs to the procedure and material. Some chemical methods use dried/sieved soil; mineral-N, biological assays and intact-core physical measurements may need different preparation/preservation. Do not enable a fresh/intact exception until that lab's method profile defines it. The normal S004 dry-soil methods stay locked until their required preparation is complete.

## 3. Action-specific readiness, enforced on the server

Replace a single `isReady` flag with capabilities returned from one service, reused by every command:

- `canPlan`: scope, order and assignment permit scheduling/notes.
- `canStartPreparation`: valid intake and required upstream material state.
- `canSavePreparationEvidence`: authorized started preparation attempt.
- `canEnterResults`: valid intake, correct material and completed prerequisites, active authorized attempt, method/equipment eligibility and edit permission.
- `canRecord`: entry eligibility plus complete valid result payload and required acquisition evidence.
- `canSubmit`: exact recorded versions, required batch/QC disposition and no blocking conflicts.
- `canReview`, `canApprove`, `canReleaseReport`: existing revision-2 rules applied to exact scope/versions and independent authorization.

Return structured blocker codes, human reasons, dependency IDs, responsible role/person and permitted destination. Planning notes before preparation are allowed. Analytical value drafts, paste and imports into the result store are not. An import that cannot be accepted can be held in a separate quarantined import area with the original file and failure reasons; it must not advance work or appear as a laboratory result.

Preserve evidence from a run that later fails QC. A failed QC disposition blocks submission/release as applicable; it must not erase measurements. An instrument failure during a run stops new authorized acquisition and records the incident; already captured evidence remains traceable.

Check eligibility again inside the commit transaction, using material, order, attempt and result versions. Preview is advisory, never authorization. Require expected versions and an idempotency key. On mismatch return a conflict response, not silent overwrite. UI and server share reason codes but the server is authoritative.

## 4. The technician workbench

### Landing view

Show three purposeful areas: **Continue a batch**, **Ready methods**, **Blocked work**. A method row shows procedure/revision, matrix, prepared fraction, eligible sample count, urgency, and batch action. Group by compatible method revision, lab, material preparation, acquisition context and units—not just analysis code. Do not combine pH water, CaCl₂ and KCl; do not combine different extraction ratios, method revisions or matrices.

Show both samples and tasks explicitly. “40 samples ready for pH” is useful; “120 tasks” alone is not. Preparation stations are prominent when they are the only executable work. Retests have visible reasons and the original attempt link.

### Build a batch

The technician selects ready samples, scans labels if available, chooses a qualified instrument and procedure profile, verifies material positions, and creates a run sheet. Default selection can be 40 sample positions as a configurable convenience, not a mandatory run limit. Controls, blanks and duplicates add positions according to that method's QC plan and instrument capacity. Batch planning may reserve blocked samples, but they remain excluded from executable/acquisition positions until revalidated.

Store a stable ordered run: sample ID, aliquot, position, task attempt, replicate, QC role and method revision. Record start context once: analyst, instrument qualification/calibration check, solution/reagent lot, procedure-specific preparation/extraction/incubation details and timing where required. Track preparation batches and analytical runs as distinct linked entities; one prepared set may feed several methods.

### Worksheet

- Stable sample order and clear row numbers/physical positions; filtering never remaps pasted values silently.
- Pinned identity/method context, compact inputs, visible units and per-row save/error state. A collapsible inspector must not take a quarter of the bench worksheet permanently.
- Procedure-specific columns: one value for simple final pH entry; three adjacent texture fractions; multiple instrument analytes; structured observations; spectrum import/link for acquisition tasks.
- Enter moves through the expected column/next row, Tab stays native, paste uses explicit sample-ID/column mapping and preview. Barcode mismatch, duplicate sample IDs and unexpected columns stop ambiguous rows. Never assign by current screen position alone after sorting.
- Paste is not offered for operational checklists. A multi-output paste requires headers or explicit mapping; no array-of-values shorthand inferred from position.
- Raw drafts retain intermediate text, including decimal commas, without coercing blanks to zero. Censoring and invalid intermediate input cannot become a final number by coercion.
- Per-row save receipts distinguish pending, saved, rejected, conflict and connection failure. A global “saved” state is true only when every changed row is acknowledged. Flush outstanding saves before leaving/recording; protect against a late response replacing newer edits.
- Refresh merges server data without replacing dirty rows, selection or focus. Reassignment/hold/revision changes surface conflicts. Offline behavior must be explicitly supported and protected, or clearly say edits are only in this open page; do not promise durable recovery without implementing it.
- Bounded backend pages, accurate separate aggregates and stable cursor/ordering. Use 40-row batch rendering, and benchmark 200/1,000 assigned items; use virtualization only if measurements justify it and keyboard/accessibility work is preserved.

### Record and submit

Recording saves complete typed results and operational evidence; submitting hands an explicit set to review. Batch submission can span many samples, but existing sample approvals remain sample/scope-specific. Show included and excluded rows and reasons. Partial success must report every item and never label the whole batch successful. Multi-output result sets are atomic; a texture row cannot submit only sand. Failed rows remain selected for correction without retrying successful writes.

Do not add a confirmation dialog for each cell. Use one useful batch review at handoff, with actual result values, QC, exclusions and authorship. A receipt links to batch, sample and submitted versions.

## 5. Texture: order once, measure together, calculate correctly

The order screen presents **Particle-size distribution / texture** with its procedure and outputs: sand %, silt %, clay %, texture class. Add one order line and one executable texture task. The manager assigns the procedure once. The technician sees adjacent fraction columns and a derived class column. Component result IDs remain available for data exchange and statistics.

For the standard USDA fine-earth convention, store sand/silt/clay size definitions and classification scheme with the result set. Coarse fragments are separately reported; they do not become a fourth component of the fine-earth 100% total. Distinguish measured particle size, field-estimated texture and spectrally predicted fractions/classes.

**Entry contract:** each fraction is finite, explicitly present and within 0–100. Zero is permitted when actually reported. Invalid text, blanks, negative values, >100 and censored fractions cannot receive a valid class. Store full calculation precision and display rounded values separately.

**Closure:** the reported composition represents 100%. Store a method-specific policy. Three independently determined fractions require a defined closure/rounding check. Some approved methods calculate a remaining fraction by difference; then mark that output DERIVED, record the equation and prevent it from being presented as an independent measurement. Do not enforce a universal ±2% “scientific” tolerance. Do not silently rescale failed measurements. Any permitted normalization must preserve originals, show the adjustment, use an approved policy and never hide a failed recovery check. An exact 100 total alone does not demonstrate correct particle-size analysis.

**Classification:** use a versioned server algorithm independently verified against all 12 USDA class definitions, edges, vertices, ties and near-boundary inputs. Test 50/35/15 → Loam, 20/50/30 → Silty clay loam and 45/20/35 → Clay loam. A client preview may mirror the algorithm but cannot be the reporting authority. On insufficient/invalid inputs, class is unavailable, not a default Loam. Do not show a green closure badge as proof of scientific QC.

**Provenance:** atomically create the fraction result set plus calculated class with source result-version IDs, procedure/algorithm revisions, material, attempt, replicate and basis. Class goes into the sample result table, Data Results, export and approved report. Changing a fraction creates a new set and class, invalidates dependent eligibility and follows amendments after approval; older released snapshots remain unchanged. Never combine the newest sand from one replicate with clay from another.

## 6. Review other analysis families systematically

The attached JSON register enumerates all 214 seeded analyses and all 543 methodology records. Each has a provisional editor/order disposition and outstanding configuration questions. Compare this with live catalogue, lab method defaults, actual orders and historical results. A reviewed mapping must cover every active production record; unknowns become unavailable for new orders pending configuration, not generic numeric tasks.

| Family | Practical execution model | Calculation / compatibility constraint |
|---|---|---|
| pH variants | Separate procedures and batch queues for water, salt solutions and ratios; instrument readings and calibration checks | No averaging across methods. Method-specific duplicate absolute difference/precision criterion; no universal percentage QC rule for every analyte. |
| EC / ECe | Separate extraction contexts and worksheets | Preserve extract ratio, temperature/reference and units. Do not interchange 1:5 EC and saturated-paste ECe. |
| Exchangeable Ca/Mg/K/Na | One multi-output run where the same validated extraction/acquisition supports all; ordered subset explicit | Keep exchangeable and soluble/total values distinct. CEC, ECEC, base saturation and ESP use compatible input units, procedure context and versions. Missing Na is not zero. |
| SOC, TN, C:N | Shared acquisition run only when laboratory procedure/instrument supports it; separate outputs retained | Name the ratio, normalize units, identify carbon form and basis; missing/zero denominator or censored values produce unavailable/qualified output, not invented ratios. |
| SOM | Separate measured method or explicitly estimated derived method | No automatic universal SOC ×1.724 replacement for measured SOM. Store factor and provenance if the approved procedure calls for an estimate. |
| Mineral N | Preserve required material/preservation; same extraction can support paired outputs | N_MIN can derive from nitrate-N + ammonium-N only in compatible units, basis and extraction. “As N” differs from “as ion.” |
| Olsen/Bray/Mehlich/resin P | Separate method-specific orderables or choices | Never merge “available P” by name across extraction methods. A multi-element extraction may share a run, not erase method identity. |
| ICP/AAS/XRF/GRS and trace-element suites | Method/instrument export with explicit analyte mapping, units, blanks/controls and qualifiers | Spectrum/acquisition file and quantitative outputs are different records. Unsupported formats block import; no fake scalar spectrum. Total, pseudo-total, exchangeable and extractable concentrations remain distinct. |
| MIR / Vis-NIR | Existing spectrum intake and library linked to exact acquisition attempt | Predictions retain model/calibration/preprocessing versions and applicability/QC. Predicted texture is not measured texture; library data cannot satisfy an unrelated task merely by sample match. |
| Bulk density / particle density / porosity | Structured masses, volumes and intact/disturbed material context as applicable | Porosity needs compatible densities; do not apply a universal particle density assumption without a named approved estimate. Do not mill intact core samples. |
| Moisture / retention / AWC | Structured mass/volume/water-potential data and appropriate specimens | AWC uses compatible FC/PWP definitions and common volumetric or gravimetric basis. Gravimetric and volumetric water fractions are not interchangeable without required density data. |
| Atterberg / aggregate stability / granulometry | Method-specific repeated observations and multiple fractions | Non-plastic/other categorical outcomes need structured support. Granulometry is not one arbitrary number. Check current AGG_STABILITY method-name/unit pairing. |
| Munsell colour | Structured hue/value/chroma plus dry/moist condition | No generic numeric editor. |
| Biological/enzyme assays | Time, temperature, blanks, mass, incubation/extraction and calibration per procedure | Do not universally dry these samples or collapse their multidimensional units. Derived rates and quotients retain inputs. |
| Fertilizer, lime, plant and water matrices | Matrix-specific procedures and preparation | Element versus oxide conversions explicit; no soil preparation defaults. Method units and validation remain matrix-specific. |
| Placeholders / unknown aliases | Disable new ordering after reconciliation, retain history | Do not publish fabricated “Specialized Agronomic Parameter” definitions as validated services. |

Derived calculations form a dependency graph with dimensional validation, required input types and cycle detection. They do not create technician “enter calculated value” tasks. Dependency changes trigger targeted recalculation/review, not a blanket reset. Calculated does not mean approved.

## 7. Dashboards and queues by role

Create one scoped operational read service for counts, lane rows and navigation targets. Every count uses the identical eligibility predicate as its destination. Aggregate full datasets; paginate previews independently. Counts identify their unit: samples, executable tasks, batches, submission packages or reports. A gate is not an analysis, and ACCEPTED analytical work is not 0% complete.

Default selection: a valid explicit deep link wins; otherwise restore a meaningful user choice; otherwise choose the highest-priority nonempty actionable lane. For a bare manager queue use urgent blocked work, pending review, ready approvals, unassigned work, then intake. Distinguish due/age priorities within lanes. Do not move the selected tab during active work when counts update. If all are empty, show an honest clear queue with useful navigation. A saved empty view may remain when explicitly chosen; a bare page must not default to empty intake while review is waiting.

| Canonical role | Initial focus and useful actions | Scope and limits |
|---|---|---|
| LAB_TECHNICIAN | Resume active batch; ready preparation/methods; returned work; blocked prerequisites | Assigned executable work in permitted lab/material scope. Read scope may be wider, but does not grant edit/execute. |
| LAB_MANAGER | Urgent exceptions, reviews, final approval eligibility, assignments, intake | Own authorized lab(s); cross-scope counts and previews prohibited. Links carry lane and filters. |
| SAMPLE_RECEPTION | Arrivals to verify, discrepancies/holds, labels and intake completion | Authorized receiving scope. Preparation overview does not grant analytical approval. |
| MASTER_USER | National bottlenecks, lab exceptions and permitted escalations | Explicit country/lab/project entitlement. National oversight is not inferred from arbitrary country text. |
| PROJECT_MANAGER | Project deliverables, blocked samples, due reports | Assigned projects intersect allowed scope. Show authorized report states; no implied laboratory editing authority. |
| AUDIT_USER | QC exceptions, audit trail, amendments and report lineage | Read-only quality inspection per role registry. Do not silently grant QC disposition or approval rights. |
| EXTERNAL_VIEWER | Released reports and expressly shared project information | Explicit sharing rules; no internal draft values or private operational details by default. |
| VIEWER | Authorized read-only progress/results | No mutation controls; data stage visibility governed by sharing policy. |
| SURVEYOR | Expected/collected sample handoff, collection discrepancies | Authorized field assignments and provenance; no laboratory result entry. |
| SUPER_ADMIN | Scope-aware operational exceptions plus system administration | Explicit global scope; selecting a lab clearly bounds the view and actions. |

Reconcile legacy COUNTRY_ADMIN users with a deliberate migration/mapping; it exists in parts of the app but not the canonical role registry. Do not introduce a new role as a workaround. Existing broad permissions such as CHANGE_STATUS must not substitute for precise operation capabilities.

Each card/link carries an actual route, query and entity identity. Examples: `/manager-queue?lane=review`; `/workbench?method=<procedureRevision>&state=ready`; `/workbench?batchId=<id>`; sample deep links retain the task/attempt context. Keep compatibility redirects from `/my-work`; avoid two competing entry systems. Counts and errors refresh after receipt, order change, assignment, preparation, result record, submission, QC disposition, review, report release and amendments. Use scope-aware events and query invalidation with sequence/request guards. No application error may render as “Queue empty. Good job.”

## 8. Persistence and API contracts

Extend existing entities rather than duplicate them:

- Catalogue: versioned procedure/result schemas, orderable definitions, output members, input dependencies, preparation profile, QC profile, reportability and applicability. Preserve Analysis/Methodology/external mappings with migration adapters.
- Material/aliquot: parent lineage, fraction/preservation/preparation state and evidence references. Sample-level gates can be a projection for compatibility, not the only scientific source.
- WorkItem/WorkAttempt: kind, order line, immutable procedure revision, material ID, assignment, schema revision, version. Reuse revision-2 WorkAttempt where suitable.
- Batch: typed method revision, lab, instrument context, lifecycle, QC disposition, ordered positions and attempt/replicate links. Replace competing JSON membership/relation sources with one authoritative relation and migration checks.
- ResultSet: logical panel/run identity and immutable versions. Typed result members support numeric, categorical, censored, structured and file-backed outputs. DerivedDependency points to exact input versions and algorithm/configuration revision.
- PreparationEvidence: versioned structured observations with author/time and required attachments, separated from reportable analytical results.
- Commands: item- and batch-level idempotency, explicit selection, expected versions and receipts. Required row failures never disappear inside a 200 response.

Draft payload is a discriminated union, for example numeric raw value, texture members keyed by analyte code, preparation evidence keyed by step/field ID, or structured observations. Do not use positional arrays as the durable meaning of sand/silt/clay. Notes/planning fields are separately authorized. No values sent by the client may overwrite derived class fields directly.

Suggested endpoints can evolve existing routes: procedure-ready queues, batch create/membership/start, typed attempt draft, record preview/commit, submission preview/commit, preparation start/evidence/finish, scoped dashboard summary/lane rows. Both old and new entry endpoints call the same command services or return a documented compatibility error. Include sample page entry, quick edit, work-item single/bulk status, intake batch, result import, spectrum import/link, review and report APIs in the route matrix.

One texture record transaction writes the three component versions, class, dependency edges, attempt version, audit and receipt, then emits invalidation after commit. Batch failure semantics are explicit: atomic per result set with item receipts, or all-or-nothing for validated operations that require it. Do not commit half a panel. Use an outbox/retryable notification mechanism or reliable post-commit invalidation so clients converge after failures.

## 9. Migration and implementation sequence

| Package | Work | Exit evidence |
|---|---|---|
| O1 — Baseline and containment | Inventory current routes/catalogue/roles; immediately fix editor-kind resolution, pre-prerequisite draft blocking, typed evidence skips, implicit checklist success, per-item save receipts and scoped dashboard submission query | Reproductions fail safely; no fake gate result or false saved badge. Preserve historical entries for investigation. |
| O2 — Versioned definitions | Introduce explicit kinds/orderables/procedure schemas and dependency graph; produce complete live catalogue mapping with active lab methods | Every orderable resolves to approved configuration or unavailable state; seed reruns do not overwrite lab revisions. |
| O3 — Preparation | Material/aliquot lineage, station batches, versioned evidence, start/finish and action readiness | Drying → prep → eligible methods; valid alternative material paths; all entry routes enforce same rules. |
| O4 — Batch workbench | Extend existing Batch/QC entities, stable rack positions, method queues, keyboard/paste/save state, membership scope | 40-sample run and large-backlog scenarios pass; no lost edits; manager and technician see same batch state. |
| O5 — Compound/derived results | Texture order/task/result set, verified classifier, calculations and exact provenance; multi-output and structured family profiles | All texture classifications/boundaries and round trips pass; independent measured and predicted results remain distinct. |
| O6 — Results/review/report | Canonical result readers, group review, Data Results/class display, immutable report projection and amendments | Same versions/values/class across sample, data export and report; corrections retain released history. |
| O7 — Role dashboards | Shared scoped counters/lanes, deep links, role coverage, active default selection, error/stale/event handling | Every canonical role and cross-lab/project test passes; count equals eligible destination population. |
| O8 — Migration and release | Dry-run conversions, reconciliation reports, staged rollout, representative lab UAT, regression and deployment verification | No unresolved critical/high data integrity or authorization failures in released scope; documented residual configuration work. |

Migrate existing texture work carefully: unstarted sibling tasks may consolidate into a new parent with preserved aliases/history. Partially measured/reviewed fractions need explicit attempt/method/basis matching; do not auto-merge ambiguous siblings or turn incomplete data into a complete result. Approved/released legacy outputs remain immutable. Incorrect historic classes trigger an impact report and controlled amendment workflow, never a silent rewrite.

Inventory premature drafts separately: keep authorship and raw input, flag prerequisite violations, remove from eligible results/submission and require an authorized reconciliation. Do not fake drying/preparation completion to make drafts eligible. Quarantine placeholder catalogue entries from new orders only after identifying references; do not delete linked history.

Back up the database, file store and configuration; dry-run on a restored copy; verify forward and rollback behavior. Deploy server enforcement before enabling new entry UIs. Feature flags must not expose old bypass routes. A classifier change requires reviewing prior derived outputs and report impact. Record deployed commit and migration version; production smoke checks remain read-only unless designated test samples are explicitly available.

## 10. Definition of done

Execute `acceptance-checklist.md`, produce actual pass/fail evidence and resolve high-impact failures. Include real operator UAT with a preparation batch, a 40-sample pH batch and a texture batch. Validate actual lab SOP/equipment/import profiles; invented defaults cannot substitute. Run existing authorization, workflow, spectral, result/report and migration regressions in an isolated test environment, then browser tests of the shared routes.

Report separately: implemented, tested locally, tested in staging, verified in production, and still awaiting lab configuration. Zero issues cannot be guaranteed; release readiness is demonstrated by evidence, explicit limitations and a recoverable rollout.
