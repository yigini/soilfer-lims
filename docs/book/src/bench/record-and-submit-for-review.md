# Review, Record, and Submit Completed Samples

## What This Is For

Finish your bench work using SoilFER LIMS's two-step handoff: first confirm and record your ready worksheet rows (**Review Determinations Before Recording**), and then bundle completed samples and send them to your reviewer (**Review & Submit Samples for Review**).

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-record-and-submit.png (screenshot coming once the training data is ready): The **Review Determinations Before Recording** screen showing **Eligible to Record**, **Excluded / Incomplete**, and the verification checkbox, followed by **Review & Submit Samples for Review**.*

---

## Before You Start

- You have entered or imported measurements in **Workbench** (status **Draft saved**) and saved/evaluated your run's quality control checks.

---

## Steps

### Step 1: Confirm and Record Ready Rows (**Draft saved** → **Recorded**)

1. At the bottom right of the **Worksheet** table, look at the **Record all ready** button (which shows how many rows have complete, valid drafts).
   *If you want to hold one row back while recording the rest, untick the checkbox on the far left of that row.*
2. Click **Record all ready** (or click **Record this sample** if you are working in **Card View**).
   *You should see the **Review Determinations Before Recording** screen open.*
3. Check the two summary cards at the top:
   - **Eligible to Record** (**Included Determinations** / **Ready to Record**): rows that will be saved right now.
   - **Excluded / Incomplete** (**Remains Draft**): rows with missing prerequisites or validation warnings that will stay as drafts until fixed.
4. Read each row in **Included Determinations** to verify the sample code, **Position**, value, unit, basis, replicate number, and any **Flags and warnings**.
5. Tick **I verified the lab sample codes, positions, values, units, flags, basis and replicate numbers against the raw bench data.**
6. Click the green **Record** button (**Determination**).
   *If your laboratory requires bench PIN confirmation at recording, you will see **Enter your PIN to record**. Type your **PIN** and confirm.*
   *You should see each recorded row change from **Draft saved** to **Recorded**.*

### Step 2: Submit Completed Samples to Your Reviewer (**Recorded** → **Submitted**)

1. Click the **Ready to Submit** tab at the top of **Workbench**.
   *You should see the **Review & Submit Samples for Review** screen listing all **Recorded Samples**.*
2. Check the ticked samples you want to hand off today (you can leave a sample unticked if you are still finishing another test on it).
3. Optionally type a note for the reviewer in **Submission Notes for Reviewer (optional):** (for example, noting which run or calibration curve was used).
4. Tick **I confirm that the selected samples are complete and ready for managerial review.**
5. Click the green **Submit** button (**for Review**).
   *You should see the submitted samples move to the **Sent & Completed** tab with status **Submitted**.*

---

## What Happens Next

Once a sample is **Submitted**, its recorded determinations become read-only at the bench and appear in your manager's **Manager Task List** under **Review Submissions**. You can view your saved confirmation records at any time on the **Saved confirmation log ({count})** tab.

---

## If Something Goes Wrong

- *If a row you typed appears under* **Excluded / Incomplete** *(**Remains Draft**) →* Read the red bullet under that sample row on the **Review Determinations Before Recording** screen (such as an unapproved special approval request or an incomplete replicate pair), click **Back to Worksheet**, fix the row, and click **Record all ready** again.
- *If the network flickers while recording and you see* **Recording incomplete** *(**Recording was not confirmed for this row.**) →* Click **Retry failed** on the confirmation banner to resend only the unconfirmed rows without duplicating the rows that already succeeded.
- *If you see* **No recorded samples are currently awaiting review submission. Record eligible worksheet items first.** *on the* **Ready to Submit** *tab →* Your numbers are still in **Draft saved** status. Complete Step 1 above first so their status becomes **Recorded**.

---

## For the QA Person

- Separating Step 1 (**Review Determinations Before Recording**) from Step 2 (**Review & Submit Samples for Review**) allows an analyst to record measurements safely at the end of each bench run (**Recorded**) while bundling completed sample packages for reviewer sign-off (**Submitted**).
- Every recording action requires the explicit preflight confirmation checkbox (**I verified the lab sample codes, positions, values, units, flags, basis and replicate numbers against the raw bench data.**) and writes an auditable saved confirmation record.
