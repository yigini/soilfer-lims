# Preparation: Drying, Grinding, Storage & Custody

## What This Is For

Prepare accepted soil samples for laboratory testing by recording drying, sieving, grinding, and splitting. You can also create labelled sub-containers or *aliquots* (smaller weighed portions taken from the main prepared soil bag; see [Glossary](../reference/glossary.md)) and track storage until archiving or disposal.

| What do you need to do today? | Open this task page |
|---|---|
| Dry accepted soil samples in the air-drying room or drying oven | [Record Sample Drying](../preparation/record-drying.md) |
| Sieve, crush, grind, and split dried soil samples for the bench | [Record Grinding, Sieving, and Splitting](../preparation/record-grinding-sieving.md) |
| Confirm preparation for a whole tray of samples or label sub-containers | [Prepare Several Samples at Once & Create Containers](../preparation/batch-preparation-and-containers.md) |
| Verify, return, or redo a preparation step when an error is found | [Redo or Reopen a Completed Preparation Step](../preparation/redo-or-reopen-preparation.md) |

> *Screenshot placeholder — docs/book/src/img/screenshots/preparation-gates-overview.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Preparation Prerequisites** card on a sample page showing **Air Drying** (**Constant weight**) and **Sample Preparation** (**Homogenized fraction**), plus the **Containers and aliquots** card.*

---

## Before You Start

- Sign in with a **Laboratory Technician** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Make sure the sample has been accepted at **Sample Reception** so its status is **Accepted** (**Waiting for drying**).
- Check that the sample does not have an active hold (**Sample held**) in **Sample holds**.

---

## Steps

### How Preparation Unlocks Bench Testing

1. Click **Workbench** in the left menu and select **Air Drying** in the **Work type:** selector.
2. Tick the three **Operational Checklist** items for **Air Drying**.
3. Fill in the **Drying** record (**Method**, **Temperature (°C)**, **Mass before (g)**, **Mass after (g)**, **Started**, **Ended**, and **Equipment**) and click **Confirm Complete**.
   *You should see the drying gate change to **Completed** (**Checklist Verified**) and the sample status move to **Waiting for preparation**.*
4. In **Workbench**, switch **Work type:** to **Sample Preparation**.
5. Tick the three **Operational Checklist** items for **Sample Preparation**.
6. Fill in the required step fields (**Sieving**, **Grinding**, and **Splitting**) and click **Confirm Complete**.
   *You should see the preparation gate change to **Completed** (**Checklist Verified**) and the sample status advance to **Processing** (**Prepared**).*

### Moving, Archiving, and Disposing Sample Material Later

1. Open a sample in **Samples** and click the **Sample & request** tab to view **Physical Material & Custody**.
2. Click **Record storage movement** whenever you move a container to a shelf, issue it to a bench, return it, or send it out (**Moved to storage**, **Issued to bench**, **Returned to storage**, or **Transferred to external lab**).
3. After all tests on a sample are **Approved**, click the **More actions** menu at the top right:
   - Click **Archive sample** (**Request archival**) to move the sample to long-term storage and set its **Retain until** date.
   - Click **Dispose material** (**Dispose sample material**) when the retention period expires, or review expired samples in **Overdue disposal queue**.

---

## What Happens Next

Once both **Air Drying** and **Sample Preparation** are confirmed, every ordered test changes from **Blocked** (**Requires Preparation Complete**) to **Ready** (**Ready to record**) in **Workbench**.

---

## If Something Goes Wrong

- *If a test row in* **Workbench** *is locked and says* **Blocked** *→* Look at the **Readiness & State** column or the right-hand inspector (**Drying Gate:** and **Preparation Gate:**). Complete **Air Drying** first, then **Sample Preparation**, and the test row will unlock automatically.
- *If you see* **Accept the sample before recording its preparation.** *→* The sample is still in **Received** or **Draft** status. Ask the reception clerk to complete intake so its status becomes **Accepted**.
- *If you see* **This sample’s retention period has not expired.** *→* Keep the sample in archive storage until the **Retain until** date passes, or check retention rules under **Policies**.

---

## For the QA Person

- Wet-chemistry and spectral tests are strictly gated behind **Air Drying** and **Sample Preparation**. No reading can be saved while either prerequisite gate is **Pending** or **Awaiting verification**.
- When a method requires **Oven-dry** reporting (instead of **Air-dry** or **As received**), the system links the moisture test to the calculation template. Both the raw reading and the moisture-corrected result remain traceable.
- Your laboratory configures gate verification (**Awaiting verification**), required preparation fields (**Drying**, **Sieving**, **Grinding**, **Splitting**), and retention days under **Policies**. See [Per-Lab Settings, Presets & Method Overrides](lab-settings-and-presets.md).
