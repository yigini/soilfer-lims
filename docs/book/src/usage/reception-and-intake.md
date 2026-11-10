# Reception: Receiving Samples & Labels

## What This Is For

Use the **Sample Reception** pages to check in soil bags arriving at the laboratory, inspect container condition and sample weight, print barcode labels, and hand accepted samples over to the preparation room. Choose the task guide below that matches what is on your desk right now.

| What is on your desk? | Open this task page |
|---|---|
| One pre-registered project sample bag or one walk-in customer sample | [Receive One Sample (Project or Walk-In)](../reception/receive-one-sample.md) |
| A shipping box or crate containing many bags from the same project | [Receive a Whole Box or Consignment](../reception/receive-consignment-box.md) |
| An intake you started earlier and saved to finish later | [Save a Half-Finished Intake and Come Back](../reception/save-and-resume-draft.md) |
| A torn, leaking, unlabelled, or underweight soil bag | [Sample Arrived Damaged, Leaking, or Too Small](../reception/damaged-or-small-sample.md) |
| A bag whose barcode is not in the manifest, was already scanned, or has no location | [Unknown or Duplicate Sample ID & Missing Location](../reception/unknown-or-duplicate-id.md) |
| New sample stickers or a replacement for a torn barcode label | [Print and Reprint Barcode Labels](../reception/print-and-reprint-labels.md) |
| A tray of accepted, labelled bags ready for drying and preparation | [Hand Over Accepted Samples to the Lab](../reception/handover-to-lab.md) |

> *Screenshot placeholder — docs/book/src/img/screenshots/reception-console-modes.png (screenshot coming once the training data is ready): The **Sample Reception & Intake** screen showing the **Project Sample**, **Walk-in / External**, **Sample delivery box**, and **Incomplete Intakes (Drafts)** cards.*

---

## Before You Start

- Sign in with a **Sample Reception** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Make sure your bench scale, barcode scanner (if used), and label printer are switched on.
- Click **Sample Reception** in the left menu to open the **Sample Reception & Intake** screen.

---

## Steps

1. Click **Sample Reception** in the left menu.
   *You should see the **Sample Reception & Intake** screen with the **Select intake mode or resume a draft** heading.*
2. Choose the intake mode that matches your arrival:
   - Click **Project Sample** for a pre-registered field survey sample that is currently in **Expected** status.
   - Click **Walk-in / External** for a sample brought directly to the counter by a farmer, advisor, or external client.
   - Click **Sample delivery box** when checking in a whole box of pre-registered samples together.
   - Click **Incomplete Intakes (Drafts)** to resume a check-in you saved earlier with **Save Draft**.
3. Follow the four steps across the top of the **Reception Console**: **1. ID & Field**, **2. Condition**, **3. Analyses**, and **4. Handover**.
4. Click **Accept & Print Label** (or **Complete Intake**) to accept good samples, or click **Reject** (**Problem record**) if a bag cannot be tested.
   *You should see accepted samples receive a **Permanent Lab ID**, move to **Accepted** status, and open the **Print labels** dialog.*

---

## What Happens Next

Every sample you accept moves to **Accepted** (**Waiting for drying**) and appears in the preparation technician's queue in **My Work** and **Workbench**. Samples you save with **Save Draft** stay in **Draft** status until you finish them. Samples you reject stay in **Rejected (problem recorded)** and never enter analytical queues.

---

## If Something Goes Wrong

- *If you scan a barcode and see* **Sample Not Found** *(or* **Not Found***) →* Check whether the bag belongs to a walk-in client (**Walk-in / External**) or ask your manager to synchronize the field survey. See [Unknown or Duplicate Sample ID & Missing Location](../reception/unknown-or-duplicate-id.md).
- *If a sample bag is light but the client still wants partial testing →* Record the actual weight, tick **Acknowledge this sample’s mass warning** (confirm that you saw the low-weight warning), and note which tests have priority. See [Sample Arrived Damaged, Leaking, or Too Small](../reception/damaged-or-small-sample.md).
- *If you accepted a sample by mistake before preparation started →* Open the sample in **Samples**, click the actions menu, and click **Undo intake**. See [Hand Over Accepted Samples to the Lab](../reception/handover-to-lab.md).

---

## For the QA Person

- Looking up or scanning a sample in **Sample Reception** never marks it as received by itself; physical responsibility for the sample and the official **Received Date** are recorded only when the reception clerk completes the check-in.
- Your laboratory configures which intake fields (**Sample context**, **Land use**, **Sampling date**, **Sampling depth**) and condition checks (**Container Intact / Sealed**, **Label Legible & Matches ID**, **Sample Quantity Sufficient**, **Sample Condition (Dry, No Contam.)**, **Chain of Custody Present** (handover sheet arrived with the box)) are required, optional, or hidden under **Policies** (see [Per-Lab Settings, Presets & Method Overrides](lab-settings-and-presets.md)).
- The system calculates required soil mass from the requested test methods plus your laboratory's reserve factor so underweight bags are flagged with **Mass deficit** before acceptance.
- Every intake acceptance, rejection, draft save, label print, label reprint, and order revision is recorded in the permanent audit trail with the staff member's name and timestamp.
