# Current source, tour destinations and coverage

Read-only audit baseline: **c996beb**, 6 September 2026. Source inspected in `C:\Users\yigin\Documents\soilfer-lims`. No production/deployed-version certification was performed for this new tutorial request. Reconcile the latest branch and server before implementation.

## Main-story coverage

| Feature | Main scene | Real source/destination | Integration requirement |
|---|---|---|---|
| Login, roles, multilingual interface | 1 | `client/src/pages/Login.jsx`, AuthContext, LanguageContext; `/login` | Login currently navigates to `/` after authentication. Preserve permitted tour intent. Current fallback languages EN/ES/FR/PT; validate active translations. Do not reveal credentials. |
| Role-specific opening work | 2 | `Dashboard.jsx`, dashboard service; `/` | Anchor the real role queue and use exactly five demo records, not overall production counts. |
| SOILFER-US project / Kobo context | 3 | `Projects.jsx`, project manifest API, `koboService.js`, `koboScheduler.js`, `koboController.js` | Current project UI can expose configuration/token fields. Tour should target redacted provenance, never credential settings. |
| Field data and identity | 3 | `SampleDetail.jsx` **tab=request**, field data controls; `/samples/:id?tab=request` | The valid current tab is `request`, not a guessed `details`. Confirm anchor placement and field drawer's read-only behaviour. |
| Reception, quantities, requested analyses, receipts | 4 | `Reception.jsx`; `/reception?sampleId=:id` | Current intake is primarily per-sample. Show one real form and all five verified receipts; do not fake a bulk-accept control. |
| Assignment | 5 | `ManagerQueue.jsx`; `/manager-queue`; Sample assignment actions | Respect assigned methods, order revisions and qualified technician. Do not imply one admin can act as every scientific author. |
| Equipment and inventory | 5 | `Equipment.jsx`, `/equipment`; `Inventory.jsx`, `/inventory`; respective route/controller modules | Main story mentions and shows readiness/maintenance and stock/expiry. Use actual read-only records; optional deep dive into lots/equipment. No fake automatic reservation or consumption. |
| Drying and preparation | 6 | Workbench `operations/confirm` path and operational evidence; `/workbench` | Use updated canonical workflow. Five confirmed SOP evidence records must exist. Real operations require elapsed lab time, so use a labelled checkpoint. |
| Analysis bench, safe batch entry | 7 | `TechWorkbench.jsx`, `WorkbenchShell.jsx`, WorksheetArea/editors | Group five by exact method/run; sample IDs stay visible; draft/record/submit distinctions preserved. |
| Texture and analysis catalogue | 7 | TextureEditor, AnalysisConfig/AnalysisManager, grouped order data | One texture group with three fractions and derived class. Existing catalogue should drive methods/names, not tutorial-only hardcoded aliases. |
| MIR/NIR and spectral library | 8 | SpectralIntakeModal, `SpectralLibrary.jsx`, `/spectral-library` | File evidence, exact sample linkage, QC and source metadata. MIR demonstration explains NIR support without pretending five NIR acquisitions also occurred. |
| Scientific review and QA | 9 | `/manager-queue`, `/qa`, submission/review commands | Show submitted evidence and QC, acceptance/return. No fresh sample approval or arbitrary positive status badges. |
| Workflow map | 10 | `SampleWorkflowMap.jsx`; `/samples/:id/map` | Render actual sample dependencies. This feature must appear in the timed main tour. |
| Sample results, reports, traceability | 10 | `SampleDetail.jsx` tab=reports/history; `/result-reports` | Use exact reviewed evidence/report version. Read-only Sample execution surface. No public report publishing/share during meeting. |
| National SIS exchange | 11 | `AdminPanel.jsx` API keys tab; `ApiKeyManager.jsx`; `sisController.js`, `sisRoutes.js`; `/api/v1/data-exchange` | Existing Admin tab does not read `?tab=api-keys`; add a legitimate authorized receiver or open via registered target. Show redacted human-readable preview, never key generation. |
| Pilot next step | 12 | New guide-only summary overlay | A new presentation panel is needed, not a claim that `/tutorial/summary` already exists. Closing wording must match readiness sign-off. |

## Optional questions, without extending the default show

| Area | Detail that remains available |
|---|---|
| Languages | Configured locales, translation coverage and one state-preserving language switch |
| Analysis catalogue | Friendly names, method revisions, group ordering, matrix applicability and instrument eligibility |
| Work management | Technician method runs, returned work, manager exceptions, lab/project scope |
| Equipment | Equipment register, maintenance, calibration/readiness and method eligibility |
| Inventory | Items, lots, quantities, expiry, quarantine and authorized stock movements |
| Projects and field data | Project manifest, Kobo source, collection/field details, map context |
| Spectral library | Original file, curves, replicate, source metadata, QC, model/provenance limits |
| QA and audit | QC records, review history, corrections, immutable historical evidence |
| Reports and data views | Sample reports, laboratory tables, data results, reviewed versus draft evidence |
| Sample custody | Labels, storage location, movements, archiving and disposal under proper authority |
| People and configuration | Staff roles, laboratories, supported languages, naming and configuration |
| SIS / spatial use | Scoped data extraction, GeoJSON, incremental exchange and receiver testing |

The main tour should not open configuration editors, delete/archive data, change staff permissions or consume supplies just to show these options.

## Gaps that affect implementation

1. There is no existing tour engine or stable scene-anchor contract in the reviewed source. Add explicit `data-tour` targets and route readiness hooks.
2. AdminPanel initializes a role-based tab locally. The proposed `?tab=api-keys` destination needs a real authorized receiver. Merely adding a URL will not open that tab.
3. The current Sample tab names are work, review, request, reports and history. Use request for field/intake context.
4. New Workbench operations/queues exist in the current source, so do not restore the earlier faulty version from older planning packets. Read the live implementation before wiring targets.
5. Existing docs/book usage instructions mention a generic Settings/Kobo page. Current project/config code is more specific; implementation must follow actual routing rather than blindly narrate documentation menu names.
6. Kobo scheduled sync iterates active configs and performs sample writes. Disable production/test-form crossovers and the real scheduler in an offline rehearsal replay.
7. SIS default sample filtering is not “approved only”; `getResultsMatrix` and detailed sample formatting have different output shapes. Establish and test the exact story projection, scopes and released-data policy. A response received by LIMS is not evidence of successful national ingestion.
8. The English mockup has common navigation context and simulated role labels. The real tour must preserve actual RBAC menus and use genuine isolated persona sessions. It must never add forbidden items to a real user's sidebar.
9. Tour support is not proof the platform is ready for unsupervised production use. Readiness is a separate agreed pilot decision based on current workflow, evidence, backup and integration tests.

## Sources used for the integration story

- Local source above, plus `docs/nsis-exchange-v1.md`, read as an intended contract and checked against the controller; not accepted as proof of live interoperability.
- Kobo's official documentation describes authenticated extraction and integration of form data. That supports the field-data story; the LIMS-specific mapping and actual sync status still come from the application. [KoboToolbox: Getting started with the API](https://support.kobotoolbox.org/api.html).

No assertion of GloSIS certification, national ingestion, universal approval-only export or validated spectral prediction is made by this presentation package.
