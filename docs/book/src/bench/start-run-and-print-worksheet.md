# Start an Analytical Run and Print a Bench Worksheet

## What This Is For

Group a set of prepared soil samples into a numbered analytical run that shares one method, one calibrated instrument, and one set of quality control positions, and print a paper A4 worksheet with barcodes for the bench.

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-start-run.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Start run** form on the **My runs** tab showing **Analysis**, **Method revision**, **Instrument**, **LRM lot for this run**, **Select all eligible**, and **Confirm and start**.*

---

## Before You Start

- Sign in with a **Laboratory Technician** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Make sure the samples you want to include have completed **Air Drying** and **Sample Preparation** and are assigned to you.
- Check that the instrument you plan to use is calibrated and active in **Equipment**, and that your reference soil lot is active.

---

## Steps

1. Click **Workbench** in the left menu and stay on the **My runs** tab.
2. In the **Start run** panel, select the test you are running today under **Analysis** (**Choose analysis**).
3. Under **Method revision** (**Choose method**), select your laboratory's standard operating procedure for this test.
4. Under **Instrument**, select the specific balance, meter, or analyzer you are using (**Choose instrument**), or keep **Manual method** if the method does not use an instrument.
5. If your laboratory tracks control charts for this method, select the active reference soil lot under **LRM lot for this run** (**Choose an LRM lot**).
6. Select the samples to include in your batch:
   - Click **Select all eligible** to include all ready samples up to your laboratory's batch size limit, or tick individual sample checkboxes.
   - Or click inside **Scan a sample barcode** and scan each sample container on your rack.
   *You should see the **Selected samples** counter update as you add samples.*
7. Click **Confirm and start**.
   *You should see the new run open in the **Worksheet** tab with a **Run header** showing the frozen **Instrument**, **Method revision**, **Analyst**, and **First start** time, plus rows for your samples and quality control checks.*
8. If you want to link chemical or standard lots used in this run, open **Reagent lots (optional)** in the **Run header**, choose a lot under **Select an available lot**, enter an optional role in **Role (optional)**, and click **Add lot**.
9. To print a paper bench sheet before moving to the fume hood or balance, click **Download worksheet PDF** in the **Run header**.
   *You should see an A4 PDF download containing the run sequence, sample barcodes, blank columns for raw readings, and signature lines.*

---

## What Happens Next

Your run is now active and ready for measurements. Proceed to [Enter Results, Replicates, and Raw Calculations](enter-results-and-replicates.md) or [Paste Spreadsheet Rows or Import an Instrument File](paste-or-import-results.md).

---

## If Something Goes Wrong

- *If you see* **Select an eligible, ready instrument for this method.** *(or* **Calibration verification requires a registered instrument. Ask a manager to select one before starting.***) →* The instrument's calibration is overdue or not mapped to this method. Ask your **Laboratory Manager** to update its calibration in **Equipment**.
- *If you see* **The laboratory policy capacity is reached. Select fewer samples.** *→* Your laboratory sets a maximum number of samples per batch under **Policies** (many laboratories use 20 samples per batch). Untick extra samples so they go into a second run.
- *If you see* **No eligible samples for this method.** *→* Check whether the samples still need **Air Drying** or **Sample Preparation** confirmed in **Workbench**.

---

## For the QA Person

- Clicking **Confirm and start** freezes the **Method revision**, **Instrument**, **LRM lot for this run** (**Lot frozen at run start**), and quality control evaluation rules (**Frozen at first start**) so later configuration changes never alter an in-progress or historical run.
- Linking **Reagent lots (optional)** records lot traceability on the run evidence; if a wrong lot was linked by mistake, clicking **Withdraw** requires a documented **Reason for withdrawal**.
