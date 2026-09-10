# SoilFER help: English editorial drafts

These 27 drafts are not approved or published. Verify against the implemented release and controlled laboratory SOPs. Translate and review all five launch languages; see translation-review-matrix.json.

## Getting started

### Start your shift with the right work

`start-shift` · guide · 2 min · Proposed reviewer: Lab operations lead

Check your account, laboratory and assignments before recording anything.

1. Confirm the displayed account and laboratory. Use your own account so the record identifies the person who performed the work.
2. Open the task area available to your role. Read the priority and any blocked-work messages before choosing a sample.
3. Confirm the sample label, requested method and instrument context. Similar field or laboratory identifiers must not be treated as interchangeable.
4. If using supported offline work, check the downloaded work pack and authorization before leaving the connection.

**Success:** The correct sample and method are open under your account, with any blockers clearly understood.

**Keep in mind:** If an assignment or laboratory looks wrong, stop and ask the lab manager to check it.

Related: bench-blocked, offline-prepare

## Receiving samples

### Receive a project sample

`intake-project` · guide · 3 min · Proposed reviewer: Reception lead

Match the physical material to the existing project record before accepting it.

1. Open Reception and select the appropriate project or consignment. Find or scan the sample's field identifier.
2. Compare the displayed project, identifier and field context with the physical label. Do not create another record merely because the expected one is hard to find.
3. Record the actual arrival condition, required quantity information and observations using your lab's intake procedure.
4. Review the requested analyses and required details. Complete the receipt action shown by the current form and check its confirmation.

**Success:** An accepted receipt is visible, or an explicit provisional device receipt is retained when supported offline intake is being used.

**Keep in mind:** A field submission or an expected sample record does not prove that material has physically arrived.

Related: intake-location, intake-identity

### Why is the location missing from an intake draft?

`intake-location` · faq · 2 min · Proposed reviewer: Reception lead

Check the source project record and preserve its field information. Do not guess a location.

1. Confirm that the draft is linked to the intended project sample, rather than a new independent intake.
2. Open the available field data and check whether a location or coordinates exist in the source record.
3. If the source contains the information but the reopened draft does not, preserve the draft and report the discrepancy with the sample identifier through the approved support route.
4. Wait for reconciliation rather than overwriting source coordinates with a guessed location or creating a duplicate intake.

**Success:** The source field context is correctly linked, or the discrepancy is recorded for correction without inventing data.

**Keep in mind:** A missing display value and missing source data are different problems.

Related: intake-project, connect-kobo

### Which sample identifier should I use?

`intake-identity` · faq · 1 min · Proposed reviewer: Reception lead

Use the laboratory identifier for bench work and retain the field identifier for provenance.

1. Read the laboratory sample identifier displayed by the application and compare it with the container label.
2. Use the associated field identifier to confirm the collection record and project. A software UUID is an internal reference, not a substitute for an unclear label.
3. If using a provisional offline intake, follow the displayed temporary-label policy until the server assigns or confirms the official identifier.

**Success:** The container, task and sample record refer to the same specimen.

**Keep in mind:** Do not relabel a sample or merge records without the authorized identity-correction procedure.

Related: intake-project, offline-sync

## Working at the bench

### Why can't I start this analysis?

`bench-blocked` · faq · 2 min · Proposed reviewer: Lab operations lead

Read the current blocker. Receipt, preparation, assignment or equipment may still need attention.

1. Open the work item's readiness details and read the reason shown for this sample and method.
2. Check whether physical receipt is accepted, required operational steps are complete and the work is assigned to you.
3. If an instrument is required, confirm that an eligible instrument is selected and its status is current.
4. Complete only actions permitted to you. Ask the manager or reception team to resolve requirements they own.

**Success:** The work item becomes ready under the current workflow rules, or the responsible colleague has the exact blocker to resolve.

**Keep in mind:** Do not enter a substitute value, alter an unrelated status or repeatedly submit to bypass a blocker.

Related: bench-preparation, assets-instrument, review-returned

### Record sample drying

`bench-drying` · guide · 2 min · Proposed reviewer: Lab operations lead

Record the physical step using the assigned operational checklist and required evidence.

1. Open the drying task for the correct sample or permitted batch in the workbench.
2. Read the assigned drying procedure. Record the conditions, times and evidence required by that procedure.
3. Confirm each checklist item only after performing and checking the physical work.
4. Use the available confirmation action and inspect the resulting receipt or pending synchronization status.

**Success:** The drying confirmation and its evidence are visible with the correct local or server status.

**Keep in mind:** A generic numeric value does not represent completion of a drying checklist. Use the approved SOP for temperatures and endpoints.

Related: bench-preparation, bench-save-submit

### Why does preparation still need attention after I confirm it?

`bench-preparation` · faq · 2 min · Proposed reviewer: Lab operations lead

A local save, an operational confirmation and any required verification are separate events.

1. Read the latest confirmation or synchronization receipt. Check whether the work is saved on the device or accepted by the server.
2. Check the assigned preparation procedure for required evidence or independent verification.
3. If the work is waiting for another authorized person's verification, ask that person to review the existing record.
4. If pages disagree after a confirmed server receipt, report the contradiction. Do not redo the physical work or create another confirmation just to change a badge.

**Success:** You know whether synchronization, verification or a software correction is needed.

**Keep in mind:** Do not assume confirmation alone satisfies every method's release conditions.

Related: bench-drying, bench-save-submit, offline-sync

### Record a run of samples for one method

`bench-run` · guide · 3 min · Proposed reviewer: Lab operations lead

Keep the sample order, method context and quality controls together while working through a batch.

1. Choose the intended method and the eligible assigned samples. Check the run order, units, method revision and instrument.
2. Keep quality-control and replicate records distinguishable from routine specimens according to the approved method.
3. For each sample, confirm identity, enter the observation in the correct field and check the save status before moving on.
4. Review the completed entries, unresolved validation messages and QC evidence. Submit only the records that are ready using the application's submission review.

**Success:** Each observation remains linked to its sample and method, with a clear submission outcome for every included item.

**Keep in mind:** For bulk paste, review sample matching and column/unit mapping before accepting the preview. Never rely only on spreadsheet row position.

Related: bench-save-submit, bench-texture, bench-blocked

### Was my result saved or submitted?

`bench-save-submit` · faq · 2 min · Proposed reviewer: Lab operations lead

Saving keeps an entry. Submission sends ready work for review. Verification and report release are later decisions.

1. Read the status beside the exact work item, not only a page-wide notification.
2. If it says saved on this device, the server may not yet have the entry. Check synchronization before another colleague expects to see it.
3. If it is a draft, review the required values and evidence, then use the authorized submission action when ready.
4. Check the submission receipt. Submitted work may still need verification and inclusion in an authorized released report.

**Success:** You can distinguish captured data, submitted work and a released result.

**Keep in mind:** A green save indicator is not proof of managerial approval or report release.

Related: offline-sync, review-results, review-report

### Why are sand, silt and clay entered together?

`bench-texture` · faq · 2 min · Proposed reviewer: Particle-size method specialist

They form one particle-size result panel and must be checked together before submission.

1. Select the assigned texture method and enter each fraction in its labelled field on the same panel.
2. Check the basis, units and the total against the method's configured tolerance. Investigate a mismatch rather than forcing the total by changing a fraction.
3. Review the class calculated by the configured classification rules when that feature is enabled.
4. Submit the panel with its required evidence. Reports should preserve the same validated values and classification.

**Success:** All fractions belong to one checked result, with a traceable classification where applicable.

**Keep in mind:** Do not silently normalize fractions or select a different texture classification system to obtain a preferred class.

Related: bench-run, review-report

### What should I upload for MIR or NIR analysis?

`bench-spectra` · faq · 3 min · Proposed reviewer: Spectroscopy method specialist

Use the original spectrum export and the supported import profile for your instrument and method.

1. Export the spectrum using the laboratory's approved instrument/software procedure and retain the original file.
2. Choose a supported import profile shown by the application. Follow that profile's required axes, units and metadata; a filename extension alone does not prove compatibility.
3. Match the spectrum to the correct sample, acquisition and replicate, then inspect parser and quality-control messages.
4. Check the evidence upload/processing status before submitting the analytical work.

**Success:** The original spectrum, metadata and sample link are retained with a clear QC and processing outcome.

**Keep in mind:** Do not replace a spectrum with one reflectance number. A spectral prediction is not automatically a reference laboratory measurement.

Related: connect-library, assets-instrument, offline-files

## Review & reports

### Review submitted work before approval

`review-results` · guide · 3 min · Proposed reviewer: Quality lead

Check the submitted version, prerequisites, QC and evidence before making an authorized decision.

1. Open the review queue and confirm that the work has actually been submitted and is within your review scope.
2. Inspect the method, values, units, prerequisites, required equipment and quality-control evidence.
3. Return the item with a clear reason when correction is needed. Use the approved amendment route for already released records.
4. Before approval, confirm the current version and requirements. Check the decision receipt and resulting state.

**Success:** The decision is attached to the reviewed version and is visible to the next responsible person.

**Keep in mind:** An expected or freshly received sample is not ready for scientific approval merely because a button appears.

Related: review-returned, review-amend, review-report

### What should I do when work is returned?

`review-returned` · faq · 2 min · Proposed reviewer: Quality lead

Read the reviewer's reason and correct the identified issue in the authorized work item.

1. Open the returned item and read the review comments and version history.
2. Confirm that the task has been reopened or assigned appropriately before editing.
3. Correct the required entry or evidence, preserving the original observation and any required explanation.
4. Review and resubmit through the workbench, then check the new receipt.

**Success:** The correction is traceable and the reviewer receives the intended revised work.

**Keep in mind:** Do not repeat a physical measurement solely because a software state is unclear; follow the method and review decision.

Related: bench-save-submit, review-amend

### Can I change an approved result?

`review-amend` · faq · 2 min · Proposed reviewer: Quality lead

Use the authorized correction or amendment process so the original result and decision remain traceable.

1. Identify the exact result and report version that needs correction and record why.
2. Ask the authorized reviewer or manager to initiate the permitted correction route if you cannot do so yourself.
3. Make changes only in the resulting authorized revision and retain supporting evidence.
4. Complete the required review and, where needed, issue a new report version under the lab's procedure.

**Success:** The correction links to the previous version with an explanation and appropriate review.

**Keep in mind:** Do not overwrite or delete the approved record to hide an error.

Related: review-results, review-report

### Find and share the correct report

`review-report` · guide · 2 min · Proposed reviewer: Quality lead

Check the report's release state, version and intended recipient before sharing it.

1. Open the reports area available to your role and locate the correct sample or project.
2. Check whether the document is a draft, a released report or a superseded version.
3. Inspect identifiers, methods, units, qualifiers and included result panels before using the permitted download or print action.
4. Share through the approved laboratory process. Use a replacement report when an authorized amendment has superseded an earlier release.

**Success:** The intended recipient receives the correct authorized version.

**Keep in mind:** A downloaded PDF can remain on a device after a newer version is released. Check its version before reuse.

Related: review-amend, connect-sis

## Equipment & stock

### Why can't I select this instrument?

`assets-instrument` · faq · 2 min · Proposed reviewer: Equipment lead

The instrument must be eligible for the method and meet the required service and calibration conditions.

1. Check the method's instrument requirements and the equipment record.
2. Read the specific eligibility, service or calibration message. Confirm that the record is current if working from downloaded information.
3. Choose another eligible instrument if the procedure permits it, or ask the responsible manager to resolve the equipment issue.

**Success:** The selected instrument is eligible, or the task remains visibly blocked while the issue is resolved.

**Keep in mind:** Do not change calibration dates or service status merely to unlock a task.

Related: bench-blocked, assets-stock

### Record materials used at the bench

`assets-stock` · guide · 2 min · Proposed reviewer: Inventory lead

Keep the reagent or consumable lot linked to the work when required by the method.

1. Confirm the material and lot required for the method, including expiry and any hold.
2. Record the quantity and unit using the authorized stock transaction or work-record control.
3. Check the resulting stock transaction or pending offline receipt. Report a balance discrepancy rather than adjusting unrelated entries.

**Success:** Use is traceable to the correct material and lot.

**Keep in mind:** A cached balance may be older than another technician's transaction.

Related: assets-instrument, offline-sync

## Mobile & offline

### Prepare for a supported offline shift

`offline-prepare` · guide · 3 min · Proposed reviewer: Mobile/offline product owner

Download the work and guidance your authorized device will need before losing connectivity.

1. Confirm that offline capture is enabled and supported for this device and the planned task in your deployed version.
2. While connected, download the scoped work pack and check its completion, freshness, storage readiness and offline authorization.
3. Open the required methods and help while preparing the pack. Verify that essential evidence and guidance are actually available offline.
4. At the end of the shift, reconnect and inspect accepted, pending and conflicting items before handing over the work.

**Success:** The supported task and its necessary guidance are available to the authorized user on the device.

**Keep in mind:** An installed icon or cached page alone does not establish durable offline result capture.

Related: offline-sync, offline-files

### What does saved on this device mean?

`offline-sync` · faq · 2 min · Proposed reviewer: Mobile/offline product owner

The device holds the entry, but the server may not yet have accepted it.

1. Open Sync Centre and check the exact item: waiting, sending, accepted or needing attention.
2. Reconnect and sign in as required, then allow synchronization or use the available retry action.
3. If there is a conflict, compare the local proposal with the server record and follow the authorized resolution path.
4. Before clearing storage, reinstalling or retiring the device, resolve pending work through the lab's approved recovery procedure.

**Success:** Each entry has a confirmed server outcome or a visible, recoverable next action.

**Keep in mind:** Do not clear browser or app storage to fix a pending synchronization problem.

Related: bench-save-submit, offline-prepare, offline-files

### Has my photo or spectrum really been saved?

`offline-files` · faq · 2 min · Proposed reviewer: Lab operations lead

Check that the original file was captured and that the required upload or processing has finished.

1. Check the attachment state for the exact sample and work item. A filename or thumbnail is not proof that the original bytes were saved.
2. For supported offline capture, confirm the device-save receipt before removing access to the source file.
3. After reconnecting, inspect upload and processing results. Retain the original export and use the supported retry/recovery controls when a transfer fails.

**Success:** The required evidence is linked and its storage or processing state is explicit.

**Keep in mind:** Do not resubmit a changed file under the identity of an earlier original.

Related: bench-spectra, offline-sync

## Projects & connections

### Does a KoBo submission mean the sample was received?

`connect-kobo` · faq · 2 min · Proposed reviewer: Project/integration lead

No. Field information and physical laboratory receipt describe different events.

1. Check the project's field record and integration status to establish what data arrived.
2. Match the physical specimen at Reception when it reaches the lab.
3. If expected records are missing or duplicated, ask the integration owner to inspect the connection and import outcome before recreating them.

**Success:** Field provenance is retained and physical receipt is recorded separately.

**Keep in mind:** Do not assume a fixed automatic synchronization interval unless your deployment's configuration confirms it.

Related: intake-project, intake-location

### How is the spectral library related to sample results?

`connect-library` · faq · 2 min · Proposed reviewer: Spectroscopy method specialist

The library holds linked spectra and their context; a file, a prediction and an approved report are distinct records.

1. Open the spectrum's sample link and acquisition metadata to establish its origin.
2. Check the processing/QC state and any model version associated with a prediction.
3. Use the sample result and report views to establish which reviewed results were actually released.

**Success:** You can trace spectrum → processing/model → reviewed result without treating them as the same state.

**Keep in mind:** Library inclusion alone does not certify a model prediction or authorize report release.

Related: bench-spectra, review-report

### Has the result reached the Soil Information System?

`connect-sis` · faq · 2 min · Proposed reviewer: Integration owner

Check the authorized delivery record. A released report and a successful external transfer are separate outcomes.

1. Identify the released result/report version intended for the receiving system.
2. Inspect the available integration or export record for delivery status and any validation failure.
3. Ask the configured integration owner to resolve rejected or uncertain deliveries. Preserve the original delivery identity when retrying through the approved process.

**Success:** There is a confirmed delivery outcome for the correct version, or an assigned recovery action.

**Keep in mind:** Do not expose API credentials in help requests or assume opening an export screen transmitted data.

Related: review-report, manage-support

## Managing the laboratory

### Change an analysis definition responsibly

`manage-catalogue` · guide · 3 min · Proposed reviewer: Scientific catalogue owner

A catalogue definition is connected to selection, worksheets, validation and reporting.

1. Identify whether the request changes display wording, a method assignment or a scientific definition.
2. Inspect the affected selection, task schema, prerequisites, units, panels and report mappings before editing.
3. Use the authorized revision/review process and test the affected laboratory journey with representative records.
4. Preserve historical result meaning and released reports when publishing a new definition.

**Success:** The intended definition is consistent across selection, work and reports without reinterpreting previous results.

**Keep in mind:** Changing a translated label must not alter a stable scientific code or calculation.

Related: manage-language, bench-texture

### How do I change the language or report a translation?

`manage-language` · faq · 2 min · Proposed reviewer: Localization owner

Use the interface language control. Report scientific wording with its context so it can be reviewed accurately.

1. Choose your language through the current interface language control or profile preference.
2. For incorrect wording, record the page, parameter/method and the phrase that is unclear, without sharing unnecessary sample data.
3. Ask an authorized language editor or lab manager to review the relevant terminology group. Scientific terms need review in their method context.

**Success:** The chosen language is applied, or a precise wording correction reaches the appropriate reviewer.

**Keep in mind:** A translation correction must not change stored values, units or scientific identifiers.

Related: manage-catalogue, manage-support

### What should I do if a page fails to load?

`manage-load-error` · faq · 2 min · Proposed reviewer: Application support owner

Preserve unsaved work first. A failed page module may need a safe retry or an application update.

1. Check connectivity and any application update message. Record the page and approximate time of the error.
2. Before refreshing or leaving, check whether any entered work is unsaved or waiting for synchronization.
3. Use the application's safe retry/update control when available. If no work can be lost, a normal refresh may load the current version.
4. If the issue repeats, report it to the configured support contact with the displayed error reference and build version where available.

**Success:** The page loads without losing work, or support has enough non-sensitive information to investigate.

**Keep in mind:** Do not clear browser storage or repeatedly refresh while unsynchronized laboratory work is at risk.

Related: offline-sync, manage-support

### Ask for help with the right information

`manage-support` · guide · 2 min · Proposed reviewer: Application support owner

Send a clear description through your laboratory's configured support channel.

1. State what you were trying to do, what happened and what you expected.
2. Include the page, approximate time and relevant application version or error reference, if shown.
3. Use a sample or task identifier only when needed and permitted. Review any screenshot for personal information, results or credentials before sharing.
4. Choose the configured lab manager, method specialist or application support contact for the issue. Submit only after reviewing the message and attachments.

**Success:** The appropriate person receives a clear, appropriately scoped support request.

**Keep in mind:** Never include passwords, access tokens or unrestricted database exports.

Related: manage-load-error, bench-blocked
