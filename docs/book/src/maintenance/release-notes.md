# Release Notes (1.11–1.15)

This page summarizes what laboratory staff, managers, and server administrators will notice in SoilFER-LIMS **1.15.0**, followed by earlier updates.

For step-by-step update instructions, see [Updating SoilFER-LIMS](./updates.md).

---

## Version 1.15.0 — 2026-11-14

- **Instrument checks:** technicians can record calibration, verification and maintenance events for their laboratory. A laboratory setting can require a manager to accept the event; the author cannot sign off their own event. A calibration or verification awaiting acceptance keeps the instrument out of Ready and shows why; the last accepted dates remain visible.
- **Prepared stock:** technicians can record reagent and standard lots for their laboratory, with quantities, units and optional parent-lot references. A laboratory setting can start these lots in quarantine for a manager to release. Recording a parent reference does not consume that stock.
- **Screen languages:** new event choices, sign-off messages and prepared-lot guidance are available in all five screen languages.

## Version 1.14.1 — 2026-11-14

- **New inventory items:** the form starts clear each time you open it, including after creating an item or cancelling. Previous entries and errors are cleared.
- **Stock dialogs:** Add Item, Receive Stock and lot actions follow the selected screen language in all five supported languages.

## Version 1.14.0 — 2026-11-14

- **First sign-in and account resets:** the required password update opens without crashing for a new administrator or a user whose password was reset. The server command in the reset guide now works with the current application.
- **Find the manual:** an optional Manual link opens the configured guide address. Administrators can leave the address empty to hide the link while the hosted manual is being prepared.
- **Support contact:** the default support address comes from one shared setting. Contacts already configured by administrators are kept.
- **Workbench languages:** queues, numeric worksheets, submission and review screens, confirmation logs and the review-card labels use the selected screen language. Result values, method names and recorded status codes stay as data.
- **Current Help guides:** menus, counts and search hide 17 older duplicate entries. Existing article identifiers and direct links continue to work; Help content remains v1.4.1.
- **Practice before launch:** a repeatable Demo Soil Lab seed provides fictional exercises on a separate local copy. French and Portuguese pictures show the same practice records in the first-day guides. Practice data is never loaded automatically into a working laboratory.

## Version 1.13.1 — 2026-11-13

- **First-day task order:** reception receives and accepts the practice samples before the manager assigns work. Technicians then prepare and submit batches for review. When two-person review is on, the reviewer must be a different person from the analyst.
- **Bench PIN guidance:** use a personal 4 to 8 digit PIN in the Workbench PIN dialog, confirmed with your account password when first set. Help v1.4.1 gives the same instructions in all five languages.
- **Policy editing:** Edit and Clear open directly under the selected setting, including rows in Overrides. A highlight identifies the row, a hint explains the required reason, unavailable scopes are explained, and switching away from an unsaved edit asks for confirmation.

## Version 1.13.0 — 2026-11-11

- *Built-in Help rewritten in plain words in 5 languages:* Every guide in **Help** (**Help with this page** and **Help Centre**) has been rewritten in short, everyday sentences across English, French, Portuguese, Spanish, and Latin American Spanish, so reception and bench staff can look up answers without technical jargon.

### Everyday words on screen: Old word on screen → new word

Buttons, tabs, status badges, and quality control messages across all five languages (English, French, Portuguese, Spanish, and Latin American Spanish) now use everyday laboratory words instead of technical terms. Every button still does the exact same job, and all saved sample, batch, and report records stay intact.

If you learned the earlier screen names, use this table to find the new label on each screen:

| Screen | Old word on screen | New word on screen |
| :--- | :--- | :--- |
| **Sample Reception** | *Consignment Batch* | **Sample delivery box** |
| **Sample Reception** | *Switch to Consignment Batch Mode* | **Switch to sample delivery box mode** |
| **Sample Reception** | *Complete Intake / Submit Consignment* | **Finish check-in or submit delivery box** |
| **Sample Reception** | *Recent Receipts* | **Recent check-ins** |
| **Sample Reception** | *Prior Receipt Detected for {id}* | **Sample ID {id} was already checked in** |
| **Sample Reception** | *Flag as Non-Conformance* | **Record a problem** |
| **Sample Reception** | *Reject sample due to non-conformance* | **Reject sample and record problem** |
| **Sample Reception** | *Non-Conformance Description \** | **Describe the problem \*** |
| **Sample Reception** | *Non-Conformance Recorded* | **Problem recorded** |
| **Sample Reception** | *Rejected (Non-Conformance)* | **Rejected (problem recorded)** |
| **Workbench** | *Operational Gates* / *Operational gate* | **Required prep steps** / **Required prep step** |
| **Workbench** | *Drying Gate:* | **Drying step:** |
| **Workbench** | *Preparation Gate:* | **Sieving & grinding step:** |
| **Workbench** | *Worksheet locked until operational preparation gate completes.* | **Worksheet locked until the required prep step is complete.** |
| **Workbench** | *Confirm Complete* | **Confirm work is done** |
| **Workbench** | *Confirm {analysisName} Complete* | **Confirm {analysisName} is done** |
| **Workbench** | *Activity Receipts ({count})* | **Saved confirmation log ({count})** |
| **Workbench** | *Native run* | **Standard batch run** |
| **Workbench** | *Rebuild native run* | **Set up batch run** |
| **Workbench** | *Bound reference lot* | **Linked check soil bottle** |
| **Workbench** | *Save reference bindings* | **Save check soil bottles for this run** |
| **Workbench** | *A complete passing calibration for this native run is required.* | **This standard batch run needs a complete calibration that passed its checks.** |
| **Workbench** | *Preview requires a started native run with frozen criteria.* | **Start a standard batch run and save its QC rules before previewing it.** |
| **Workbench** | *Use the entry flow corresponding to this run’s recorded provenance.* | **Use the steps for this run’s recorded type.** |
| **Workbench** | *Attempts* / *Attempt* / *Attempt #{number}* | **Tries** / **Try** / **Try #{number}** |
| **Workbench** | *Linked attempt* | **Linked try** |
| **Workbench** | *Recover previous attempt* | **Check if last try was saved** |
| **Workbench** | *Discard attempt* | **Clear unfinished try** |
| **Workbench** | *Request override* | **Ask reviewer to approve unusual value** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Reported value* | **Final report value** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Save reported value* | **Save final report value** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Report attempt* | **Use this try on report** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Include attempt in mean* | **Include try in average** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Choose a reported value before accepting this test.* | **Choose a final report value before accepting this test.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Choose a complete eligible attempt or mean.* | **Pick a finished, valid try or average.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Several eligible attempts are available; a reviewer must choose.* | **More than one valid try exists; a reviewer must pick one.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *No complete eligible attempt is available.* | **No finished, valid try yet.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *The selected attempts need matching recorded limits, methods and controlled units.* | **The selected tries need matching recorded limits, methods and units.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *The evidence changed. Review the attempts and choose again.* | **The evidence changed. Review the tries and choose again.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *These calculations do not select the reported value. Review decides the reported value.* | **These calculations do not choose the final report value. A reviewer chooses it.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Before a reported value is selected, the panel shows the retained submission checks.* | **Until someone chooses the final report value, this panel shows the saved submission checks.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Reported value unavailable* / *Reported-value evidence is unavailable.* | **Final report value unavailable** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *QC within limits for all reported values.* | **All final report values passed their quality checks.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *QC warning: One or more reported values have failed or incomplete batch QC. See the recorded batch warnings.* | **Quality warning: One or more final report values have failed or incomplete batch checks. See the recorded warnings.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Override requests* | **Unusual-value requests** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *No override requests.* / *Could not load override requests.* | **No requests for unusual values.** / **Could not load requests for unusual values.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Request a repeat-limit override* | **Ask manager for an extra repeat try** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Authorising this override raises a repeat-limit nonconformity for this work line.* | **Approving this extra try records a repeat-limit problem for this work item.** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Imported, no attempt* | **Imported with no recorded try** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Superseded* / *SUPERSEDED* | **Replaced by newer version** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *Superseded measurements* | **Measurements replaced by newer versions** |
| *Review* (**Manager Task List**, **Samples** & **Reports**) | *This report has been superseded by an amended report. Ask the laboratory for the current report.* | **A newer version replaced this report. Ask the laboratory for the current report.** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Awaiting disposition* | **Waiting for manager decision** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Batches awaiting disposition* | **Batches waiting for a manager decision** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Batches require disposition* | **Batches need a manager decision** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Failed batch QC requires a manager disposition.* | **The batch failed quality checks. The lab manager must record a decision.** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Record Manager QC Disposition* | **Save manager batch decision** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Confirm Manager Disposition* | **Confirm manager decision** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Recording Disposition…* | **Saving manager decision…** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Manager QC Disposition (Recorded — Read Only)* | **Manager batch decision (read only)** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Review actual QC control values and disposition before accepting work.* | **Review the QC values and the manager's batch decision before accepting the work.** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Repeat calibration bracket* | **Repeat samples since last good instrument check** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Non-Conformance* / *Non-conformance* | **Problem record** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Nonconformities* | **Problem records** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Open NCRs* | **Open problem records** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Non-conformance reason* | **Reason for problem record** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Loading nonconformities…* / *No nonconformities match these filters.* / *Unable to load nonconformities.* | **Loading problem records…** / **No problem records match these filters.** / **Unable to load problem records.** |
| *QC* (**QA Dashboard** & Batch Decisions) | *Choose a supported nonconformity command.* / *Nonconformity not found.* | **Choose an available action for this problem record.** / **Problem record not found.** |
| *Settings* (**Policies** & **Reference materials**) | *Preset* | **Starting rule set** |
| *Settings* (**Policies** & **Reference materials**) | *Save preset* | **Save starting rule set** |
| *Settings* (**Policies** & **Reference materials**) | *Compared with preset* | **Compared with starting rules** |
| *Settings* (**Policies** & **Reference materials**) | *Differs from preset* | **Customised from starting rules** |
| *Settings* (**Policies** & **Reference materials**) | *Laboratory preset* | **Lab starting rules** |
| *Settings* (**Policies** & **Reference materials**) | *Deployment preset* | **Installation starting rules** |
| *Settings* (**Policies** & **Reference materials**) | *Reported-value selection rule* | **Rule for picking the final report value** |
| *Settings* (**Policies** & **Reference materials**) | *Analysis and method overrides* | **Custom rules per test or method** |
| *Settings* (**Policies** & **Reference materials**) | *Method override* / *Analysis override* / *Laboratory override* / *Deployment override* | **Custom method rule** / **Custom test rule** / **Custom lab rule** / **Custom installation rule** |
| *Settings* (**Policies** & **Reference materials**) | *Clear override* | **Reset to lab default** |
| *Settings* (**Policies** & **Reference materials**) | *QC rules are immutable; save a new version.* | **Past QC rules can't be edited; save a new version instead.** |
| *Settings* (**Policies** & **Reference materials**) | *This value has already been superseded. Reload before correcting.* | **This value was replaced. Reload before correcting it.** |
| *Settings* (**Policies** & **Reference materials**) | *Require manager verification of preparation gates* | **Require manager sign-off on preparation steps** |
| *Settings* (**Policies** & **Reference materials**) | *Consignment number format* | **Delivery box number format** |
| *Settings* (**Policies** & **Reference materials**) | *Restart consignment numbering* | **Reset delivery box numbering** |

### Other improvements in this update

- *Clearer row-by-row errors during delivery box upload:* When checking in a box of samples in **Sample Reception**, any row that cannot be accepted now shows its exact row number and sample code (**Row {row} (sample {id}): {message}**). If a sample ID was already registered earlier in the system, the message clearly states **This sample ID is already registered. Sample IDs must be unique across the system.**
- *Clearer bench PIN setup on shared computers:* When a technician sets up a personal PIN for the first time in **Workbench**, the **Set your bench PIN** window clearly labels **New bench PIN (4–8 digits)** with the hint **Use only the digits 0 to 9.** and **Your password**, keeping every label translated in the chosen screen language.
- *Only Super Administrators can create a new laboratory:* Creating a new laboratory in **Lab Management** (**Onboard Laboratory**) is now restricted to **Super Administrator** accounts. **Laboratory Manager** accounts continue managing their own laboratory's profile, branding, staff, and daily settings.

---

## Version 1.12

### What Staff Notice: Sign-In and Passwords

- **12-character personal passwords:** When staff set or change a password, it must be at least **12 characters** long and different from their previous password.
- **First sign-in with a temporary password:** When a staff member signs in with a temporary password—either on a brand-new account or after an administrator resets their password—SoilFER-LIMS immediately opens the **Security Update Required** prompt so they can choose their own personal password before opening any laboratory screens.
- **Short pause after repeated wrong attempts:** If several wrong sign-in attempts are made in a row, the account is paused for a short time. Staff can simply wait a moment and try again carefully, or ask their Laboratory Manager to issue a new temporary password.
- **Administrator password resets:** Staff who forget their password can click **Forgot password?** on the sign-in screen for instructions to contact their Laboratory Manager, who can generate a temporary password in **Laboratory Staff** (`/users`).

### What Administrators Notice: Installation & Configuration Settings

- **New deployment and sign-in configuration options:** Version 1.12 adds environment settings for reverse-proxy deployments, browser origin allowlists, request size settings, and sign-in policy tuning.
- **Where to review the settings:** When installing a new server or updating an existing `.env` file, review:
  - [Configuration](../installation/configuration.md) and [Environment Variables](../reference/environment-variables.md) in this book;
  - [HTTP Deployment Settings](../../../http-deployment-settings.md) for reverse-proxy and browser origin settings;
  - [Sign-in & Password Protection](../../../sign-in-protection.md) for password and sign-in policy settings.

---

## Version 1.11

### In-App Help Center Refresh (`v1.1.0`)

- **Complete 5-language Help & Lab Guide (`/help`):** The in-app Help Center (`v1.1.0`) has been refreshed across all five supported languages—**English (`en`), Spanish (`es`), Latin American Spanish (`es-419`), French (`fr`), and Portuguese (`pt`)**.
- **Role-based step-by-step guides:** Staff can browse or search practical guides tailored to their daily work, including sample reception and physical inspection, drying and preparation, wet-lab batch entry, spectral workflows, quality control review, Certificates of Analysis, and laboratory administration.
- **Contextual & offline-ready help:** Help articles link directly to the screens where staff work and remain readable offline once loaded in the browser.
- **Laboratory notes:** Laboratory Managers and administrators can attach laboratory-specific notes to help articles so local bench instructions appear alongside the standard guide for their team.

### Sample Photos & Everyday Reliability

- **Laboratory-scoped sample photos:** Field collection photos (synchronized from KoboToolbox) and sample reception photos load inside the workspace for staff assigned to that laboratory.
- **Spreadsheet and navigation updates:** Built-in spreadsheet import/export and page navigation components have been refreshed for reliable daily use across reception, bench, and reporting screens.
