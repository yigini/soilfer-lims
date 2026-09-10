# Existing-content migration and FAQ seed

## Preserve every existing article link

These 27 source article identities are mapped individually. Reconcile with the actual content database before applying changes. Brief IDs are editorial scopes; prefer retaining existing immutable article identities and version histories. If splitting, keep a relevant landing section at the original URL and explicit links to the published successor guides. Do not withdraw all v1 content while v2 is being written.

| Existing ID / title | Replacement scope briefs |
|---|---|
| `start-shift` — Start your shift with the right work | `start-technician`, `start-reception`, `start-manager` |
| `intake-project` — Receive a project sample | `intake-project`, `intake-handover` |
| `intake-location` — Why is the location missing from an intake draft? | `intake-location`, `intake-draft` |
| `intake-identity` — Which sample identifier should I use? | `tracking-identifiers`, `intake-duplicate` |
| `bench-blocked` — Why can't I start this analysis? | `bench-blocked`, `tracking-map` |
| `bench-drying` — Record sample drying | `prep-drying` |
| `bench-preparation` — Why does preparation still need attention after I confirm it? | `prep-receipt`, `prep-preparation` |
| `bench-run` — Record a run of samples for one method | `bench-batch`, `bench-paste` |
| `bench-save-submit` — Was my result saved or submitted? | `bench-states`, `bench-submit` |
| `bench-texture` — Why are sand, silt and clay entered together? | `method-texture`, `method-derived` |
| `bench-spectra` — What should I upload for MIR or NIR analysis? | `method-spectral-import`, `method-spectral-inspect` |
| `review-results` — Review submitted work before approval | `review-submission`, `review-final` |
| `review-returned` — What should I do when work is returned? | `bench-returned`, `review-return` |
| `review-amend` — Can I change an approved result? | `review-amend` |
| `review-report` — Find and share the correct report | `review-report`, `review-share` |
| `assets-instrument` — Why can't I select this instrument? | `assets-find`, `assets-calibration`, `assets-maintain` |
| `assets-stock` — Record materials used at the bench | `assets-stock`, `assets-trace` |
| `offline-prepare` — Prepare for a supported offline shift | `offline-prepare`, `offline-install` |
| `offline-sync` — What does saved on this device mean? | `offline-sync`, `offline-record` |
| `offline-files` — Has my photo or spectrum really been saved? | `offline-record`, `method-spectral-import` |
| `connect-kobo` — Does a KoBo submission mean the sample was received? | `connect-kobo`, `connect-field-fix` |
| `connect-library` — How is the spectral library related to sample results? | `method-spectral-inspect`, `method-predictions` |
| `connect-sis` — Has the result reached the Soil Information System? | `connect-sis` |
| `manage-catalogue` — Change an analysis definition responsibly | `admin-catalogue`, `admin-methods` |
| `manage-language` — How do I change the language or report a translation? | `start-settings`, `admin-translation` |
| `manage-load-error` — What should I do if a page fails to load? | `quality-loading` |
| `manage-support` — Ask for help with the right information | `quality-support`, `admin-support` |

## FAQ entries come from canonical problem blocks

The following 17 worked question/answer examples are extracted from the eight detailed guides. They establish the minimum practical answer style; all remaining commissioned guides also need their relevant problem blocks. Keep the source block identity and derive the FAQ index at publication, rather than maintaining duplicate editable answers. Only the approved applicable locale should be served.

### No matching assigned task

The identifier, method group, assignment or laboratory does not match the current queue.

**What to do:** Compare the sample label and selected method. Ask the manager to correct the assignment if appropriate; do not create a duplicate result.

**Read the steps:** Record and submit a batch of results → If something differs. Canonical source: `bench-batch`, proposed stable problem ID `bench-batch-problem-1`. Assign once and retain across edits.

### Some rows were excluded

Preview validation found specific row problems.

**What to do:** Use each exclusion reason. Apply only the intended valid rows, and retain a list of unresolved rows for correction.

**Read the steps:** Record and submit a batch of results → If something differs. Canonical source: `bench-batch`, proposed stable problem ID `bench-batch-problem-2`. Assign once and retain across edits.

### Saved, but the manager sees nothing

A draft or recorded result has not necessarily been submitted.

**What to do:** Check Ready to Submit and the actual submission receipt. Do not re-enter the same measurements on the sample page.

**Read the steps:** Record and submit a batch of results → If something differs. Canonical source: `bench-batch`, proposed stable problem ID `bench-batch-problem-3`. Assign once and retain across edits.

### All checks are ticked but no receipt appears

The checklist may not have been confirmed, or the request did not complete.

**What to do:** Inspect the confirmation state and connection. Check for an existing receipt before retrying; do not repeat the physical work only to change the screen.

**Read the steps:** Confirm sample drying and find its receipt → If something differs. Canonical source: `prep-drying`, proposed stable problem ID `prep-drying-problem-1`. Assign once and retain across edits.

### Sample page still looks incomplete

The page may show a different task, attempt or aggregate sample state, or a display defect.

**What to do:** Compare task/attempt and receipt. Preserve the reference and report the contradiction if it persists. Do not use a second completion control as a workaround.

**Read the steps:** Confirm sample drying and find its receipt → If something differs. Canonical source: `prep-drying`, proposed stable problem ID `prep-drying-problem-2`. Assign once and retain across edits.

### The analysis is still blocked

Another prerequisite remains unmet.

**What to do:** Open the specific blocker explanation. Finish only the work assigned and permitted to you.

**Read the steps:** Confirm sample drying and find its receipt → If something differs. Canonical source: `prep-drying`, proposed stable problem ID `prep-drying-problem-3`. Assign once and retain across edits.

### Manager says the task must be submitted, but the technician has no Submit action

The task's operational and analytical workflows may have been mixed, or the UI is inconsistent.

**What to do:** Preserve the preparation receipt and report the exact state mismatch. Do not tell either user to fabricate an analytical value or bypass the server rule.

**Read the steps:** Preparation looks incomplete after confirmation → If something differs. Canonical source: `prep-receipt`, proposed stable problem ID `prep-receipt-problem-1`. Assign once and retain across edits.

### No location recorded after resuming

The draft may have lost its source link or the source may truly lack location.

**What to do:** Compare field provenance first. Preserve existing data and report a broken link rather than adding guessed coordinates.

**Read the steps:** Receive a project sample → If something differs. Canonical source: `intake-project`, proposed stable problem ID `intake-project-problem-1`. Assign once and retain across edits.

### Duplicate identifier

More than one candidate or an existing receipt needs reconciliation.

**What to do:** Inspect the matching project and intake records; do not accept a second record merely to finish quickly.

**Read the steps:** Receive a project sample → If something differs. Canonical source: `intake-project`, proposed stable problem ID `intake-project-problem-2`. Assign once and retain across edits.

### The technician says results were saved, but Review Submissions is empty

Saved and recorded results may still be waiting for submission.

**What to do:** Ask for the submission receipt. If it exists, compare lab and queue filters; otherwise the technician completes the handoff in Workbench.

**Read the steps:** Review a technician's submitted results → If something differs. Canonical source: `review-submission`, proposed stable problem ID `review-submission-problem-1`. Assign once and retain across edits.

### Final approval is disabled

The server reports incomplete or unauthorized conditions.

**What to do:** Read the specific reasons and address them through the owning workflow; do not use another page to bypass the check.

**Read the steps:** Review a technician's submitted results → If something differs. Canonical source: `review-submission`, proposed stable problem ID `review-submission-problem-2`. Assign once and retain across edits.

### Unsupported file or parse failure

The export may not match an implemented profile or may be incomplete.

**What to do:** Keep the original file and record the import error/profile. Ask the instrument/application owner for the supported export path; do not fabricate a scalar result.

**Read the steps:** Import MIR or NIR spectra for assigned work → If something differs. Canonical source: `method-spectral-import`, proposed stable problem ID `method-spectral-import-problem-1`. Assign once and retain across edits.

### Uploaded but the sample is not approved

Import, quality review, prediction and final approval are separate stages.

**What to do:** Read the current stage and its assigned owner. Do not treat library presence as report release.

**Read the steps:** Import MIR or NIR spectra for assigned work → If something differs. Canonical source: `method-spectral-import`, proposed stable problem ID `method-spectral-import-problem-2`. Assign once and retain across edits.

### The manager still sees no result

The device may have synchronized only a draft, or the handoff is still pending.

**What to do:** Identify the last confirmed state and complete the relevant recording/submission step if permitted.

**Read the steps:** Synchronize and verify queued work → If something differs. Canonical source: `offline-sync`, proposed stable problem ID `offline-sync-problem-1`. Assign once and retain across edits.

### An attachment remains pending

The data action and file transfer may have different outcomes.

**What to do:** Keep the original file and inspect the attachment's own status rather than assuming the entire sample failed.

**Read the steps:** Synchronize and verify queued work → If something differs. Canonical source: `offline-sync`, proposed stable problem ID `offline-sync-problem-2`. Assign once and retain across edits.

### My edit does not appear in Help

The change may be a draft, belong to another group/locale, or be excluded from the current publication.

**What to do:** Inspect the published article/locale revision and release membership. Do not repeatedly overwrite the source English text.

**Read the steps:** Correct a translation without changing scientific meaning → If something differs. Canonical source: `admin-translation`, proposed stable problem ID `admin-translation-problem-1`. Assign once and retain across edits.

### A scientific term is ambiguous

The method context may change its meaning.

**What to do:** Provide the method and source phrase to the terminology owner and resolve the meaning before publication.

**Read the steps:** Correct a translation without changing scientific meaning → If something differs. Canonical source: `admin-translation`, proposed stable problem ID `admin-translation-problem-2`. Assign once and retain across edits.