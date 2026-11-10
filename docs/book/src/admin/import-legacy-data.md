# Import Historical or Legacy Soil Data

> *Time:* 15 minutes.
> *Who can do this:* Laboratory Administrators, Super Administrators, and Laboratory Managers.

If your laboratory has past soil test results in Excel spreadsheets or CSV files, you can import them into SoilFER LIMS. They will then be searchable alongside new samples. To keep your database trustworthy, every imported result column must be linked to a real parameter, analytical method, and controlled unit.

---

## Before You Start

- Save your historical spreadsheet as a UTF-8 CSV file with one row per sample and a clear header row. Put the sample identifier in the first column and one soil property in each remaining column.
- Check which analytical method and unit of measure were used for each column in your historical dataset.

---

## Steps

### Step 1: Upload or paste your historical CSV dataset

1. Open the legacy import tool (**Legacy Historical Data Harmonisation & Import**).
2. Under **Step 1: Provide Historical CSV Dataset**, if you have access to more than one facility, select your **Target Lab:** in the top right of the card.
3. Click **Upload CSV File** to choose your CSV file from your computer, or paste the rows into **Or Paste CSV Text**.
4. Click the button at the bottom of Step 1 to parse and analyze the CSV columns.

### Step 2: Confirm the sample identifier column and map every result column

1. Under **Mandatory Harmonisation Metadata Enforcement**, verify the **Sample Identifier Column:** dropdown points to the column containing your historical sample IDs.
2. In the column mapping table, inspect each **CSV Column** row:
   - Under **Analysis Parameter (WP-16)**, select the matching parameter from **-- Select Analysis --**.
   - Under **Methodology / Standard (WP-18)**, select the analytical method from **-- Select Method --**.
   - Under **Controlled Unit (WP-17)**, select the reporting unit from **-- Select Unit --**.
3. Check the **Status** column on the right side of the table. Every row must change from **Incomplete** (amber) to **Ready** (green).

### Step 3: Execute the historical import

1. Once every parameter column shows **Ready**, click **Execute Historical Import (Provenance: IMPORTED)** in the bottom right.
2. A green banner confirms how many samples and results were imported. All imported records are permanently tagged as imported historical data so reviewers, reports, and national data harvesters can distinguish historical spreadsheet imports from live bench runs.

---

## What If Something Goes Wrong?

| Problem | What to Do |
| :--- | :--- |
| *Execute button is disabled and a row shows* **Incomplete** | Every column (except the **Sample Identifier Column:**) must have an analysis parameter, a method, and a unit selected. If your CSV has extra notes or non-result columns you do not want to import, remove those columns in Excel and re-upload the CSV. |
| *A historical test parameter or method is missing from the dropdown* | Open **Admin Panel** → **Analysis Configuration**, add or activate the parameter and method first (see [Switch On Analytical Methods, Calculations, and QC Rules](./enable-methods-and-qc-rules.md)), and then return to the import screen. |

---

## Related Tasks

- [Switch On Analytical Methods, Calculations, and QC Rules](./enable-methods-and-qc-rules.md)
- [Controlled Units & Agronomic Interpretation](../usage/agronomic-interpretation.md)
- [Data Exchange, NSIS / OpenNSIS & API v2](../usage/data-exchange.md)

---

### For the QA Person

- *Explicit provenance tagging:* Results brought in through **Legacy Historical Data Harmonisation & Import** are stored with imported provenance rather than bench attempt lineage. Auditors and National Soil Information System harvesters never confuse legacy spreadsheet values with newly measured laboratory runs.
- *Mandatory method and unit binding:* Unmapped numbers without a method or unit are rejected before import so historical datasets never pollute national soil maps with ambiguous units.
