# Review Control Charts, Reference Materials, and Blank Limits

## What This Is For

Manage your laboratory's **Reference Materials** (check soils and certified standards), propose and approve statistical **Control charts** limits with two-person sign-off, resolve **QC review obligations**, and evaluate **LOD/LOQ proposals from method blanks**.

> *Screenshot placeholder — docs/book/src/img/screenshots/qc-control-charts-and-blank-history.png (screenshot coming once the training data is ready): The **Reference Materials** page showing **Control charts** (**Propose limits**, **Approve limits**, **QC review obligations**) and **LOD/LOQ proposals from method blanks**.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Remember that approving control chart limits requires a second manager (**Approval requires a different named user.**).

---

## Steps

### Part 1: Check Reference Material Lots and Expiry Dates (**Reference Materials**)

1. Click **Reference Materials** in the left menu (under the administration section).
   *You should see your laboratory's registered **Laboratory reference material (LRM)** and **Certified reference material (CRM)** lots.*
2. Check the **Status** badge on each lot (**Active**, **Quarantined**, **Expired**, or **Retired**) and watch for lots flagged **Expiring soon**.
3. Click a lot to inspect its **Assigned values by analyte** (**Assigned value**, **Unit**, **Method (optional)**, and **Expanded uncertainty**).

### Part 2: Propose and Approve **Control charts** Limits

1. On the **Reference Materials** page, scroll to the **Control charts** panel and select a chart series under **Choose a series**.
   *While a new check soil lot has fewer than **Minimum baseline points** (default 20), it operates in **Provisional** (**Fixed window**) mode.*
2. Once enough passing points are recorded, review the **Observations** table:
   - Any statistical outlier is marked **Trial outlier: review this point** for your inspection.
   - If you untick an observation (**Selected**) because of a known bench incident, type a mandatory **Exclusion reason**.
3. Check the **Trial baseline** (**Mean**, **Sample SD (n − 1)**, **Lower limit**, and **Upper limit**), type your **Proposal reason**, and click **Propose limits**.
4. Ask a second **Laboratory Manager** to open the same series under **Retained proposals** and click **Approve limits**.
   *You should see the approved limits become the **Current** active limits (**Approved limits**) for future runs on that check soil lot.*

### Part 3: Resolve **QC review obligations** (Drift Signals)

1. In the **Control charts** panel, check **QC review obligations** for any **Open** drift alerts (triggered when 4 consecutive points exceed 1 standard deviation or 10 points fall on the same side of the mean).
2. Inspect the chart, choose the **Outcome** (**No action** or **Investigate / propose new limits**), enter a **Resolution note**, and click **Resolve review**.

### Part 4: Evaluate **LOD/LOQ proposals from method blanks**

1. Scroll to **LOD/LOQ proposals from method blanks** and select a method series in **Choose a series**.
2. Inspect all method blanks in the window (**Failed blanks stay selected by default. Review every row; give a reason for each exclusion.**).
3. Check the **Trial calculation** (**Mean**, **Sample SD**, and proposed LOD and LOQ), type your **Proposal reason**, and click **Record proposal**.

---

## What Happens Next

- Newly approved control chart limits (**Approved limits**) apply automatically to future runs started with that check soil lot, while earlier runs keep the limits that were frozen when they started.
- Recorded LOD/LOQ proposals appear under **Retained proposals** as permanent QA evidence for method validation reviews.

---

## If Something Goes Wrong

- *If you click* **Approve limits** *and see* **Approval requires a different named user.** *→* The manager who clicked **Propose limits** cannot approve their own proposal. Ask a second manager or administrator to sign in and approve it.
- *If a technician cannot start a chart-mode run because of* **Keep every required reference position bound to an eligible lot.** *→* Check that the **LRM** lot is **Active**, not **Expired**, and has an assigned value for the run's analyte and method.

---

## For the QA Person

- *Immutable reference values*: Assigned values on a reference material lot cannot be overwritten in place (**Assigned values cannot be changed. Correct them by adding a new revision.**). Adding a corrected revision (**Correct by new revision**) leaves all historical runs untouched.
- *Drift review obligations*: Resolving a 4-1s or 10x signal under **QC review obligations** documents your investigation without retroactively altering the run's quality control verdict.
