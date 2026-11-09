# Enter Results, Replicates, and Raw Calculations

## What This Is For

Enter sample readings in the **Workbench** worksheet grid using your keyboard or barcode scanner. You can also record side-by-side sample replicates (**Rep 1**, **Rep 2**, **Rep 3**), enter raw bench weights or titration volumes for automatic calculation, and handle out-of-range values.

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-enter-results-grid.png (screenshot coming once the training data is ready): The **Worksheet** grid showing sample rows, **Scan a sample barcode (F2)**, **Rep 1** and **Rep 2** cells, **Raw measurements**, and **Draft saved** badges.*

---

## Before You Start

- Sign in with a **Laboratory Technician** account. Open your started run in **Workbench** on the **Worksheet** tab (see [Start an Analytical Run and Print a Bench Worksheet](start-run-and-print-worksheet.md)).
- If you are working with gloves on a touch screen, click **Bench** next to **Workbench density** at the top right.

---

## Steps

### Part 1: Type Single Measurements or Scan Sample Barcodes

1. To jump directly to a sample row in your run, scan the sample's barcode into **Scan** (**Scan a sample barcode (F2)**) or type its ID into **Find sample ID...**.
   *You should see the worksheet highlight that sample's row and place your cursor inside its measurement box.*
2. Type the reading and press Enter on your keyboard to move straight down to the next sample row.
   *You should see the row badge change from **Pending** to **Draft saved**. The top status pill shows **✓ Drafts saved**.*
3. If you weighed the test portion from a specific sub-container, select that container under **Physical aliquot (optional)**.

### Part 2: Enter Sample Replicates (**Rep 1**, **Rep 2**, **Rep 3**)

1. When your laboratory's policy or method requires duplicate readings on each sample, the row shows **Rep 1** and **Rep 2** boxes side by side.
2. Type both readings.
   *You should see the live **Mean**, **RPD** (or **Range**), and agreement status (**Pair passes** or **Pair fails**).*
3. If the first two readings disagree (**Pair fails**), record them first. Then enter a third reading in **Rep 3** (**Run third replicate**) so the reviewer can evaluate all three readings.

### Part 3: Enter Raw Bench Measurements for Automatic Calculation

1. When an **Active method calculation** template is turned on for your method, the row shows **Raw measurements** instead of a single final box. This is common for moisture, Walkley-Black organic carbon, Kjeldahl nitrogen, and colorimetric extraction.
2. If the method uses a **Calibration curve**, enter each **Standard concentration** and **Response** in the curve panel (**Add standard or replicate**). Click **Record calibration revision** first.
3. In each sample row, type your raw bench numbers. Depending on the method, these include **Container tare mass**, **Container and wet soil mass**, **Container and dry soil mass**, **Soil sample mass**, **Blank titre**, **Sample titre**, **Sample absorbance**, **Extract volume**, or **Recorded dilution factor**.
4. Check the **Calculated preview** and click **Use calculated result**.

### Part 4: Handle Readings Below LOQ, Above Calibration Range, or Outside Typical Range

1. If a reading is below the method's limit of quantification (**Below method LOQ**), click **Fill method LOQ** to apply the method's < LOQ reporting rule.
2. If a reading exceeds the highest calibration standard (**Above calibration range**), record the initial reading first (**Record this reading first, then request a dilution repeat.**). Next, enter a **Reason** and click **Dilute and repeat?**.
3. If a special soil sample falls **Outside typical range** (for example, a strongly saline or acid-sulfate soil), type your technical explanation in **Reason** and click **Request override**.
   *Once your **Laboratory Manager** approves the request under **Override requests**, click **Use this approval** on the row.*

---

## What Happens Next

Your typed or calculated values are saved as drafts (**Draft saved**). Next, enter your quality control positions (see [Record Blanks, Duplicates, and Reference Soils in a Run](enter-qc-and-evaluate.md)). Then confirm and record the run (see [Review, Record, and Submit Completed Samples](record-and-submit-for-review.md)).

---

## If Something Goes Wrong

- *If you accidentally scan a barcode while your cursor is inside a number box →* You will see **Looks like a barcode; scan into the Scan field**. The system automatically protects your number from being overwritten.
- *If you see* **Ambiguous decimal or thousands separator** *(or* **Clarify the decimal or thousands separator.***) →* Type a plain decimal number without thousands separators (for example, type 1250.5 instead of 1,250.5).
- *If you see* **A complete passing calibration for this native run is required.** *→* Check the **Calibration curve** panel. Make sure your standards meet **Minimum distinct standard levels** and **Minimum correlation r**.

---

## For the QA Person

- Raw calculation templates (**Method calculation templates**) compute the final concentration on the server. They freeze the **Recorded calculation evidence** (raw inputs, intermediate factors, template revision, and **Calibration curve**) with the attempt.
- Plausibility overrides (**Request override**) require independent approval from a user with review authority. The analyst who requested the override cannot approve their own request.
