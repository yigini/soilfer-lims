# Paste Spreadsheet Rows or Import an Instrument File

## What This Is For

Bring measurements into your **Workbench** worksheet without re-typing every number by hand, either by pasting two columns from a spreadsheet (**Paste Values**) or by uploading a CSV, TXT, or XLSX export file from an instrument (**Instrument file import**).

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-paste-and-import.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Instrument file import** panel and **Paste preview** modal showing **Saved instrument mapping**, **Preview file**, **Samples matched**, **QC rows**, **Unmatched rows**, and **Import drafts and pending QC**.*

---

## Before You Start

- Sign in with a **Laboratory Technician** account and open your started run or method worksheet in **Workbench** on the **Worksheet** tab.
- Make sure the samples in your spreadsheet or instrument file are already prepared and included in your run.

---

## Steps

### Option A: Paste Two Columns From a Spreadsheet (**Paste Values**)

1. In your spreadsheet, copy two columns: the sample code in column 1 and the measured value in column 2.
2. In the **Workbench** toolbar, click **Paste Values**.
   *You should see the **Paste preview** window open.*
3. Paste your copied rows into the text box and leave **Separator** on **Detect automatically** (or choose **Tab**, **Comma**, or **Semicolon**).
4. Click **Preview matches and exclusions**.
   *You should see each row marked **Matched** or listed as excluded with the reason.*
5. Click the **Apply** button (**draft values**).
   *You should see your worksheet rows update to **Draft saved**.*

### Option B: Upload an Instrument Export File (**Instrument file import**)

1. Open the **Instrument file import** panel in your run worksheet.
2. Under **Saved instrument mapping**, select the column mapping saved for your instrument (or click **Choose or create a mapping** / **Edit column mapping** if you have permission to set up mappings).
3. Under **CSV, TXT or XLSX file**, choose the export file from your computer.
   *If you are importing an Excel workbook with several tabs, type the tab name in **XLSX worksheet name (optional override)**.*
4. Click **Preview file**.
   *You should see a summary of **Samples matched**, **QC rows**, **Unmatched rows**, and any **Issues to review**.*
5. Check the preview table to confirm every sample and quality control row matched the right position and unit.
6. Click **Import drafts and pending QC**.
   *You should see **Imported drafts / QC observations** populate your worksheet rows as **Draft saved** and fill your pending quality control positions.*

---

## What Happens Next

Pasting or importing only fills in drafts (**Paste updates local drafts. Measurements are saved with Record.**). Next, evaluate your quality control checks (see [Record Blanks, Duplicates, and Reference Soils in a Run](enter-qc-and-evaluate.md)) and click **Record all ready** to commit your results (see [Review, Record, and Submit Completed Samples](record-and-submit-for-review.md)).

---

## If Something Goes Wrong

- *If you see* **Review all issues and preview again before importing.** *→* Look at the rows marked **Refused** or **Ambiguous** in the preview table. Common causes include a sample that already has a saved reading (**This line already has work saved or cannot receive a draft.**) or a unit mismatch (**Use the exact configured measurement or input unit.**).
- *If your Excel file contains formulas and you see* **Export formula cells as verified values before importing.** *→* In Excel, paste the column as values (or export to CSV) so the file contains fixed numbers rather than live formulas.
- *If wash or rinse tubes from the autosampler show as* **Unmatched** *→* You do not need to delete them from the file; **Unmatched rows remain in the preview and receipt and are not imported.**

---

## For the QA Person

- Every **Instrument file import** stores an immutable import receipt linking the uploaded file's cryptographic fingerprint, filename, **Saved instrument mapping** revision, and raw **Source cells** to the run.
- Neither **Paste Values** nor **Instrument file import** bypasses validation or review; imported values go through the exact same plausibility checks, quality control evaluation, and preflight confirmation (**Review Determinations Before Recording**) as typed readings.
