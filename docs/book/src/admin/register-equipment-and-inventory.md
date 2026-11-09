# Register Instruments, Log Calibrations, and Track Reagent Stock

> *Time:* 10–15 minutes.
> *Who can do this:* Laboratory Administrators, Laboratory Managers, Quality & Audit Officers, and operators.

This guide shows you how to register laboratory instruments and log calibration dates. It also covers adding reference material lots (**CRM** and **LRM**) and tracking reagent stock.

---

## Before You Start

- Gather the serial numbers, bench locations, and calibration due dates for your main instruments.
- Have the certificate sheet or consensus values ready for any **Certified reference material (CRM)** or **Laboratory reference material (LRM)** lot you are entering.

---

## Task A: Register an Instrument and Log Its Calibration

### Step 1: Register the asset in Equipment

1. Click **Equipment** (**Equipment & Instruments**) in the left navigation bar.
2. Click **Register New Asset**.
3. Fill in the instrument details:
   - **Instrument Name** (for example, *Bench pH Meter 01*)
   - **Internal Asset Tag** and **Serial Number**
   - **Instrument Type**, **Manufacturer**, and **Model**
   - **Room / Bench Location** and **Responsible Operator**
   - **Service Status** (set to **In Service** for active bench equipment)
4. Save the asset.

### Step 2: Log a calibration or verification date

1. On the instrument's row in **Equipment**, click **Log Event / Calibration**.
2. Select the **Event Type**: **Calibration**, **Verification**, or **Maintenance**.
3. Enter the **Date Performed** and the **Next Due Date**, add your calibration notes, and save.
4. Check that the instrument's **ISO Readiness** badge updates to **Ready / Calibrated**. It will show **Calibration Expiring Soon** as the due date approaches, or **Calibration Overdue / Blocked** if the date passes.
5. You can export your full equipment register at any time by clicking **Export Assets (CSV)**.

*(Screenshot placeholder: registering an instrument with calibration due date and reference material lot — screenshot coming once the training data is ready)*

---

## Task B: Add a Reference Material Lot and Its Assigned Values

### Step 1: Create the reference lot

1. Open **Admin Panel** and click the **Quality** tab (**Reference materials**).
2. Select your **Laboratory** and click **Add reference lot**.
3. Fill in the lot identity:
   - **Code** and **Name** (for example, *LRM-SOIL-01*)
   - **Kind**: choose **Certified reference material (CRM)**, **Laboratory reference material (LRM)**, **Check standard**, **Calibration standard**, or **Blank matrix**
   - **Matrix**, **Supplier**, **Certificate reference**, and **Lot number**
   - **Expiry (your local time)** and **Opened (your local time)**
   - **Status**: **Active**
4. Click **Save**.

### Step 2: Enter the assigned values by analyte

1. Click your reference lot row to open **Assigned values by analyte**, then click **Add assigned value**.
2. Select the **Analyte** and **Method (optional)** (choose **Method independent** only if the reference value applies across all methods for that analyte).
3. Select the **Value type** (**Certified**, **Indicative**, **Consensus**, or **Lab assigned**).
4. Enter the **Assigned value** and **Unit** using your laboratory's number format. If the certificate includes uncertainty, enter both **Expanded uncertainty** and **Certificate coverage factor (k)**.
5. Click **Save**.
6. If you ever need to update an assigned value later, click **Correct by new revision**, enter a **Reason**, and click **Save**. Earlier revisions remain marked **Superseded** while the new one becomes **Current**.

---

## Task C: Add Reagents and Adjust Inventory Stock

1. Click **Inventory** (**Reagents & Inventory**) in the left sidebar.
2. Click **Add Inventory Item** and fill in:
   - **Item Name**, **Item Code / SKU**, and **Category** (**Reagents & Chemicals**, **Reference Standards (CRM)**, **Consumables & Labware**, or **Glassware**)
   - **Current Quantity**, **Unit of Measure**, and **Minimum Alert Threshold**
   - **Lot / Batch Number**, **Expiration Date**, **Storage Location / Shelf**, and **Supplier**
3. When technicians open a new bottle or use stock, click **Adjust Stock** on that row to update the **Current Quantity**.

---

## What If Something Goes Wrong?

| Problem | What to Do |
| :--- | :--- |
| *Technicians cannot select an instrument in* **Workbench** | Check **Equipment**: confirm the instrument's **Service Status** is **In Service** and its **ISO Readiness** is **Ready / Calibrated** (not **Calibration Overdue / Blocked**). Log a fresh **Calibration** or **Verification** event if it was recently calibrated. |
| *Screen shows* **This lot cannot be placed. Check its status and expiry.** | In **Admin Panel** → **Quality** (**Reference materials**), check that the lot's **Status** is **Active** (not **Quarantined**, **Expired**, or **Retired**) and that its **Expiry (your local time)** has not passed. |
| *Screen shows* **Supply the certificate coverage factor with expanded uncertainty.** | Whenever you type an **Expanded uncertainty** on a reference material value, also fill in **Certificate coverage factor (k)** (typically 2 on standard certificates). |
| *Screen shows* **CRM use requires a CRM with a certified value for this analyte.** | Make sure the lot's **Kind** is **Certified reference material (CRM)** and that the analyte row under **Assigned values by analyte** has **Value type** set to **Certified**. |

---

## Related Tasks

- [Equipment, Calibration, Reference Materials & PT](../usage/equipment-inventory.md)
- [Technician: Workbench & Analytical Runs](../usage/technician-workbench.md)
- [Lab Go-Live Checklist](./go-live-checklist.md)

---

### For the QA Person

- *End-to-end metrological traceability:* Every analytical run in **Workbench** records the instrument's asset ID and calibration state alongside the exact reference material lot and value revision used for batch QC evaluation.
- *Quarantine protection:* Changing a lot's status to **Quarantined** via **Change status** (with a mandatory reason) immediately blocks new bench runs from selecting that lot while keeping historical batch links intact.
