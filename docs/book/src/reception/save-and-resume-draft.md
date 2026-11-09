# Save a Half-Finished Intake and Come Back

## What This Is For

Pause a sample check-in safely when you are interrupted at the reception desk, waiting for a phone number from a walk-in customer, or waiting for your manager to clarify which tests to run, and resume it later without re-typing your work.

> *Screenshot placeholder — docs/book/src/img/screenshots/reception-incomplete-drafts.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Incomplete Intakes (Drafts)** list showing saved draft check-ins with **Resume** and **Discard** buttons.*

---

## Before You Start

- You are signed in to **Sample Reception** and have started entering a **Project Sample** or **Walk-in / External** sample.

---

## Steps

### Part 1: Save Your Work as a Draft

1. While inside the **Reception Console**, click **Save Draft** at the bottom of the screen.
   *You should see the record saved with status **Draft** (**Info Only – Not yet accepted**).*
2. Write "HOLD — DRAFT" on a temporary slip or place the physical bag in your reception hold tray so nobody mistakes it for an accepted sample.

### Part 2: Resume and Finish the Draft Later

1. Click **Sample Reception** in the left menu.
2. Click **Incomplete Intakes (Drafts)** (or click the **Incomplete Drafts** tab in the reception dashboard).
   *You should see a list of all unfinished check-ins saved in your laboratory.*
3. Find your saved sample row and click **Resume**.
   *You should see the **Reception Console** reopen with all your earlier notes, weights, and customer details filled in.*
4. Fill in the missing details, complete the **Reception Compliance** checks, and click **Accept & Print Label** (or **Complete Intake**).
   *You should see **INTAKE CONFIRMED!** and the status change from **Draft** to **Accepted**.*

---

## What Happens Next

Once you complete the draft, the sample receives its **Permanent Lab ID** and moves to **Accepted** (**Waiting for drying**) just like any other sample. If a draft was created by mistake and no physical sample arrived, click **Discard** next to the draft to remove it cleanly.

---

## If Something Goes Wrong

- *If a technician says they cannot find the sample in* **Workbench** *→* Check whether the sample is still sitting in **Incomplete Intakes (Drafts)** with status **Draft**. Technicians cannot see or prepare a sample until intake is completed and its status is **Accepted**.
- *If you try to print a barcode label while the sample is still a draft →* You will see **Receive the sample and issue its laboratory code before printing.** Finish the check-in first so the sample receives its **Permanent Lab ID**.

---

## For the QA Person

- A **Draft** record is an operational scratchpad at the reception desk; it does not assign a **Permanent Lab ID**, does not set the official reception timestamp, and does not create preparation or analytical work items until intake is completed.
