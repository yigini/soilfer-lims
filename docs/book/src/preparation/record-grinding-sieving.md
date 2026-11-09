# Record Grinding, Sieving, and Splitting

## What This Is For

Record the crushing, sieving (typically to under 2 mm fine earth), fine grinding (such as under 0.5 mm or 0.15 mm), and riffle splitting of a dried soil sample so it is ready for bench analysis.

> *Screenshot placeholder — docs/book/src/img/screenshots/preparation-record-grinding-sieving.png (screenshot coming once the training data is ready): The **Workbench** showing **Sample Preparation** selected in **Work type:**, the three **Operational Checklist** items, and the **Sieving**, **Grinding**, and **Splitting** fieldsets.*

---

## Before You Start

- Sign in with a **Laboratory Technician** account on the **Sign in to SoilFER LIMS** screen.
- Make sure **Air Drying** is already **Completed** for the sample (see [Record Sample Drying](record-drying.md)).
- Have the dried soil sample, your clean sieve and mortar or mill, and your bench balance ready.

---

## Steps

1. Click **Workbench** in the left menu.
2. In the **Work type:** dropdown at the top left, select **Sample Preparation**.
   *You should see all dried samples that are ready for sieving, grinding, and splitting.*
3. Find your sample row (or use **Find sample ID...**).
   *In the right-hand inspector, verify that **Drying Gate:** shows **✓ Completed** and that the row status badge says **Ready**.*
4. Tick all three procedural checks in the **Operational Checklist** as you complete the physical work at the preparation bench:
   - **Sample identity and completed drying record verified**.
   - **Required preparation steps completed according to the applicable laboratory procedure**.
   - **Prepared material and retained portions labeled for their intended analyses**.
   *You should see the badge change to **Operational checklist complete**.*
5. Fill in the structured preparation boxes shown for your sample's ordered methods:
   - Under **Sieving**: enter **Sieve (mm)** (such as 2.0), **Mass before (g)**, **Coarse fraction (g)** (stones retained on the sieve), **Mass after (g)** (fine earth), **Started**, **Ended**, and **Equipment**.
   - Under **Grinding** (when fine grinding is required): enter **Ground to (mm)** (such as 0.5 or 0.15), **Mass before (g)**, **Mass after (g)**, **Started**, **Ended**, and **Equipment**.
   - Under **Splitting** (when riffle splitting is required): enter **Mass before (g)**, **Mass after (g)**, **Started**, **Ended**, and **Equipment**.
6. Click **Confirm Complete**.
   *You should see **Checklist Verified** with a receipt code, and **Preparation Gate:** in the inspector change to **✓ Completed**.*

---

## What Happens Next

As soon as both **Air Drying** and **Sample Preparation** are confirmed, the sample status moves to **Processing** (**Prepared**). Every wet-chemistry and spectral test ordered for this sample unlocks immediately in **Workbench** with status **Ready** (**Ready to record**). See [Prepare Several Samples at Once & Create Containers](batch-preparation-and-containers.md) to print sub-container labels.

---

## If Something Goes Wrong

- *If the sample row in* **Sample Preparation** *shows* **Blocked** *and* **Requires Drying Complete** *→* Switch **Work type:** to **Air Drying** and confirm drying for that sample first.
- *If you see an error when clicking* **Confirm Complete** *→* Check that the sum of **Coarse fraction (g)** and **Mass after (g)** in **Sieving** does not exceed **Mass before (g)**. Also check that all required fields under **Sieving**, **Grinding**, or **Splitting** are filled in.

---

## For the QA Person

- Recording **Coarse fraction (g)** alongside **Mass before (g)** and **Mass after (g)** during **Sieving** allows the system to compute the coarse fragment percentage. It also preserves the exact sieve aperture (**Sieve (mm)**) and mill fineness (**Ground to (mm)**) on the preparation receipt.
- Depending on the ordered methods and your laboratory's **Policies**, the system automatically displays and validates the required step boxes (**Sieving**, **Grinding**, **Splitting**).
