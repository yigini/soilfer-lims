# Complete English design exemplars

These examples define the writing standard. Exact controls were checked in source where listed; representative role/UI and method-configuration verification is still required before publication. All sample IDs and measured values are synthetic examples.

These eight examples establish the writing standard. They are not a production-reviewed scientific SOP or the entire content collection. Verify source labels and role behavior in the candidate release; record unresolved UI bindings rather than inventing them.

## Record and submit a batch of results

`bench-batch` · Laboratory technician · /workbench

Keep one method's sample results together, check every match, then complete the separate recording and reviewer handoff steps.

**Quick answer.** In Workbench, select the method and enter or paste the matching sample results. Use Review Completion to record eligible determinations. Then open Ready to Submit and submit the selected samples for review. Applying pasted values only creates drafts.

### Before you start

- Use your own account and confirm the laboratory shown in the application.
- Have the instrument output or bench record, the sample identifiers and the required method metadata available.
- Confirm that the tasks are assigned to you and their preparation and equipment requirements are satisfied. A different pH method or measurement basis belongs in a different method group.
- For this example, use the connected workflow. Check the separate offline guide for actions actually supported by your downloaded work pack.

### 1. Select the work and prepare the data

1. Open Workbench and choose the required analysis method in Worksheet. Compare the displayed parameter and method with your bench record.

   **What you should see:** The worksheet contains the assigned tasks for that method. The same sample may legitimately have other analyses elsewhere.

2. For a spreadsheet paste, prepare two columns: Sample ID and Result Value. Copy the data rows, without column headings. Keep identifiers as text so leading zeros are not lost.

   **What you should see:** Each result remains attached to its own identifier. Do not rely on the worksheet and spreadsheet having the same row order.

### 2. Preview and apply drafts

1. Select Paste Values, paste the two columns and select Preview Matches & Exclusions.

   **What you should see:** A preview identifies matched rows and explains duplicates, unassigned samples, sealed tasks, invalid numbers and prerequisite failures.

2. Compare the included identifiers and values with the source record. Resolve errors at their cause. If 38 of 40 rows match, do not describe the import as 40 completed results.

   **What you should see:** You can account for every source row as included or excluded. A sample with an unresolved prerequisite remains blocked.

3. Select Apply 38 Matched Drafts, or the actual displayed count. Check the worksheet values and required instrument, units or basis metadata.

   **What you should see:** Values appear as drafts. Applying them has not yet recorded the determinations or sent them to the manager.

### 3. Record the determinations

1. Select the intended worksheet rows and choose Review Completion. Inspect Included Determinations and Excluded / Incomplete.

   **What you should see:** The application explains which individual determinations can be recorded. An excluded item stays outside the operation.

2. Read the confirmation, select it only after checking the entries, and choose Record N Determinations.

   **What you should see:** The eligible results are recorded. This is still a separate event from reviewer submission; preserve the confirmation if the response is uncertain.

### 4. Send the correct samples for review

1. Open Ready to Submit. Inspect each selected sample's included analyses and whether the submission is FULL or PARTIAL.

   **What you should see:** A partial submission contains the completed determinations shown; it does not mean all requested analyses are finished.

2. Add useful reviewer notes if needed, read the confirmation, and select Submit N Samples for Review.

   **What you should see:** The server confirms the submission. Submitted work is no longer ordinary editable draft work.

3. Open Sent & Completed and verify the submitted work or receipt. If the manager cannot find it, provide that receipt and check the laboratory and queue filters before repeating anything.

   **What you should see:** The manager can inspect the submitted version in the review queue. Approval and report release are later decisions.

### Field guide

| Field or state | Meaning | Example / instruction |
|---|---|---|
| Sample ID | Use an identifier recognized for an assigned task in this method group. | DEMO-001 |
| Result Value | Use the observed value and the configured unit/basis. Blank and zero have different meanings. | 6.45 — demonstration value only |
| Method context | Match the configured variant to the bench record; do not merge different extraction bases. | The lab's configured pH method |

### Worked example

DEMO-001	6.45
DEMO-002	7.12
DEMO-003	5.88

### Check it worked

Every source row has an explained outcome; recorded determinations and submitted samples are reconciled; the review submission has a server confirmation.

**Who acts next:** Laboratory manager or assigned reviewer inspects the submitted results. The technician resolves only work returned through the permitted correction workflow.

### If something differs

**No matching assigned task**

The identifier, method group, assignment or laboratory does not match the current queue.

Compare the sample label and selected method. Ask the manager to correct the assignment if appropriate; do not create a duplicate result.

**Some rows were excluded**

Preview validation found specific row problems.

Use each exclusion reason. Apply only the intended valid rows, and retain a list of unresolved rows for correction.

**Saved, but the manager sees nothing**

A draft or recorded result has not necessarily been submitted.

Check Ready to Submit and the actual submission receipt. Do not re-enter the same measurements on the sample page.

### Source evidence to recheck

- `client/src/components/workbench/WorksheetArea.jsx`
- `client/src/components/workbench/PastePreviewModal.jsx`
- `client/src/components/workbench/ReviewCompletionView.jsx`
- `client/src/components/workbench/ReviewSubmissionView.jsx`
- `client/src/components/workbench/WorkbenchShell.jsx`

---

## Confirm sample drying and find its receipt

`prep-drying` · Laboratory technician · /workbench

Record evidence that the drying operation was completed for the right sample. Checking boxes and confirming the operation are separate actions.

**Quick answer.** Open the drying task in Workbench. Perform and check each item in the displayed checklist, then select Confirm Complete. Look for Checklist Verified, a receipt identifier, the confirming user and the recorded time.

### Before you start

- Match the physical label to the laboratory and field identifiers shown for the task.
- Use the drying procedure assigned by the laboratory. This guide does not prescribe a temperature, duration or endpoint.
- Use a working connection for this confirmation workflow. Do not assume that checking items on screen has queued an offline confirmation.
- If Legacy Completion — Evidence Gap is displayed, use the evidence-gap procedure; a new tick cannot establish missing historical evidence.

### 1. Check the sample and perform the work

1. In Workbench, open the assigned Sample drying task. Compare its sample identifier with the container and bench log.

   **What you should see:** You are documenting the physical material actually handled, under the correct task and laboratory.

2. Read every displayed checklist item. Perform and verify the drying work under the applicable lab procedure; record its required evidence in the designated records.

   **What you should see:** The checklist reflects work that has happened. A tutorial, task assignment or sample receipt is not evidence that drying is complete.

3. Select each checklist item only after checking it. Confirm that the row shows Operational checklist complete.

   **What you should see:** All required checks are marked. The final confirmation action becomes available; the checks alone are not yet the durable receipt.

### 2. Confirm and verify once

1. Select Confirm Complete on that row. For a permitted bulk action, compare every selected sample first and use the displayed Confirm … Complete count.

   **What you should see:** The operation is sent for confirmation. Do not select unperformed samples merely because they share a batch.

2. Look for Checklist Verified and read the receipt identifier, recorded user and time. Keep the receipt reference if another page seems inconsistent.

   **What you should see:** The saved receipt replaces the editable checklist. The application has evidence for this operational confirmation.

3. Return to the relevant work queue and inspect the next task's readiness.

   **What you should see:** A drying requirement can be satisfied while preparation, assignment or instrument requirements still block an analysis. Drying does not automatically complete those separate requirements.

### Field guide

| Field or state | Meaning | Example / instruction |
|---|---|---|
| Checklist items | Confirm the actions actually performed under the assigned procedure. | All required items checked |
| Receipt | Evidence returned for the confirmation, not a number to invent. | Receipt reference displayed by LIMS |
| Next-task readiness | Read the remaining blocker and responsible role. | Preparation still required |

### Check it worked

Checklist Verified shows the saved receipt and the next task reflects the appropriate prerequisite state. You have not created a fictitious numerical drying result.

**Who acts next:** The technician assigned to preparation, or the role identified by the remaining blocker, continues the physical workflow.

### If something differs

**All checks are ticked but no receipt appears**

The checklist may not have been confirmed, or the request did not complete.

Inspect the confirmation state and connection. Check for an existing receipt before retrying; do not repeat the physical work only to change the screen.

**Sample page still looks incomplete**

The page may show a different task, attempt or aggregate sample state, or a display defect.

Compare task/attempt and receipt. Preserve the reference and report the contradiction if it persists. Do not use a second completion control as a workaround.

**The analysis is still blocked**

Another prerequisite remains unmet.

Open the specific blocker explanation. Finish only the work assigned and permitted to you.

### Source evidence to recheck

- `client/src/components/workbench/OperationalTaskEditor.jsx`
- `client/src/components/workbench/WorksheetArea.jsx`
- `client/src/components/workbench/WorkbenchShell.jsx`
- `server/services/workbenchReadinessService.js`

---

## Preparation looks incomplete after confirmation

`prep-receipt` · Technician and laboratory manager · /workbench

Establish which action succeeded before trying again. Use the operation receipt to distinguish an unfinished confirmation from a contradictory display.

**Quick answer.** Find the preparation receipt first. If there is no verified receipt, check the confirmation and connection. If a receipt exists, compare the task and attempt shown on both pages and read the remaining blocker. Do not enter a numerical result or complete preparation again from a different page.

### Before you start

- Keep the current worksheet and any unsaved input available.
- Note the synthetic example distinction: a preparation task, an analytical determination and the sample's overall status are different records.
- Do not clear browser storage or create a replacement sample to resolve a display disagreement.

### 1. Establish what the application confirmed

1. Open the preparation row in Workbench and look for Checklist Verified, a receipt identifier and a recorded time.

   **What you should see:** You can say whether a durable confirmation is visible, rather than relying on a ticked checkbox or remembered toast.

2. If no receipt is shown, check whether all required checklist items were completed and whether Confirm Complete was selected successfully.

   **What you should see:** An unconfirmed checklist remains an entry task. A connection or authorization error is not success.

3. If the request outcome was uncertain, restore the connection and inspect the existing operation receipt before retrying.

   **What you should see:** You avoid submitting the same confirmation repeatedly because a response was lost.

### 2. Compare the records and resolve the blocker

1. With a receipt present, compare the sample identifier and preparation task/attempt with the sample page entry.

   **What you should see:** A different attempt or aggregate sample state is recognized as different context, not automatically a failed save.

2. Read the exact readiness explanation for the analysis you want to perform next.

   **What you should see:** It identifies the unresolved prerequisite or capability. Another required preparation or instrument condition can remain after one task is complete.

3. If the same task and attempt still contradict the receipt, send the manager or application support the page names, time, task and receipt references through the configured channel.

   **What you should see:** The discrepancy can be reproduced and corrected without losing the original operational evidence.

### Field guide

| Field or state | Meaning | Example / instruction |
|---|---|---|
| Observed state | What the page says now. | Checklist Verified |
| Receipt and task | References needed to identify the confirmed operation. | Use the displayed references |
| Remaining blocker | Exact explanation, with no invented interpretation. | Instrument not eligible |

### Check it worked

The next action is tied to a known missing confirmation, a different requirement or an identified application defect. No duplicate physical or data-entry work is introduced.

**Who acts next:** The assigned technician handles unfinished work. A manager handles assignment/evidence issues. Application support handles a reproducible contradiction between views.

### If something differs

**Manager says the task must be submitted, but the technician has no Submit action**

The task's operational and analytical workflows may have been mixed, or the UI is inconsistent.

Preserve the preparation receipt and report the exact state mismatch. Do not tell either user to fabricate an analytical value or bypass the server rule.

### Source evidence to recheck

- `client/src/components/workbench/OperationalTaskEditor.jsx`
- `client/src/components/workbench/WorkbenchShell.jsx`
- `client/src/components/sample/WorkItemsTable.jsx`

---

## Receive a project sample

`intake-project` · Intake officer · /reception

Connect the material that actually arrived to the right project record, record its condition and requested work, then verify the receipt.

**Quick answer.** In Reception, complete ID & Field, Condition, Analyses and Handover for the matched project sample. Saving a draft preserves entry; it does not establish physical receipt. Verify the receipt confirmation before handing material to the laboratory.

### Before you start

- Have the physical material, label, delivery information and required intake measurements available.
- Confirm your laboratory and project scope. Use the existing project record when one already represents the sample.
- The exact final receipt control and any manager intake review depend on the deployed workflow; the writer must bind and verify those controls before publication.

### 1. Match identity and field information

1. Open Reception and select the project. In ID & Field, find or scan the identifier on the physical label.

   **What you should see:** A matching source record is displayed. A KoBo submission is field provenance, not proof that the material arrived.

2. Compare project, field identifier and displayed laboratory identifier. Check the source location and sampling information.

   **What you should see:** The correct project record is linked. If source coordinates exist but the draft is blank, preserve the discrepancy instead of inventing coordinates.

### 2. Record condition and requested work

1. Open Condition. Enter the actual received mass in the stated unit, the observed condition and the required compliance answers.

   **What you should see:** Missing values, insufficient mass or nonconformance are visible as specific issues rather than silently accepted defaults.

2. Document any required exception reason. In Analyses, review the parameter names and method choices against the request.

   **What you should see:** The ordered work matches the request. Grouped analyses such as texture are handled according to the configured panel, not invented as unrelated tasks.

### 3. Finish and verify the receipt

1. Open Handover and review identity, condition, ordered analyses and outstanding issues. Use Save draft if the entry is not ready.

   **What you should see:** A saved draft remains distinct from an accepted receipt; it should not move unreceived material into drying workload.

2. When complete, perform the verified final receipt action and inspect its confirmation and resulting intake state.

   **What you should see:** The application identifies what was received and whether another intake-review action remains. Final control binding is a required publication check for this exemplar.

3. Check the sample label and the destination or handover details before transferring the physical material.

   **What you should see:** The next worker can identify the material and locate the corresponding tasks without duplicating intake.

### Field guide

| Field or state | Meaning | Example / instruction |
|---|---|---|
| Field identifier | Match the source project record and physical label. | DEMO-FIELD-001 |
| Received mass | Actual measured mass, using the displayed grams field. | Use the intake measurement, not a default |
| Condition / exception | Observed condition and required reason. | Damaged container documented as an exception |

### Check it worked

A receipt is visible for the correct material, with condition and analysis scope accounted for. If still a draft, it is clearly identified as such.

**Who acts next:** The manager or receiving workflow assigns the next work according to the laboratory configuration.

### If something differs

**No location recorded after resuming**

The draft may have lost its source link or the source may truly lack location.

Compare field provenance first. Preserve existing data and report a broken link rather than adding guessed coordinates.

**Duplicate identifier**

More than one candidate or an existing receipt needs reconciliation.

Inspect the matching project and intake records; do not accept a second record merely to finish quickly.

### Source evidence to recheck

- `client/src/pages/Reception.jsx`
- `client/src/components/reception/FieldProvenanceCard.jsx`
- `client/src/components/reception/ComplianceChecklist.jsx`

---

## Review a technician's submitted results

`review-submission` · Laboratory manager · /manager-queue

Review the submitted version and its evidence before making a decision. Assignment, recording, acceptance and final report release are separate steps.

**Quick answer.** Open Manager Queue → Review Submissions. Select the submission, inspect its results and evidence, then use the permitted review decision. Use Final Approvals only after the required review and completeness conditions are satisfied.

### Before you start

- Confirm your laboratory and reviewer authority. A role recommendation in Help does not grant access.
- Work from a submission or review receipt, not an unsent technician draft.
- Use the lab's approved method/QC criteria for scientific judgment. This guide does not establish acceptance limits.

### 1. Find the submitted version

1. Open Manager Queue and select Review Submissions. Check the active laboratory, filters and submission identity.

   **What you should see:** The list contains work actually submitted for review. An empty list can be a filter/scope issue or genuinely no submitted work.

2. Open Review for the relevant submission. Compare sample identifiers, included analyses and FULL/PARTIAL scope.

   **What you should see:** You understand exactly what is being reviewed. A partial submission does not complete unsubmitted analyses.

### 2. Check evidence and record the decision

1. Inspect values, units/basis, method revision, required metadata, preparation evidence and relevant QC. For spectra, distinguish the acquisition from any predicted property.

   **What you should see:** Each decision has evidence for the submitted version; a successful upload or a Done label is not substituted for scientific review.

2. If correction is needed, use the permitted return/reanalysis action with a precise reason, affected task and expected correction.

   **What you should see:** The technician has an actionable request and the original evidence remains in history. Bind the actual review-action label during UI verification.

3. If acceptable, perform the authorized review action and verify its confirmation and resulting state.

   **What you should see:** The application records the reviewer decision. It does not automatically establish that a final report was generated or delivered.

### 3. Check what remains

1. Inspect remaining sample requirements before moving to Final Approvals.

   **What you should see:** Unsubmitted analyses, unresolved QC, nonconformance or incomplete evidence remain visible; freshly received material cannot be treated as fully analyzed.

2. Where final release is permitted, inspect the current report scope and version through the reporting workflow.

   **What you should see:** Accepted determinations, final sample approval, generated report and external delivery are individually traceable.

### Field guide

| Field or state | Meaning | Example / instruction |
|---|---|---|
| Submission scope | Analyses included in this submitted version. | PARTIAL: pH only |
| Review reason | A specific correction request tied to the affected work. | Check unit/basis against the instrument output |
| Remaining requirements | Server-provided reasons final approval is not yet allowed. | Another analysis remains unsubmitted |

### Check it worked

The reviewed version has a recorded decision and clear next ownership. The manager has not approved work merely because material was received.

**Who acts next:** Technician for returned work; authorized final approver/reporting role for complete accepted work.

### If something differs

**The technician says results were saved, but Review Submissions is empty**

Saved and recorded results may still be waiting for submission.

Ask for the submission receipt. If it exists, compare lab and queue filters; otherwise the technician completes the handoff in Workbench.

**Final approval is disabled**

The server reports incomplete or unauthorized conditions.

Read the specific reasons and address them through the owning workflow; do not use another page to bypass the check.

### Source evidence to recheck

- `client/src/pages/ManagerQueue.jsx`
- `client/src/components/workbench/ReviewSubmissionView.jsx`
- `client/src/components/sample/SubmissionPanel.jsx`

---

## Import MIR or NIR spectra for assigned work

`method-spectral-import` · Laboratory technician · /workbench

Import an instrument's exported spectrum, match it to the assigned sample and inspect the file evidence. A single reflectance number is not a replacement for a spectrum.

**Quick answer.** Use the spectral import flow for the assigned method: Identify & Upload → Match & Inspect → Confirm Import → Receipt. Keep the original export. Resolve unmatched samples and file/QC issues before confirmation, then verify the imported spectrum's links and review state.

### Before you start

- Have the original instrument export, instrument identity and sample/scan identifiers available.
- Use an export/profile actually supported and verified for your instrument and method. A file extension in a picker is not proof that every vendor variant is supported.
- Use the lab's approved acquisition and spectral QC procedure. This article does not define scan settings or acceptance thresholds.

### 1. Identify and upload

1. Open spectral import from the assigned Workbench method. In Identify & Upload, select the verified spectrometer and provide required run/acquisition details.

   **What you should see:** The import is associated with the correct instrument and method context. Missing or ineligible instruments need correction, not a free-text substitute.

2. Select the original export files and continue to staging preview.

   **What you should see:** The system reports recognized files and parsing problems. A staged file has not yet completed the task or been accepted for reporting.

### 2. Match and inspect

1. In Match & Inspect, compare each detected sample/scan identifier with the label and assigned task.

   **What you should see:** Each included spectrum has an intentional sample/task match. Similar filenames and row order alone do not establish identity.

2. Inspect the plot, axis type and unit, acquisition metadata, replicates and reported validation issues.

   **What you should see:** You can recognize an unexpected axis, missing range or wrong sample match and follow the applicable profile/QC requirements.

3. Resolve or exclude failed and unmatched entries with the available workflow, preserving the original files and exclusion reasons.

   **What you should see:** The import count reflects only the intended included items; excluded files remain accounted for.

### 3. Confirm and trace

1. Review the final mapping in Confirm Import, make the required confirmation and complete the import.

   **What you should see:** The Receipt step shows which items were imported and which were not. Use the actual receipt before retrying an uncertain upload.

2. Open the linked spectrum in Spectral Library and inspect its sample association and review/QC state.

   **What you should see:** The original spectrum can be traced. Imported, quality-accepted, predicted and report-approved are not interchangeable states.

3. If a prediction is produced, inspect its model/version and applicability separately from reference measurements and the final result review.

   **What you should see:** A model output is not silently represented as a measured wet-chemistry result or an approved report.

### Field guide

| Field or state | Meaning | Example / instruction |
|---|---|---|
| Spectrum file | Original supported instrument export, with acquisition provenance. | A synthetic fixture supplied for the configured import profile |
| Axis and signal | Read the declared units and representation from the profile/export. | Wavenumber and absorbance or reflectance, as actually recorded |
| Sample match | Sample and assigned task linked to the scan. | DEMO-001 |

### Check it worked

The import receipt reconciles included and excluded files, and the sample/task/library links are correct. Any QC or reviewer step remains explicit.

**Who acts next:** The designated spectral reviewer or method/QC owner handles the next review; a model or report process runs only when configured and permitted.

### If something differs

**Unsupported file or parse failure**

The export may not match an implemented profile or may be incomplete.

Keep the original file and record the import error/profile. Ask the instrument/application owner for the supported export path; do not fabricate a scalar result.

**Uploaded but the sample is not approved**

Import, quality review, prediction and final approval are separate stages.

Read the current stage and its assigned owner. Do not treat library presence as report release.

### Source evidence to recheck

- `client/src/components/workbench/SpectralIntakeModal.jsx`
- `client/src/pages/SpectralLibrary.jsx`

---

## Synchronize and verify queued work

`offline-sync` · Technician or intake officer · /workbench

Reconnect and reconcile each pending action. Work saved on the device is not necessarily visible to the laboratory server or manager.

**Quick answer.** Keep the same account and laboratory, restore the connection, and inspect the application's synchronization view. Reconcile succeeded, pending, failed and conflicting actions individually. Use server receipts to confirm completion; never clear storage to force synchronization.

### Before you start

- Keep the device and browser profile containing the pending work.
- Only actions supported by the actual downloaded work pack can be completed offline. Help downloads do not make all laboratory actions offline-capable.
- The writer must verify the current synchronization control labels and receipts on representative devices before publication. Do not invent a Sync now control where none exists.

### 1. Reconnect without losing the local record

1. Restore a stable connection and confirm the signed-in account and laboratory.

   **What you should see:** The queued work is reconciled under the correct identity; another lab's cache is not used.

2. Open the actual synchronization status or pending-work view supplied by the application.

   **What you should see:** You can distinguish queued actions from completed server operations and see the recorded failure reasons.

### 2. Reconcile the outcome

1. Inspect each completed action and its server confirmation. For a partial sync, compare the number and identities of completed and still-pending actions.

   **What you should see:** A global online indicator is not mistaken for successful submission of every result or attachment.

2. For a retryable transport failure, use the application's retry/reconciliation action after checking whether the server already recorded it.

   **What you should see:** The original operation identity is preserved; an uncertain response does not produce a duplicate result.

3. For a conflict, compare the local entry and current server state and follow the permitted resolution. If work was reassigned or approved, involve the responsible manager.

   **What you should see:** The application does not silently overwrite another person's work or an approved result.

4. After successful synchronization, inspect the relevant Workbench or intake receipt and resulting task state.

   **What you should see:** A synchronized draft may still require recording or reviewer submission. Sync success and analytical approval remain separate.

### Field guide

| Field or state | Meaning | Example / instruction |
|---|---|---|
| Pending action | Work retained on this device and not yet confirmed by the server. | Draft or supported queued operation |
| Conflict | A newer server state requires reconciliation. | Task reassigned while disconnected |
| Receipt | Server evidence for a particular operation. | Displayed operation reference |

### Check it worked

All pending actions are either confirmed by the server or have a visible, owned resolution. No local work is silently discarded.

**Who acts next:** Technician/intake officer for ordinary retry; manager for assignment or approved-state conflicts; support for unresolved device errors.

### If something differs

**The manager still sees no result**

The device may have synchronized only a draft, or the handoff is still pending.

Identify the last confirmed state and complete the relevant recording/submission step if permitted.

**An attachment remains pending**

The data action and file transfer may have different outcomes.

Keep the original file and inspect the attachment's own status rather than assuming the entire sample failed.

### Source evidence to recheck

- `client/src/context/SyncContext.jsx`
- `client/src/services/offline/offlineDb.js`
- `client/src/components/workbench/WorkbenchShell.jsx`

---

## Correct a translation without changing scientific meaning

`admin-translation` · Authorized editor or administrator · /admin?tab=languages

Change the displayed wording in the correct language and context while preserving scientific identifiers, units and previously recorded results.

**Quick answer.** Open the language/translation area, choose the language and terminology group, and compare the term with its source and actual screen. Edit the display wording, complete the required review and verify the published wording in context. Do not change a method code or unit to fix a translation.

### Before you start

- Have the page, current phrase, intended meaning and affected method or article available.
- Confirm whether the change belongs to interface text, scientific analysis terminology or a Help article block.
- The exact save/review/publish labels must be bound to the current editor during UI verification; the prototype's editorial controls are design proposals.

### 1. Find the correct source and language

1. Open Administration → Languages and select the intended language. For Help bodies, open the linked Help content editor and the article's locale.

   **What you should see:** The editor shows the correct source text and language status, not a similarly named term from another group.

2. Check the term on the actual page, including the method variant and unit where relevant.

   **What you should see:** You distinguish a label correction from a scientific definition change. Spanish and Latin American Spanish may need different approved wording.

### 2. Edit, review and verify

1. Change the translated display text. Preserve placeholders, stable IDs, formulas and units.

   **What you should see:** The wording changes without altering stored values or calculation meaning.

2. Preview the text in its actual interface or article block and complete the editor's authorized review/publication workflow.

   **What you should see:** Review provenance is truthful. Saving a draft does not automatically make it visible to all readers.

3. Open the affected page in the target language and check text wrapping, complete instructions and consistent terminology.

   **What you should see:** The published wording is readable and coherent. A translated menu with English article steps is not a complete article translation.

### Field guide

| Field or state | Meaning | Example / instruction |
|---|---|---|
| Term/concept ID | Stable reference used to identify the concept. | Never change merely to improve wording |
| Locale | The intended regional language version. | es and es-419 are reviewed distinctly |
| Source revision | The source on which the translation is based. | Current article or terminology revision |

### Check it worked

The intended wording appears in the correct context and language, with source/review history retained and scientific meaning unchanged.

**Who acts next:** The appropriate language or method reviewer for changes that require review; the publisher releases the verified version.

### If something differs

**My edit does not appear in Help**

The change may be a draft, belong to another group/locale, or be excluded from the current publication.

Inspect the published article/locale revision and release membership. Do not repeatedly overwrite the source English text.

**A scientific term is ambiguous**

The method context may change its meaning.

Provide the method and source phrase to the terminology owner and resolve the meaning before publication.

### Source evidence to recheck

- `client/src/pages/AdminPanel.jsx`
- `client/src/components/TranslationEditor.jsx`
- `client/src/pages/help/AdminHelpEditor.jsx`