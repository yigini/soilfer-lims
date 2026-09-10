# Commissioned content inventory

96 distinct task briefs across 12 topics. Eight have full English design exemplars; the remainder still require writing and verification. Every active capability needs coverage before final completion. P0 is sequencing, not permission to omit P1. Five complete language versions are required.

## Getting started

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Sign in and check your laboratory** (start-first-login) | Identify account, laboratory and assigned role before work. | Account is correct but the laboratory is wrong. | P0 |
| **Your first shift as a technician** (start-technician) | Follow assigned work from preparation to reviewer handoff using five demo samples. | A completed worksheet is mistaken for submitted work. | P0 |
| **Your first shift at the intake desk** (start-reception) | Match physical material to project records and finish a documented receipt. | An expected field sample is counted as physically received. | P0 |
| **Your first shift as a laboratory manager** (start-manager) | Distinguish intake review, assignment, result review and final release. | The manager opens the wrong queue and sees no work. | P0 |
| **Follow a project through the laboratory** (start-project) | Read project progress and identify who owns the next action. | KoBo import is mistaken for completed analysis. | P1 |
| **Inspect laboratory work without changing it** (start-auditor) | Follow the evidence and report history within audit scope. | An audit viewer expects edit controls. | P1 |
| **Find and read the results shared with you** (start-viewer) | Navigate permitted records and distinguish current from superseded reports. | A viewer cannot see another project's data. | P1 |
| **Choose language, appearance and profile preferences** (start-settings) | Apply session or profile settings without changing laboratory data. | A language switch appears to change a displayed number. | P0 |

Candidate evidence: `client/src/App.jsx`, `client/src/pages/Profile.jsx`, `server/config/roles.js`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Receiving samples

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Receive a project sample** (intake-project) | Follow ID & Field, Condition, Analyses and Handover using a synthetic project sample. | The label matches a field ID but not the displayed laboratory ID. | P0 |
| **Receive several project samples together** (intake-batch) | Review each matched sample and isolate exceptions during batch intake. | One damaged or missing sample blocks a whole delivery. | P0 |
| **Save and resume an intake draft** (intake-draft) | Identify draft owner, restore state and verify that saving did not receive material. | A reopened draft loses its source location. | P0 |
| **Resolve missing or conflicting location information** (intake-location) | Trace coordinates and locality to the linked source without guessing. | Source coordinates exist but the form says no location. | P0 |
| **Record mass, condition and nonconformance** (intake-condition) | Explain the condition fields, evidence and permitted exception handling. | A mass deficit is present or the container is damaged. | P1 |
| **Select the requested analyses correctly** (intake-analysis) | Use parameter names, method variants and grouped panels before handover. | Texture fractions appear as three separate choices. | P0 |
| **Resolve an unknown or duplicate sample identifier** (intake-duplicate) | Compare label, source and existing records without creating a second intake. | A scan returns two candidates or none. | P1 |
| **Finish receipt and verify the handover** (intake-handover) | Identify final receipt action, receipt evidence and the next responsible role. | A draft is saved but the receiving queue has not changed. | P0 |

Candidate evidence: `client/src/pages/Reception.jsx`, `client/src/components/reception/BatchIntake.jsx`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Sample identity and tracking

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Understand laboratory, field and internal identifiers** (tracking-identifiers) | Show a synthetic label and explain which identifier to use in each context. | A UUID is confused with the human-readable sample number. | P0 |
| **Find a sample and preserve useful filters** (tracking-find) | Search by supported identifiers and inspect the correct project/lab context. | A retained filter hides an expected sample. | P1 |
| **Read the sample page without repeating result entry** (tracking-workspace) | Explain work, results, evidence, field data and authoritative links to Workbench. | Sample status and a task status appear different. | P0 |
| **Read the workflow map and its dependencies** (tracking-map) | Explain nodes, gates, current blockers, navigation and completion meaning. | A future analysis appears before preparation is complete. | P0 |
| **Scan and print the correct sample label** (tracking-labels) | Compare scan result, label preview and sample identity before printing. | The scanner reads an old or ambiguous label. | P1 |
| **Follow sample storage and movement history** (tracking-storage) | Explain permitted storage changes, retained portions and custody evidence. | A sample's physical shelf differs from the recorded location. | P1 |

Candidate evidence: `client/src/pages/SampleDetail.jsx`, `client/src/pages/SampleWorkflowMap.jsx`, `client/src/components/sample/WorkItemsTable.jsx`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Drying and preparation

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Confirm sample drying and find its receipt** (prep-drying) | Name the checklist controls and Confirm Complete; show Checklist Verified. | Ticked checklist items have not produced a confirmation receipt. | P0 |
| **Confirm preparation for the assigned method** (prep-preparation) | Check the applicable preparation steps and record completion for the correct material. | An analysis requires a different preparation pathway. | P0 |
| **Preparation looks incomplete after confirmation** (prep-receipt) | Use the receipt, selected attempt and prerequisite state to diagnose the contradiction. | Workbench and sample page disagree after a confirmed operation. | P0 |
| **Confirm preparation for several samples safely** (prep-batch) | Compare selected items and each sample's evidence before a permitted bulk action. | One selected sample was not physically prepared. | P1 |
| **Resolve a legacy completion with missing evidence** (prep-evidence) | Explain the evidence-gap state and who may document verification or a new attempt. | A legacy Done flag exists without a checklist receipt. | P0 |
| **Handle repeated or corrected preparation** (prep-repeat) | Preserve original evidence and route a permitted new preparation attempt. | Staff attempt to overwrite the old confirmation. | P1 |

Candidate evidence: `client/src/components/workbench/OperationalTaskEditor.jsx`, `client/src/components/workbench/WorkbenchShell.jsx`, `server/services/workbenchReadinessService.js`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Results at the bench

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Find the work assigned to you** (bench-find) | Explain queue filters, method groups, priority and selected task context. | A reassigned task disappears from the technician queue. | P1 |
| **Record and submit a batch of results** (bench-batch) | Work through a forty-row same-method example with reconciliation and handoff. | Thirty-eight rows are eligible and two must be excluded. | P0 |
| **Enter one result with its required metadata** (bench-single) | Explain identity, method, unit/basis, instrument and saved draft state. | A required basis or instrument is missing. | P1 |
| **Paste results and review matches before applying** (bench-paste) | Give literal tab-separated ID/value examples and duplicate/exclusion recovery. | Two rows map to the same work item or a sample is unassigned. | P0 |
| **Understand saved, recorded, submitted and accepted** (bench-states) | Use a state/actor/evidence table and a concrete reviewer handoff. | The manager cannot see a result that is only saved. | P0 |
| **Submit recorded determinations for review** (bench-submit) | Name Ready to Submit, the confirmation and sample submission receipt. | A partial submission is confused with all analyses being complete. | P0 |
| **Correct work returned by a reviewer** (bench-returned) | Follow the return reason and eligible correction attempt without changing history. | The old result is sealed and cannot be edited. | P0 |
| **Find out why result entry is blocked** (bench-blocked) | Use authoritative receipt/preparation/assignment/equipment reasons. | Staff try another screen to bypass the same blocker. | P0 |
| **Enter qualifiers and missing results correctly** (bench-qualifiers) | Explain supported less-than, not-measured and missing-value semantics by schema. | Zero is used to stand for an unmeasured sample. | P1 |
| **Recover from a save conflict or uncertain request** (bench-concurrent) | Preserve input, inspect server revision and reconcile without duplicate submission. | Another technician changed the task while the worksheet was open. | P1 |

Candidate evidence: `client/src/components/workbench/WorkbenchShell.jsx`, `client/src/components/workbench/WorksheetArea.jsx`, `client/src/components/workbench/PastePreviewModal.jsx`, `client/src/components/workbench/ReviewSubmissionView.jsx`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Methods, panels and spectra

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Record pH with the correct method and basis** (method-ph) | Explain the configured pH variant, result entry and QC links without prescribing a new SOP. | Water and salt-solution pH variants are mixed in one batch. | P1 |
| **Record electrical conductivity and units** (method-ec) | Tie result value, configured unit, extraction basis and conversion provenance. | Values from different unit scales are pasted together. | P1 |
| **Report sand, silt and clay as one panel** (method-texture) | Explain joint validation, configured fraction boundaries and derived texture class. | Fractions do not close within the configured tolerance. | P0 |
| **Read calculated results and their inputs** (method-derived) | Trace formula/version and contributing values without manually overriding derived outputs. | An upstream result correction changes a derived value. | P1 |
| **Use categorical, text and compound result fields** (method-other-inputs) | Describe actual enabled input schemas and required groups. | A numerical field is wrongly assumed for every parameter. | P1 |
| **Import MIR or NIR spectra for assigned work** (method-spectral-import) | Follow Identify & Upload, Match & Inspect, Confirm Import and Receipt. | An unsupported export, unmatched ID or rejected scan remains unresolved. | P0 |
| **Inspect and compare spectra in the library** (method-spectral-inspect) | Explain axes, acquisition metadata, replicates, QC and original files. | A successful upload is mistaken for accepted spectral quality. | P0 |
| **Distinguish predictions from measured reference results** (method-predictions) | Trace model/version, applicability and review before reporting. | A model prediction is labeled as a wet-chemistry measurement. | P1 |
| **Record controls, duplicates and repeat measurements** (method-qc) | Identify actual run/reference roles and method-specific QC evaluation. | A failed control is ignored while reporting sample results. | P1 |

Candidate evidence: `client/src/components/workbench/SpectralIntakeModal.jsx`, `client/src/pages/SpectralLibrary.jsx`, `client/src/context/AnalysisCatalogueContext.jsx`, `server/services/workbenchReadinessService.js`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Review and reporting

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Review an intake and its exceptions** (review-intake) | Check received evidence, analysis scope and unresolved nonconformance. | A newly expected sample is mistaken for completed lab work. | P1 |
| **Assign work without losing dependencies** (review-assign) | Match technician, method capability, workload and prerequisites. | Assignment exists but preparation has not been confirmed. | P1 |
| **Review a technician's submitted results** (review-submission) | Open the submitted version, inspect evidence and record a permitted decision. | A recorded but unsubmitted result is offered for acceptance. | P0 |
| **Return work with a useful correction request** (review-return) | Specify the affected task, reason, next actor and expected evidence. | An ambiguous return note leads to another incorrect submission. | P1 |
| **Complete final approval only when requirements are met** (review-final) | Explain approval capability, completeness and excluded/waived work. | The approval button is disabled by an unresolved prerequisite. | P0 |
| **Generate and verify the current result report** (review-report) | Select the proper approved scope and inspect methods, units and versions. | The report omits a derived texture class or uses an old result. | P0 |
| **Correct an approved result through an amendment** (review-amend) | Preserve old values, reason, re-review and replacement report lineage. | Staff attempt to edit a released result in place. | P0 |
| **Share a report with the correct audience** (review-share) | Check scope, language, report revision and link validity. | An expired or superseded public report link is forwarded. | P1 |
| **Understand partial submissions and partial reports** (review-partial) | Explain which analyses are included and what remains outstanding. | A partial review is taken as final approval of the entire sample. | P1 |

Candidate evidence: `client/src/pages/ManagerQueue.jsx`, `client/src/components/sample/SubmissionPanel.jsx`, `client/src/pages/ResultReports.jsx`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Equipment and stock

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Find an instrument suitable for the method** (assets-find) | Read instrument identity, lab, eligibility and availability. | The desired instrument is absent from the selector. | P1 |
| **Check calibration and service eligibility** (assets-calibration) | Locate current evidence and explain who can update it. | Calibration is overdue or a service hold prevents use. | P1 |
| **Record equipment maintenance and return to service** (assets-maintain) | Document maintenance evidence and permitted status transitions. | A technician attempts to clear a hold without authority. | P1 |
| **Register or update laboratory equipment** (assets-register) | Explain identity, supported method links and duplicate prevention. | One physical instrument is registered twice. | P1 |
| **Select and trace a reagent or consumable lot** (assets-lots) | Connect lot identity, expiry and quantity to the applicable work. | An expired lot is selected for a new run. | P1 |
| **Receive stock and record a quantity movement** (assets-stock) | Show actual inventory movement and unit semantics. | A unit mismatch changes available stock unexpectedly. | P1 |
| **Handle low, expired or quarantined stock** (assets-expiry) | Identify allowed replacement/escalation while preserving traceability. | A low-stock warning is confused with permission to use expired material. | P1 |
| **Trace equipment and material usage to results** (assets-trace) | Follow a run's instrument and lot history for a review. | A recalled lot may affect several results. | P1 |

Candidate evidence: `client/src/pages/Equipment.jsx`, `client/src/pages/Inventory.jsx`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Mobile and offline work

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Use the mobile app layout and installation options** (offline-install) | Explain supported browser/PWA entry and permissions without promising an app-store build. | A browser shortcut is mistaken for guaranteed offline readiness. | P1 |
| **Prepare the device and download permitted work** (offline-prepare) | Check account/lab, work pack, assets and supported action list before disconnecting. | The app opens but the assigned task was never downloaded. | P0 |
| **Record permitted work while disconnected** (offline-record) | Distinguish a device draft, queued action and confirmed server state. | The technician expects an offline submission to be visible to the manager. | P0 |
| **Synchronize and verify each queued action** (offline-sync) | Review pending/succeeded/failed receipts without blindly retrying. | Some actions synchronized and one attachment failed. | P0 |
| **Resolve an offline conflict after reconnecting** (offline-conflict) | Compare local/server changes and use the permitted reconciliation. | A task was reassigned or approved while the device was offline. | P0 |
| **Change account or lab without exposing cached work** (offline-account) | Explain offline authorization and preservation/clearance behavior. | A shared device displays another user's lab-specific guidance. | P0 |
| **Download and use Help without a connection** (offline-help) | Explain cached language/release, missing figures and stale-content notices. | Help is downloaded but the related lab action requires a connection. | P1 |

Candidate evidence: `client/src/context/SyncContext.jsx`, `client/src/services/offline/offlineDb.js`, `client/src/components/mobile`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Projects, fieldwork and connections

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Create or configure a project within your scope** (connect-project) | Explain project identity, country/lab scope and enabled data flows. | A lab cannot access a project assigned elsewhere. | P1 |
| **Import and inspect KoBo field records** (connect-kobo) | Trace form/submission IDs, synchronization state and source ownership. | An imported submission is mistaken for received material. | P1 |
| **Correct field provenance through its owner** (connect-field-fix) | Explain where source corrections belong and how reconciliation works. | An intake edit would overwrite the original survey record. | P1 |
| **Prepare field records for laboratory handover** (connect-surveyor) | Validate identifiers and source completeness before the lab receives material. | A duplicate source submission creates an ambiguous handover. | P1 |
| **Read project and national progress correctly** (connect-progress) | Distinguish expected, received, active, submitted, approved and reported counts. | Different filters or lab scopes make dashboards appear contradictory. | P1 |
| **Filter and export authorized results** (connect-export) | Explain exported revision, units, scope and raw versus interpreted data. | A filtered screen exports a broader set than expected. | P1 |
| **Verify an SIS export or delivery** (connect-sis) | Distinguish a generated file from confirmed external delivery and a rejected transfer. | A retry risks duplicate delivery or uses a superseded report. | P1 |
| **Read maps and missing-location states** (connect-map) | Explain coordinates, location confidence and display limitations. | Missing GPS is presented as a zero coordinate. | P1 |

Candidate evidence: `client/src/pages/Projects.jsx`, `client/src/pages/DataResults.jsx`, `client/src/pages/CountryData.jsx`, `docs/book/src/usage/kobotoolbox.md`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Management and configuration

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Configure a laboratory and its scope** (admin-labs) | Explain lab identity, configuration ownership and changes affecting users. | The lab configuration is mistaken for an individual sample ID. | P1 |
| **Create or update a user's permitted access** (admin-users) | Use the actual role/capability model and lab assignments. | A role label is changed without the required lab scope. | P1 |
| **Understand each role and its permissions** (admin-role-reference) | Provide the ten-role reference and explain missing actions without granting access. | A viewer tries to approve a result. | P1 |
| **Configure an analysis without breaking existing work** (admin-catalogue) | Trace selection, input schema, prerequisites, methods and reports. | A code-only catalogue entry creates an unusable worksheet. | P1 |
| **Configure method variants, outputs and prerequisites** (admin-methods) | Explain checklist/numeric/panel/file contracts and revision compatibility. | A method change would reinterpret old approved results. | P1 |
| **Correct a translation without changing scientific meaning** (admin-translation) | Use terminology groups, source/locale review and published display names. | A translated label changes a scientific code or unit. | P0 |
| **Configure laboratory identity and report branding** (admin-branding) | Explain which changes affect application display or generated reports. | An image update makes dark-mode text illegible. | P1 |
| **Configure integrations and protect credentials** (admin-integrations) | Document permitted setup/testing and secret handling separately from operator use. | An API credential is pasted into a support request. | P1 |
| **Import historical data with traceability** (admin-legacy) | Explain validation, mapping, duplicates and legacy evidence gaps. | Imported completion flags are treated as verified new measurements. | P1 |
| **Write, translate and publish useful Help** (admin-help) | Use structured blocks, evidence, scoped notes and a release manifest. | Help buttons ship while every article is still a draft. | P0 |
| **Set support contacts and triage feedback** (admin-support) | Configure real recipients, scope, availability and article feedback ownership. | The app claims a support message was sent when only a draft exists. | P1 |

Candidate evidence: `client/src/pages/AdminPanel.jsx`, `client/src/pages/admin/LabManagement.jsx`, `client/src/components/TranslationEditor.jsx`, `server/config/roles.js`, `client/src/pages/help/AdminHelpEditor.jsx`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

## Quality, audit and recovery

| Guide | User outcome | Failure to explain | Priority |
|---|---|---|---|
| **Find who changed a record and why** (quality-audit) | Filter actor/time/entity and connect changes to the correct sample/result version. | A count-only audit omits changed values. | P1 |
| **Interpret quality-control alerts and their ownership** (quality-qc) | Explain active QC evidence, affected work and permitted next decisions. | A passed file import is mistaken for passed analytical QC. | P1 |
| **Record and follow a nonconformance** (quality-nc) | Document problem, containment, owner and evidence without changing results silently. | A discrepancy is closed without a documented resolution. | P1 |
| **Trace a result through repeats and report revisions** (quality-history) | Follow original measurement, amended values and superseded reports. | An old public report is used after a correction. | P1 |
| **Recover from a blank page or failed application update** (quality-loading) | Protect drafts and use verified retry/update behavior before escalating. | Repeated refresh or storage clearing loses unsynchronized work. | P0 |
| **Report a problem with useful, minimal evidence** (quality-support) | Prepare page/context, time, version and relevant receipt for the correct support role. | A screenshot exposes credentials or unnecessary sample data. | P0 |

Candidate evidence: `client/src/pages/QADashboard.jsx`, `client/src/pages/AuditLogs.jsx`, `client/src/components/sample/EvidenceInspectionModal.jsx`, `docs/book/src/usage/qc-management.md`. Verify file existence and follow imports/handlers; candidate references are not proof of behavior.

Use the JSON for route associations, full role identifiers, evidence status and acceptance requirements.
