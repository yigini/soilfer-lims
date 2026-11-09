# Unknown or Duplicate Sample ID & Missing Location

## What This Is For

Resolve the three most common identity problems at reception: a barcode not found in the manifest, a sample ID that was already received, or a field sample with missing location details.

> *Screenshot placeholder — docs/book/src/img/screenshots/reception-id-lookup.png (screenshot coming once the training data is ready): The **1. ID & Field** step in **Sample Reception** showing barcode lookup, duplicate warning, and the **Soil profile / sampling point** section.*

---

## Before You Start

- Sign in with a **Sample Reception** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Keep the physical bag and any paper delivery slip in front of you so you can read the full code.

---

## Steps

### Case 1: Barcode or Sample ID Is Not Found in the Manifest

1. When you see **Sample Not Found** (or **Not Found**) in **Project Sample**, double-check the characters on the bag. Check whether a zero was typed as the letter O.
2. Click **Samples** in the left menu and switch to **Field Registry**. Use **Search by Lab ID or Original ID...** to check whether the sample was registered under another project code.
3. If the sample was collected with KoboToolbox today, ask your **Laboratory Manager** to synchronize the project form. See [KoboToolbox Field Integration](../usage/kobotoolbox.md), then click **Try Again** in **Sample Reception**.
4. If the bag came from a client without a digital manifest, return to **Sample Reception**. Click **Walk-in / External** and register the sample there.

### Case 2: The Sample ID Shows as Already Received (Duplicate ID)

1. If you scan a bag and see **Prior Receipt Detected for** your sample ID (with the message **This sample ID was previously received on** a prior date), stop and check the details on screen.
2. Check whether a colleague already checked in this exact bag earlier today. If so, click **Cancel / Clear ID** and reprint its label from **Samples** if needed.
3. If the field team sent a *second* physical bag with the same field code, click **✓ Confirm as Re-submission**. Explain why in **Intake Notes / Visual Observations**.
   *You should see the new bag accepted under its own distinct **Permanent Lab ID**.*

### Case 3: Missing GPS Coordinates or Unknown Soil Profile Reference

1. If the field sheet does not state whether the bag came from a soil pit or surface point, check **Soil profile / sampling point**.
2. Click **Record as unknown** (which sets **Recorded meaning** to **Not recorded**). Do not guess whether it is a **Confirmed soil profile / pit**.
3. If the field sheet arrives later, open the sample in **Samples** and go to the **Sample & request** tab.
4. Click **Correct the field reference**, enter the verified code and **Reason and source verification (required)**, and save.
   *You should see the field provenance updated without altering any laboratory test results.*

---

## What Happens Next

Once the identity is confirmed and intake is completed, the sample receives its **Permanent Lab ID** and moves to **Accepted** (**Waiting for drying**). If you cannot resolve an unknown bag right away, click **Save Draft** or place a **Provenance** hold in **Sample holds**.

---

## If Something Goes Wrong

- *If you see* **The stored profile reference needs review. Laboratory work is preserved.** *→* Open the **Sample & request** tab and click **Correct the field reference**. Verify the original field sheet and enter the explanation in **Reason and source verification (required)**.
- *If your handheld scanner types part of a barcode into the wrong box →* Click **Cancel / Clear ID**, click inside **Search manifest by Sample ID...** (or click **Scan**), and scan again.

---

## For the QA Person

- Every physical bag accepted by the laboratory receives a unique **Permanent Lab ID** even when two bags share a field code through **✓ Confirm as Re-submission**.
- Updating **Soil profile / sampling point** via **Correct the field reference** records a provenance correction with **Reason and source verification (required)**. Analytical results and released reports remain intact.
