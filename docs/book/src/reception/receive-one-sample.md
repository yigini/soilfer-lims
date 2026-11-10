# Receive One Sample (Project or Walk-In)

## What This Is For

Check in a single soil sample bag at the reception desk, either from a pre-registered field survey (**Project Sample**) or from a customer arriving at the counter (**Walk-in / External**).

> *Screenshot placeholder — docs/book/src/img/screenshots/reception-single-sample.png (screenshot coming once the training data is ready): The **Reception Console** showing **1. ID & Field**, **2. Condition**, **3. Analyses**, and **4. Handover** for a single soil sample.*

---

## Before You Start

- Sign in with a **Sample Reception** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Have the physical soil bag on your bench scale and check that the writing on the bag is readable.
- Click **Sample Reception** in the left menu to open **Sample Reception & Intake**.

---

## Steps

### Option A: Pre-Registered Project Sample

1. On the **Sample Reception & Intake** screen, click **Project Sample**.
   *You should see the **Reception Console** open at step **1. ID & Field**.*
2. Click **Search manifest by Sample ID...** (or click **Scan** to use a handheld barcode scanner) and enter the field code printed on the bag.
   *You should see the sample's project name, field collection date, depth, and site details load on screen with status **Expected**.*
3. Check the **Soil profile / sampling point** section: confirm the **Recorded field code** and **Recorded meaning** (**Sampling point / site**, **Composite sampling area**, or **Confirmed soil profile / pit**) match the field sheet.
4. Proceed to **2. Condition** (**Reception Compliance**) and check each item against the physical bag:
   - **Container Intact / Sealed**
   - **Label Legible & Matches ID**
   - **Sample Quantity Sufficient**
   - **Sample Condition (Dry, No Contam.)**
   - **Chain of Custody Present**
   Click **All clear ✓** if every item passes, or mark individual items **OK**, **Fail**, or **N/A**.
5. Weigh the bag on your bench scale, enter the received mass in grams and the carrier or courier name in **Delivered By (CoC Signee)**, and type any visual notes in **Intake Notes / Visual Observations**.
6. In **3. Analyses**, verify the ticked **Analysis Requirements** match what the project ordered.
7. In **4. Handover**, choose the initial storage shelf or drying tray and click **Accept & Print Label** (or **Complete Intake**).
   *You should see **INTAKE CONFIRMED!**, the sample status change to **Accepted**, its **Permanent Lab ID** appear, and the **Print labels** window open.*

### Option B: Walk-In Customer Sample

1. On the **Sample Reception & Intake** screen, click **Walk-in / External**.
2. Fill in **1. Submitter Details**: enter **First Name \***, **Last Name \***, **Phone (Required) \***, **Email**, **Organization / Farm Name**, and **Contact Preference**.
3. Fill in **2. Sample Context**: enter **Current Crop**, **Previous Crop (Rotation)**, **Land Use & Management**, **Fertilizer / Manure Used?**, and **Collection Date**.
   *If the customer brought a composite sample mixed from several spots in one field, tick **Composite sample** and fill in **Depth from (cm)**, **Depth to (cm)**, **Sub-samples count**, and **Composite radius (m)**.*
4. Select the requested tests under **Analysis Requirements**, weigh the bag, check **Reception Compliance**, and click **Accept & Print Label**.
   *You should see **INTAKE CONFIRMED!** and the new **Permanent Lab ID**.*

---

## What Happens Next

The accepted sample moves to **Accepted** (**Waiting for drying**) and appears immediately in the preparation queue in **My Work** and **Workbench**. Click **Next Sample** to check in another bag, or see [Print and Reprint Barcode Labels](print-and-reprint-labels.md) to print stickers.

---

## If Something Goes Wrong

- *If a walk-in customer does not know the exact field coordinates or crop history →* Leave unknown optional fields blank or choose **Record as unknown** under **Soil profile / sampling point**. Your laboratory sets which context fields are mandatory under **Policies**.
- *If the client asks to add or remove a test after the sample was already accepted →* Open the sample in **Samples**, go to the **Sample & request** tab, click the **Change requested analyses** button, select the complete target list of analyses, and type the explanation in **Reason for order revision**.
- *If you need to stop halfway through checking in a sample →* Click **Save Draft**. See [Save a Half-Finished Intake and Come Back](save-and-resume-draft.md).

---

## For the QA Person

- Pre-registered field samples stay in **Expected** status until the reception clerk completes intake; only then does the system assign the **Permanent Lab ID** and record the official **Received Date**.
- Changing the requested analyses on an already accepted sample requires a documented reason in **Reason for order revision** and creates a numbered order revision in the sample's audit trail.
- Once a sample has been approved, archived, or disposed, its analysis order is locked and any change requires the formal report amendment workflow.
