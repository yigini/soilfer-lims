# Record Sample Drying

## What This Is For

Record the drying of accepted soil samples in the air-drying room or low-temperature drying oven (40 °C or lower). You record the drying method, temperature, weights, start and end times, and equipment so the sample can move to sieving.

> *Screenshot placeholder — docs/book/src/img/screenshots/preparation-record-drying.png (screenshot coming once the training data is ready): The **Workbench** showing **Air Drying** selected in **Work type:**, the three **Operational Checklist** items, the **Drying** fields (**Method**, **Temperature (°C)**, **Mass before (g)**, **Mass after (g)**, **Started**, **Ended**, **Equipment**), and the **Confirm work is done** button.*

---

## Before You Start

- Sign in with a **Laboratory Technician** account on the **Sign in to SoilFER LIMS** screen.
- Make sure the sample has been accepted at **Sample Reception** (status **Accepted** / **Waiting for drying**).
- Spread the physical soil on a clean, labelled drying tray and dry it to constant weight.

---

## Steps

1. Click **Workbench** in the left menu.
2. In the **Work type:** dropdown at the top left, select **Air Drying**.
   *You should see all samples currently waiting for drying in your laboratory.*
3. Find your sample row in the table (or type its code into **Find sample ID...**). Click **Card View** if you prefer to focus on one sample at a time.
4. Tick all three procedural checks in the **Operational Checklist** as you verify them on the tray:
   - **Sample identity and container label verified**.
   - **Drying completed according to the applicable laboratory procedure**.
   - **Required drying endpoint and sample condition checked before handover**.
   *You should see the badge change from **Checklist: 0/3 confirmed** to **Operational checklist complete**.*
5. In the **Drying** box below the checklist, fill in the structured drying measurements required by your laboratory:
   - **Method**: choose **Air dried**, **Oven 40 °C**, **Oven 105 °C**, or **Other method**.
   - **Temperature (°C)**: enter the drying room or oven temperature.
   - **Mass before (g)** and **Mass after (g)**: enter the sample mass before and after drying.
   - **Started** and **Ended**: enter when the sample went into and came out of the drying room or oven.
   - **Equipment**: select the drying oven or facility asset if your laboratory registers drying equipment.
6. Click **Confirm work is done** on that sample row.
   *You should see a green **Checklist Verified** confirmation badge, and **Drying step:** in the detail panel change to **✓ Completed**.*

---

## What Happens Next

Once **Air Drying** is confirmed, the sample's drying step is **Completed** (or **Awaiting verification** if your laboratory requires manager verification). The sample now unlocks **Sample Preparation** (**Waiting for preparation**); see [Record Grinding, Sieving, and Splitting](record-grinding-sieving.md).

---

## If Something Goes Wrong

- *If the* **Confirm work is done** *button does not appear →* Check the amber badge (**Checklist: 2/3 confirmed**). All three checkboxes in the **Operational Checklist** must be ticked before **Confirm work is done** appears.
- *If you see an error saying a drying field is missing or invalid →* Check that **Mass after (g)** is not greater than **Mass before (g)** and that **Ended** is after **Started**. Also check that every field required by your laboratory's **Policies** is filled in.
- *If the row checkboxes are greyed out and the row says* **Blocked** *→* Check whether the sample has an active hold (**Sample held**) or has not been accepted at **Sample Reception** yet.

---

## For the QA Person

- Completing **Air Drying** generates a permanent, locked saved confirmation (**Checklist Verified**) storing the checklist steps, the **Drying** measurements, the technician's username, and the timestamp.
- Routine soil preparation uses **Air dried** or **Oven 40 °C** so heat-sensitive nutrients and organic matter are not altered. **Oven 105 °C** is used only on a separate sub-sample for moisture determination when converting results to an **Oven-dry** basis.
