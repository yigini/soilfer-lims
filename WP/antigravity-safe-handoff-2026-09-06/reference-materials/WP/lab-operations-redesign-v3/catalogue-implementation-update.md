# Analysis Configuration: implemented corrections and remaining scientific work

6 September 2026 · Project: `C:\Users\yigin\Documents\soilfer-lims` · Source baseline: `bee0b6e`.

The admin catalogue is a functional dependency of reception, ordering, work assignment, results and reporting. This pass changes application code and seed definitions in the local working tree. It does **not** migrate the production database, push a commit or deploy. The full laboratory operations redesign described in this package is still larger than these corrections.

## What was checked

The deployed Analysis Configuration page was inspected read-only in the existing GTM laboratory-manager session. It displayed **216 records**, while its navigation badge said **166 Parameters**. Its list included synthetic “Specialized Agronomic Parameter” records and imported names that were not meaningful laboratory definitions.

The source seed contained **214 analyses and 543 methodologies**. These are separate inventories: the deployed database is not assumed to equal the seed. The generator included loops that invented analyses and alternative procedures to reach target counts. After removing that padding, the seed contains **176 analyses and 467 methodologies**. Thirty-eight synthetic definitions and their 76 methods were removed from future seed data. No deployed records or historical results were deleted.

Twelve additional imported definitions had generic “code Determination” names and unjustified units/limits. Their seed names are now readable; they remain inactive with no assumed units or validation limits until curated. They include hydraulic conductivity, water holding capacity, generic pH, moisture content, carbon fractions and several multi-output measurands. The other surviving seed definitions and methodologies were not silently rewritten. The remaining catalogue is **not scientifically certified** by these counts or tests.

## Implemented behaviour

| Connection | Implemented correction |
|---|---|
| Admin catalogue → working names | Current catalogue names feed the workbench, sample work/results views, analysis selection, reception, manager queue and related equipment views. Internal codes remain stable for data links and integrations. The admin table presents parameter names first, with internal codes secondary. One shared fallback registry replaces duplicated name lists. |
| Admin → safe configuration | New parameters start inactive, with no invented numeric limits or reporting unit. Name, code, matrix, status, numeric rules and dependency definitions are validated. The screen shows actual counts, unavailable entries, scientific review notices and existing connections. |
| Roles and laboratory scope | Global definitions are maintained centrally by the system administrator. Lab managers can maintain their own laboratory definitions and local methods/defaults. Technician writes to the mounted configuration API are rejected. |
| Catalogue → orders and packages | New selections must exist, be available to the laboratory and be active with a valid configuration. Placeholder and operational gate codes are not new analytical orders. Checks cover reception, walk-in creation and analysis-order preview/commit. Existing orders retain retired parameters. Invalid/empty packages cannot be offered as usable selections. |
| Catalogue → method assignment | Explicit lab defaults, then eligible local defaults, then eligible shared defaults are resolved consistently. Ambiguous or cross-parameter/cross-lab defaults produce errors instead of silently choosing the first record. Bulk default updates validate the entire request before writing. |
| Configuration → historical evidence | Used definitions and methods cannot be deleted. Reporting units and sample matrix cannot be changed after ordered work/results use a definition. A changed scientific meaning requires a revised definition; changing a label does not convert historical values. Connection checks include JSON package/order references as well as relational records. |
| Names → workflow map | Refreshing catalogue names no longer erases default preparation dependencies or changes workflow behaviour merely because a category label changed. |
| Drying/preparation → workbench | These use completion checklists, not numerical determinations. Partial confirmations can be saved as operational drafts. Completing the checklist records versioned evidence and opens the corresponding preparation gate without creating a fake analytical Result. The checklist references the applicable laboratory procedure; it does not prescribe an invented universal drying temperature or sieve size. |
| Preparation → analytical entry | Server checks reject analytical drafts before the required preparation gates are complete. The worksheet disables blocked numeric input and scalar evidence is rejected for operational/spectral tasks. |
| Catalogue rules → numerical validation | Workbench recording honors configured bounds without requiring an undocumented `type` field. The sample endpoint also honors the generic lower limit when optional LOQ fields are null. Non-finite and malformed numeric input is rejected. |
| Sample-page result endpoint → assigned work | Unknown/unordered parameters, incompatible methods or units, another technician’s work, duplicate replicate keys and completed/submitted/accepted work are rejected. The save transaction rechecks sample and work readiness. Spectra and operational tasks cannot be supplied as scalar measurements through this alternative route. Existing range flags remain reviewable evidence; this route does not establish a new universal QC policy. |
| Evidence → sample display | Operational JSON is presented as confirmations and completion evidence instead of a raw result string. Zero remains a valid displayed numeric value. |

Principal new modules: `cataloguePolicy.js`, `methodResolution.js`, `resultEntryPolicy.js`, `AnalysisCatalogueContext.jsx`; shared data: `analysisDisplayNames.json`, `operationalChecklists.json`, `importedParameterNames.json`. These shared files are explicitly included in version control rather than being lost under the existing data-directory ignore rule.

## Scientific interpretation and catalogue rules still required

**Use a parameter definition for what is measured and a method revision for how it is measured.** A method’s extraction, sample/solution ratio, reporting basis and units must be retained with the result. A friendly display name is useful only when it describes the actual measurement.

| Family | Required practical model and remaining work |
|---|---|
| Soil pH and electrical conductivity | Keep the solution, ratio, relevant conditions and method revision explicit. The seed currently offers differently described ratios under some parameters; review their grouping before treating results as comparable. FAO publishes separate harmonized procedures, including EC in a 1:5 soil/water suspension. [FAO SOP repository](https://www.fao.org/global-soil-partnership/glosolan-old/repository/standard-operating-procedures/en/), [FAO soil pH procedures](https://www.fao.org/global-soil-partnership/glosolan-old/soil-analysis/sops/volume-2.1/en/). |
| Particle size / texture | Order one particle-size analysis, record linked sand/silt/clay fractions on the same basis, check closure using the approved method’s rule and derive the named classification system. USDA class depends on the three fractions. Do not count class as an independent technician measurement or silently normalize a failed closure. The current three-task expansion, class calculation and report propagation still require the v3 grouped-result migration and independent boundary tests. [USDA texture calculator](https://www.nrcs.usda.gov/resources/education-and-teaching-materials/soil-texture-calculator). |
| Metals: total versus extracted content | Several catalogue names say “Total” while offering acid extraction. EPA 3051A does not claim total sample decomposition; results need method-specific interpretation. The application now warns about this naming conflict. Do not relabel historical values as total content or automatically replace their method. [EPA Method 3051A, section 1.2](https://www.epa.gov/sites/default/files/2015-12/documents/3051a.pdf). |
| Water retention / conductivity / aggregate stability | These can require method-specific multiple observations or units that differ by output. A blanket mg/kg or generic percentage input is inadequate. Imported quantities lacking verified definitions remain inactive in the new seed. |
| Carbon, organic matter and extracted nutrients | Keep distinct measurands, extraction methods, reporting units and calculation provenance. Do not apply a universal carbon-to-organic-matter conversion or treat different nutrient extractions as interchangeable. Curate the surviving method references against the relevant published procedure and the laboratory’s adopted SOP. |
| MIR/NIR | Acquisition produces spectral data and its metadata. Predictions are separate model-versioned results linked to the acquisition. The scalar endpoint protections are implemented; this pass does not certify all instrument export parsers, reference library links or calibration models. |
| Preparation applicability | The present soil workflow enforces drying/preparation. Fresh-soil biology, water and other matrices need explicit procedure-specific applicability before those workflows can be described as complete. Generic checklist confirmation is not a substitute for the laboratory’s actual SOP revision and required equipment/QC evidence. |

The 12 imported definitions are listed in `server/data/importedParameterNames.json`. The original `catalogue-review-register.json` remains a **baseline triage register** of the old seed; it has not been rewritten to make the old audit evidence appear current.

## Verification actually performed

- **120 server tests passed across 13 targeted suites** against an isolated copy created by the test harness. Coverage includes catalogue governance, method defaults, historical-use protection, operational execution, preparation gates, alternate result entry, replicate/provenance preservation, order reconciliation and workflow dependencies.
- **16 production-build browser checks passed** with fixture APIs and external network requests blocked. These cover names, counts, review filtering, blank/inactive new definitions, unit locks, operational checklists and blocked analysis input. They are not tests of the 216 live records or a 40-sample batch.
- Client production build passed. The changed tree also passed whitespace/diff checks.
- Existing method-default and result tests were supplied with explicit, valid configured/ordered/assigned fixtures to match the newly enforced contracts; their original behaviour assertions were retained.

Evidence: `catalogue-server-test-results.json`, `catalogue-ui-results.json`, `check-catalogue-ui.cjs` and the four `catalogue-*-verified.png` screenshots. Browser screenshots show the real built interface with demonstration records, not production edits.

## Integration and release boundaries

1. Review and include **all** current source changes and new shared files. They work together; deploying only the admin UI would leave alternate entry routes inconsistent.
2. Preserve current production records. Obtain a dry-run inventory of actual orders, work items, method defaults, result units, packages and mappings before catalogue migration. Review the 38 synthetic codes and 12 imported definitions individually; disable new ordering or create properly specified revisions while retaining their historical identities.
3. Do not run a force-clean seed against production. The current seeder is not a reconciliation migration for the live 216-entry catalogue. A migration must be idempotent, produce a record-level change report and preserve or explicitly correct existing evidence.
4. Check every active lab’s default methods for ambiguity and missing configuration. The new guard deliberately exposes invalid defaults rather than continuing to assign an arbitrary method. Existing queued work keeps its assigned method ID.
5. Complete the remaining v3 work: typed result schemas, procedure-specific dependencies, durable method batches, atomic texture panels/derived classes, full cross-surface approval/amendment/report checks and actionable dashboard landing states. These were **not** all implemented by this catalogue pass.
6. Verify deployed role behaviour with reception, technician, manager and administrator accounts after migration and deployment. Source tests and fixture-browser checks do not establish defect-free production operation.

These corrections are a tested foundation for the full redesign, not a declaration that every laboratory workflow or every catalogue method is finished.
