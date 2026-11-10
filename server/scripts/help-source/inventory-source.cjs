// Editorial briefs, not completed or approved articles. Kept separate from runtime LIMS content.
module.exports = [
{id:'start',title:'Getting started',roles:['ALL'],sources:['client/src/App.jsx','client/src/pages/Profile.jsx','server/config/roles.js'],rows:`
start-first-login|Sign in and check your laboratory|Identify account, laboratory and assigned role before work.|Account is correct but the laboratory is wrong.|/login,/profile
start-technician|Your first shift as a technician|Follow assigned work from preparation to reviewer handoff using five demo samples.|A completed worksheet is mistaken for submitted work.|/workbench
start-reception|Your first shift at the intake desk|Match physical material to project records and finish a documented receipt.|An expected field sample is counted as physically received.|/reception
start-manager|Your first shift as a laboratory manager|Distinguish intake review, assignment, result review and final release.|The manager opens the wrong queue and sees no work.|/manager-queue,/
start-project|Follow a project through the laboratory|Read project progress and identify who owns the next action.|KoBo import is mistaken for completed analysis.|/projects,/data-results
start-auditor|Inspect laboratory work without changing it|Follow the evidence and report history within audit scope.|An audit viewer expects edit controls.|/qa,/admin/audit
start-viewer|Find and read the results shared with you|Navigate permitted records and distinguish current from superseded reports.|A viewer cannot see another project's data.|/samples,/result-reports
start-settings|Choose language, appearance and profile preferences|Apply session or profile settings without changing laboratory data.|A language switch appears to change a displayed number.|/profile
`},
{id:'intake',title:'Receiving samples',roles:['SAMPLE_RECEPTION','LAB_MANAGER'],sources:['client/src/pages/Reception.jsx','client/src/components/reception/BatchIntake.jsx'],rows:`
intake-project|Receive a project sample|Follow ID & Field, Condition, Analyses and Handover using a synthetic project sample.|The label matches a field ID but not the displayed laboratory ID.|/reception
intake-batch|Receive several project samples together|Review each matched sample and isolate exceptions during batch intake.|One damaged or missing sample blocks a whole delivery.|/reception
intake-draft|Save and resume an intake draft|Identify draft owner, restore state and verify that saving did not receive material.|A reopened draft loses its source location.|/reception
intake-location|Resolve missing or conflicting location information|Trace coordinates and locality to the linked source without guessing.|Source coordinates exist but the form says no location.|/reception,/samples/:id
intake-condition|Record mass, condition and nonconformance|Explain the condition fields, evidence and permitted exception handling.|A mass deficit is present or the container is damaged.|/reception
intake-analysis|Select the requested analyses correctly|Use parameter names, method variants and grouped panels before handover.|Texture fractions appear as three separate choices.|/reception
intake-duplicate|Resolve an unknown or duplicate sample identifier|Compare label, source and existing records without creating a second intake.|A scan returns two candidates or none.|/reception,/scan
intake-handover|Finish receipt and verify the handover|Identify final receipt action, receipt evidence and the next responsible role.|A draft is saved but the receiving queue has not changed.|/reception
`},
{id:'tracking',title:'Sample identity and tracking',roles:['ALL'],sources:['client/src/pages/SampleDetail.jsx','client/src/pages/SampleWorkflowMap.jsx','client/src/components/sample/WorkItemsTable.jsx'],rows:`
tracking-identifiers|Understand laboratory, field and internal identifiers|Show a synthetic label and explain which identifier to use in each context.|A UUID is confused with the human-readable sample number.|/samples,/samples/:id,/scan
tracking-find|Find a sample and preserve useful filters|Search by supported identifiers and inspect the correct project/lab context.|A retained filter hides an expected sample.|/samples
tracking-workspace|Read the sample page without repeating result entry|Explain work, results, evidence, field data and authoritative links to Workbench.|Sample status and a task status appear different.|/samples/:id
tracking-map|Read the workflow map and its dependencies|Explain nodes, gates, current blockers, navigation and completion meaning.|A future analysis appears before preparation is complete.|/samples/:id/map,/workflow-map
tracking-labels|Scan and print the correct sample label|Compare scan result, label preview and sample identity before printing.|The scanner reads an old or ambiguous label.|/scan,/samples/:id
tracking-storage|Follow sample storage and movement history|Explain permitted storage changes, retained portions and custody evidence.|A sample's physical shelf differs from the recorded location.|/samples/:id
`},
{id:'preparation',title:'Drying and preparation',roles:['LAB_TECHNICIAN','LAB_MANAGER'],sources:['client/src/components/workbench/OperationalTaskEditor.jsx','client/src/components/workbench/WorkbenchShell.jsx','server/services/workbenchReadinessService.js'],rows:`
prep-drying|Confirm sample drying and find its receipt|Name the checklist controls and Confirm Complete; show Checklist Verified.|Ticked checklist items have not produced a confirmation receipt.|/workbench
prep-preparation|Confirm preparation for the assigned method|Check the applicable preparation steps and record completion for the correct material.|An analysis requires a different preparation pathway.|/workbench
prep-receipt|Preparation looks incomplete after confirmation|Use the receipt, selected attempt and prerequisite state to diagnose the contradiction.|Workbench and sample page disagree after a confirmed operation.|/workbench,/samples/:id
prep-batch|Confirm preparation for several samples safely|Compare selected items and each sample's evidence before a permitted bulk action.|One selected sample was not physically prepared.|/workbench
prep-evidence|Resolve a legacy completion with missing evidence|Explain the evidence-gap state and who may document verification or a new attempt.|A legacy Done flag exists without a checklist receipt.|/workbench,/manager-queue
prep-repeat|Handle repeated or corrected preparation|Preserve original evidence and route a permitted new preparation attempt.|Staff attempt to overwrite the old confirmation.|/workbench,/samples/:id
`},
{id:'bench',title:'Results at the bench',roles:['LAB_TECHNICIAN','LAB_MANAGER'],sources:['client/src/components/workbench/WorkbenchShell.jsx','client/src/components/workbench/WorksheetArea.jsx','client/src/components/workbench/PastePreviewModal.jsx','client/src/components/workbench/ReviewSubmissionView.jsx'],rows:`
bench-find|Find the work assigned to you|Explain queue filters, method groups, priority and selected task context.|A reassigned task disappears from the technician queue.|/workbench,/my-work
bench-batch|Record and submit a batch of results|Work through a forty-row same-method example with reconciliation and handoff.|Thirty-eight rows are eligible and two must be excluded.|/workbench
bench-single|Enter one result with its required metadata|Explain identity, method, unit/basis, instrument and saved draft state.|A required basis or instrument is missing.|/workbench
bench-paste|Paste results and review matches before applying|Give literal tab-separated ID/value examples and duplicate/exclusion recovery.|Two rows map to the same work item or a sample is unassigned.|/workbench
bench-states|Understand saved, recorded, submitted and accepted|Use a state/actor/evidence table and a concrete reviewer handoff.|The manager cannot see a result that is only saved.|/workbench,/samples/:id
bench-submit|Submit recorded determinations for review|Name Ready to Submit, the confirmation and sample submission receipt.|A partial submission is confused with all analyses being complete.|/workbench
bench-returned|Correct work returned by a reviewer|Follow the return reason and eligible correction attempt without changing history.|The old result is sealed and cannot be edited.|/workbench,/manager-queue
bench-blocked|Find out why result entry is blocked|Use authoritative receipt/preparation/assignment/equipment reasons.|Staff try another screen to bypass the same blocker.|/workbench
bench-qualifiers|Enter qualifiers and missing results correctly|Explain supported less-than, not-measured and missing-value semantics by schema.|Zero is used to stand for an unmeasured sample.|/workbench
bench-concurrent|Recover from a save conflict or uncertain request|Preserve input, inspect server revision and reconcile without duplicate submission.|Another technician changed the task while the worksheet was open.|/workbench
`},
{id:'methods',title:'Methods, panels and spectra',roles:['LAB_TECHNICIAN','LAB_MANAGER','SUPER_ADMIN'],sources:['client/src/components/workbench/SpectralIntakeModal.jsx','client/src/pages/SpectralLibrary.jsx','client/src/context/AnalysisCatalogueContext.jsx','server/services/workbenchReadinessService.js'],rows:`
method-ph|Record pH with the correct method and basis|Explain the configured pH variant, result entry and QC links without prescribing a new SOP.|Water and salt-solution pH variants are mixed in one batch.|/workbench,/admin/methods
method-ec|Record electrical conductivity and units|Tie result value, configured unit, extraction basis and conversion provenance.|Values from different unit scales are pasted together.|/workbench
method-texture|Report sand, silt and clay as one panel|Explain joint validation, configured fraction boundaries and derived texture class.|Fractions do not close within the configured tolerance.|/workbench,/samples/:id
method-derived|Read calculated results and their inputs|Trace formula/version and contributing values without manually overriding derived outputs.|An upstream result correction changes a derived value.|/samples/:id,/workbench
method-other-inputs|Use categorical, text and compound result fields|Describe actual enabled input schemas and required groups.|A numerical field is wrongly assumed for every parameter.|/workbench,/admin
method-spectral-import|Import MIR or NIR spectra for assigned work|Follow Identify & Upload, Match & Inspect, Confirm Import and Receipt.|An unsupported export, unmatched ID or rejected scan remains unresolved.|/workbench
method-spectral-inspect|Inspect and compare spectra in the library|Explain axes, acquisition metadata, replicates, QC and original files.|A successful upload is mistaken for accepted spectral quality.|/spectral-library
method-predictions|Distinguish predictions from measured reference results|Trace model/version, applicability and review before reporting.|A model prediction is labeled as a wet-chemistry measurement.|/spectral-library,/data-results
method-qc|Record controls, duplicates and repeat measurements|Identify actual run/reference roles and method-specific QC evaluation.|A failed control is ignored while reporting sample results.|/workbench,/qa
`},
{id:'review',title:'Review and reporting',roles:['LAB_MANAGER','AUDIT_USER','MASTER_USER'],sources:['client/src/pages/ManagerQueue.jsx','client/src/components/sample/SubmissionPanel.jsx','client/src/pages/ResultReports.jsx'],rows:`
review-intake|Review an intake and its exceptions|Check received evidence, analysis scope and unresolved nonconformance.|A newly expected sample is mistaken for completed lab work.|/manager-queue
review-assign|Assign work without losing dependencies|Match technician, method capability, workload and prerequisites.|Assignment exists but preparation has not been confirmed.|/manager-queue
review-submission|Review a technician's submitted results|Open the submitted version, inspect evidence and record a permitted decision.|A recorded but unsubmitted result is offered for acceptance.|/manager-queue
review-return|Return work with a useful correction request|Specify the affected task, reason, next actor and expected evidence.|An ambiguous return note leads to another incorrect submission.|/manager-queue
review-final|Complete final approval only when requirements are met|Explain approval capability, completeness and excluded/waived work.|The approval button is disabled by an unresolved prerequisite.|/manager-queue,/samples/:id
review-report|Generate and verify the current result report|Select the proper approved scope and inspect methods, units and versions.|The report omits a derived texture class or uses an old result.|/result-reports
review-amend|Correct an approved result through an amendment|Preserve old values, reason, re-review and replacement report lineage.|Staff attempt to edit a released result in place.|/samples/:id,/result-reports
review-share|Share a report with the correct audience|Check scope, language, report revision and link validity.|An expired or superseded public report link is forwarded.|/result-reports,/report/:token
review-partial|Understand partial submissions and partial reports|Explain which analyses are included and what remains outstanding.|A partial review is taken as final approval of the entire sample.|/manager-queue,/result-reports
`},
{id:'assets',title:'Equipment and stock',roles:['LAB_TECHNICIAN','LAB_MANAGER','SUPER_ADMIN'],sources:['client/src/pages/Equipment.jsx','client/src/pages/Inventory.jsx'],rows:`
assets-find|Find an instrument suitable for the method|Read instrument identity, lab, eligibility and availability.|The desired instrument is absent from the selector.|/equipment,/workbench
assets-calibration|Check calibration and service eligibility|Locate current evidence and explain who can update it.|Calibration is overdue or a service hold prevents use.|/equipment
assets-maintain|Record equipment maintenance and return to service|Document maintenance evidence and permitted status transitions.|A technician attempts to clear a hold without authority.|/equipment
assets-register|Register or update laboratory equipment|Explain identity, supported method links and duplicate prevention.|One physical instrument is registered twice.|/equipment
assets-lots|Select and trace a reagent or consumable lot|Connect lot identity, expiry and quantity to the applicable work.|An expired lot is selected for a new run.|/inventory,/workbench
assets-stock|Receive stock and record a quantity movement|Show actual inventory movement and unit semantics.|A unit mismatch changes available stock unexpectedly.|/inventory
assets-expiry|Handle low, expired or quarantined stock|Identify allowed replacement/escalation while preserving traceability.|A low-stock warning is confused with permission to use expired material.|/inventory
assets-trace|Trace equipment and material usage to results|Follow a run's instrument and lot history for a review.|A recalled lot may affect several results.|/inventory,/equipment,/qa
`},
{id:'offline',title:'Mobile and offline work',roles:['LAB_TECHNICIAN','SAMPLE_RECEPTION','LAB_MANAGER'],sources:['client/src/context/SyncContext.jsx','client/src/services/offline/offlineDb.js','client/src/components/mobile'],rows:`
offline-install|Use the mobile app layout and installation options|Explain supported browser/PWA entry and permissions without promising an app-store build.|A browser shortcut is mistaken for guaranteed offline readiness.|/profile
offline-prepare|Prepare the device and download permitted work|Check account/lab, work pack, assets and supported action list before disconnecting.|The app opens but the assigned task was never downloaded.|/workbench
offline-record|Record permitted work while disconnected|Distinguish a device draft, queued action and confirmed server state.|The technician expects an offline submission to be visible to the manager.|/workbench,/reception
offline-sync|Synchronize and verify each queued action|Review pending/succeeded/failed receipts without blindly retrying.|Some actions synchronized and one attachment failed.|/workbench
offline-conflict|Resolve an offline conflict after reconnecting|Compare local/server changes and use the permitted reconciliation.|A task was reassigned or approved while the device was offline.|/workbench
offline-account|Change account or lab without exposing cached work|Explain offline authorization and preservation/clearance behavior.|A shared device displays another user's lab-specific guidance.|/profile
offline-help|Download and use Help without a connection|Explain cached language/release, missing figures and stale-content notices.|Help is downloaded but the related lab action requires a connection.|/help
`},
{id:'connect',title:'Projects, fieldwork and connections',roles:['PROJECT_MANAGER','MASTER_USER','SURVEYOR','LAB_MANAGER','SUPER_ADMIN'],sources:['client/src/pages/Projects.jsx','client/src/pages/DataResults.jsx','client/src/pages/CountryData.jsx','docs/book/src/usage/kobotoolbox.md'],rows:`
connect-project|Create or configure a project within your scope|Explain project identity, country/lab scope and enabled data flows.|A lab cannot access a project assigned elsewhere.|/projects
connect-kobo|Import and inspect KoBo field records|Trace form/submission IDs, synchronization state and source ownership.|An imported submission is mistaken for received material.|/projects,/reception
connect-field-fix|Correct field provenance through its owner|Explain where source corrections belong and how reconciliation works.|An intake edit would overwrite the original survey record.|/projects,/samples/:id
connect-surveyor|Prepare field records for laboratory handover|Validate identifiers and source completeness before the lab receives material.|A duplicate source submission creates an ambiguous handover.|/projects,/maps
connect-progress|Read project and national progress correctly|Distinguish expected, received, active, submitted, approved and reported counts.|Different filters or lab scopes make dashboards appear contradictory.|/projects,/,/data-results
connect-export|Filter and export authorized results|Explain exported revision, units, scope and raw versus interpreted data.|A filtered screen exports a broader set than expected.|/data-results,/datasheet
connect-sis|Verify an SIS export or delivery|Distinguish a generated file from confirmed external delivery and a rejected transfer.|A retry risks duplicate delivery or uses a superseded report.|/data-results,/admin
connect-map|Read maps and missing-location states|Explain coordinates, location confidence and display limitations.|Missing GPS is presented as a zero coordinate.|/maps,/samples/:id
`},
{id:'admin',title:'Management and configuration',roles:['SUPER_ADMIN','LAB_MANAGER','MASTER_USER'],sources:['client/src/pages/AdminPanel.jsx','client/src/pages/admin/LabManagement.jsx','client/src/components/TranslationEditor.jsx','server/config/roles.js','client/src/pages/help/AdminHelpEditor.jsx'],rows:`
admin-labs|Configure a laboratory and its scope|Explain lab identity, configuration ownership and changes affecting users.|The lab configuration is mistaken for an individual sample ID.|/admin/labs
admin-users|Create or update a user's permitted access|Use the actual role/capability model and lab assignments.|A role label is changed without the required lab scope.|/users
admin-role-reference|Understand each role and its permissions|Provide the ten-role reference and explain missing actions without granting access.|A viewer tries to approve a result.|/users,/profile
admin-catalogue|Configure an analysis without breaking existing work|Trace selection, input schema, prerequisites, methods and reports.|A code-only catalogue entry creates an unusable worksheet.|/admin?tab=lab-config
admin-methods|Configure method variants, outputs and prerequisites|Explain checklist/numeric/panel/file contracts and revision compatibility.|A method change would reinterpret old approved results.|/admin/methods,/lab-methods
admin-translation|Correct a translation without changing scientific meaning|Use terminology groups, source/locale review and published display names.|A translated label changes a scientific code or unit.|/admin?tab=languages
admin-branding|Configure laboratory identity and report branding|Explain which changes affect application display or generated reports.|An image update makes dark-mode text illegible.|/admin?tab=branding
admin-integrations|Configure integrations and protect credentials|Document permitted setup/testing and secret handling separately from operator use.|An API credential is pasted into a support request.|/admin?tab=api-keys
admin-legacy|Import historical data with traceability|Explain validation, mapping, duplicates and legacy evidence gaps.|Imported completion flags are treated as verified new measurements.|/admin/legacy-import
admin-help|Write, translate and publish useful Help|Use structured blocks, evidence, scoped notes and a release manifest.|Help buttons ship while every article is still a draft.|/admin/help
admin-support|Set support contacts and triage feedback|Configure real recipients, scope, availability and article feedback ownership.|The app claims a support message was sent when only a draft exists.|/admin/help,/admin
`},
{id:'quality',title:'Quality, audit and recovery',roles:['AUDIT_USER','LAB_MANAGER','MASTER_USER','SUPER_ADMIN'],sources:['client/src/pages/QADashboard.jsx','client/src/pages/AuditLogs.jsx','client/src/components/sample/EvidenceInspectionModal.jsx','docs/book/src/usage/qc-management.md'],rows:`
quality-audit|Find who changed a record and why|Filter actor/time/entity and connect changes to the correct sample/result version.|A count-only audit omits changed values.|/admin/audit,/samples/:id
quality-qc|Interpret quality-control alerts and their ownership|Explain active QC evidence, affected work and permitted next decisions.|A passed file import is mistaken for passed analytical QC.|/qa
quality-nc|Record and follow a nonconformance|Document problem, containment, owner and evidence without changing results silently.|A discrepancy is closed without a documented resolution.|/qa,/manager-queue
quality-history|Trace a result through repeats and report revisions|Follow original measurement, amended values and superseded reports.|An old public report is used after a correction.|/samples/:id,/result-reports
quality-loading|Recover from a blank page or failed application update|Protect drafts and use verified retry/update behavior before escalating.|Repeated refresh or storage clearing loses unsynchronized work.|/help,/*
quality-support|Report a problem with useful, minimal evidence|Prepare page/context, time, version and relevant receipt for the correct support role.|A screenshot exposes credentials or unnecessary sample data.|/help
`}
];
