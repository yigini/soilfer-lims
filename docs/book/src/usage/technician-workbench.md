# Technician: Workbench & Analytical Runs

## What This Is For

Use **Workbench** to organize your daily analytical runs, print paper bench worksheets, enter or import measurements, record quality control checks (*blanks*, *duplicates*, and *reference soils*; see [Glossary](../reference/glossary.md)), and send finished samples for review. Choose the task guide below that matches what you are doing at the bench right now.

| What are you doing at the bench? | Open this task page |
|---|---|
| Checking which samples and runs are assigned to you today | [Find Your Assigned Work and Open a Run](../bench/find-my-work.md) |
| Picking a method, instrument, and samples to start a new run or print a paper worksheet | [Start an Analytical Run and Print a Bench Worksheet](../bench/start-run-and-print-worksheet.md) |
| Typing single values, duplicate pairs, or raw weights and titrations | [Enter Results, Replicates, and Raw Calculations](../bench/enter-results-and-replicates.md) |
| Pasting two columns from Excel or uploading an ICP, AAS, or UV-Vis export file | [Paste Spreadsheet Rows or Import an Instrument File](../bench/paste-or-import-results.md) |
| Entering values for the blank, duplicate, and reference soil rows in your run | [Record Blanks, Duplicates, and Reference Soils in a Run](../bench/enter-qc-and-evaluate.md) |
| Recording sand, silt, and clay percentages or uploading MIR and Vis-NIR spectra | [Record Soil Texture (Sand, Silt, Clay) and Spectra](../bench/texture-and-spectra.md) |
| Confirming your ready rows and sending finished samples to the reviewer | [Review, Record, and Submit Completed Samples](../bench/record-and-submit-for-review.md) |
| Locking a shared bench PC with a PIN, switching analysts, or repeating a returned test | [Use Shared Bench Mode and Fix Returned or Repeated Work](../bench/shared-bench-and-returned-work.md) |

> *Screenshot placeholder — docs/book/src/img/screenshots/workbench-overview.png (screenshot coming once the training data is ready): The **Technician Workbench** showing the **My runs**, **My Work**, **Worksheet**, **Ready to Submit**, **Sent & Completed**, and **Activity Receipts** tabs, plus the **Workbench density** toggle.*

---

## Before You Start

- Sign in with a **Laboratory Technician** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Make sure the samples you plan to test have completed **Air Drying** and **Sample Preparation** (see [Preparation: Drying, Grinding, Storage & Custody](preparation-and-custody.md)).
- If you share a bench computer with colleagues, check that **Turn on bench mode** is active and your personal **PIN** is set.

---

## Steps

1. Click **Workbench** in the left menu.
   *You should see the **Technician Workbench** open on the **My runs** tab.*
2. Start a new run under **Start run** (or click **Open run worksheet** on an existing run in **My runs**).
3. If you record readings on paper at the balance or hood first, click **Download worksheet PDF** in the **Run header** to print the A4 bench sheet with sample barcodes.
4. Enter your sample measurements in the **Worksheet** tab by typing in the grid, entering **Raw measurements** for a calculation template, clicking **Paste Values**, or using **Instrument file import**.
5. Enter the readings for the quality control positions in the run, click **Save observations**, and click **Evaluate QC**.
6. Click **Record all ready** at the bottom of the worksheet, tick the verification checkbox on the **Review Determinations Before Recording** screen, and click the green **Record** button (**Determination**).
   *You should see the recorded rows change from **Draft saved** to **Recorded**.*
7. Open the **Ready to Submit** tab, tick **I confirm that the selected samples are complete and ready for managerial review.**, and click the green **Submit** button (**for Review**).
   *You should see the submitted samples move to **Sent & Completed** with status **Submitted**.*

---

## What Happens Next

Your submitted samples appear in your manager's **Manager Task List** under **Review Submissions**. If the reviewer accepts them, they advance to **Accepted** and **Approved**. If the reviewer returns an item for a repeat check, it reappears in your queue as **Repeat requested** (see [Use Shared Bench Mode and Fix Returned or Repeated Work](../bench/shared-bench-and-returned-work.md)).

---

## If Something Goes Wrong

- *If a sample row in the worksheet says* **Blocked** *→* Check the **Readiness & State** column. Complete **Air Drying** and **Sample Preparation** first, or ask a manager to resolve an open hold (**Sample held**).
- *If you see* **Select the required run instrument for this method.** *→* Choose a calibrated instrument in **Choose instrument** before clicking **Confirm and start**.
- *If you see* **Recording was not confirmed for this row.** *→* Your typed number is still only a draft (**Draft saved**). Click **Record all ready** (or **Record this sample** in **Card View**) to save the official result.

---

## For the QA Person

- SoilFER LIMS uses a run-first workflow: clicking **Confirm and start** (**Start run**) freezes the **Method revision**, **Instrument**, **Analyst**, and quality control limits (**Frozen at first start**) for every row in the run.
- Typing or importing values into the worksheet saves recoverable drafts (**✓ Drafts saved**), while recording writes a numbered attempt under **Attempts** only after the analyst confirms the preflight check (**Review Determinations Before Recording**).
- Submitting (**Review & Submit Samples for Review**) locks the recorded determinations so they become read-only for technicians while awaiting independent managerial review.
