# Lab Manager & QA: Review, Approval & Plausibility Checks

## What This Is For

Use **Manager Task List** and the sample **Review** tab to assign pending tests to technicians, check submitted measurements and quality control results, choose the official **Final report value** across tries, return questionable results for repeat testing, and give final sample approval.

| What do you need to do? | Open this task page |
|---|---|
| Assign new sample tests to bench technicians | [Assign Pending Tests to Technicians](../review/assign-work-to-technicians.md) |
| Check submitted results, cross-parameter plausibility flags, and select the final report number | [Review Submitted Results and Choose the Reported Value](../review/review-and-select-reported-value.md) |
| Send a test back for a repeat check or give final approval to a completed sample | [Return a Test for Repeat or Give Final Sample Approval](../review/return-for-repeat-or-approve.md) |
| Decide what to do when a batch fails quality control | [What to Do When a QC Run Fails (Batch Disposition & Bracket Repeats)](../qc/handle-failed-qc-batch.md) |
| Issue, print, or share a PDF Certificate of Analysis | [Issue, Print, and Share a Certificate of Analysis](../review/issue-and-share-reports.md) |

> *Screenshot placeholder — docs/book/src/img/screenshots/manager-review-overview.png (screenshot coming once the training data is ready): The **Manager Task List** showing the **QC Exceptions**, **New (Intake)**, **Assign Work**, **Review Submissions**, and **Final Approvals** tabs.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account (or an account with review authority) on the **Sign in to SoilFER LIMS** screen.
- When two-person review is enabled in your laboratory policy, you must be a different person from the technician who recorded the measurement.

---

## Steps

1. Click **Manager Task List** in the left menu.
   *You should see five action tabs: **QC Exceptions**, **New (Intake)**, **Assign Work**, **Review Submissions**, and **Final Approvals**.*
2. If any batches appear under **QC Exceptions**, resolve those first so their samples are not blocked during review (see [What to Do When a QC Run Fails](../qc/handle-failed-qc-batch.md)).
3. Click **Assign Work** to assign pending tests to your bench staff (see [Assign Pending Tests to Technicians](../review/assign-work-to-technicians.md)).
4. Click **Review Submissions** and click **Review** on a sample card to open that sample on its **Review** tab.
5. Check the **Cross-parameter plausibility** panel and any pending **Unusual-value requests** from the technician.
6. Under **Final report value** for each submitted test, compare the recorded tries, select **Use this try on report**, **Report mean**, or **Not reportable**, and click **Save final report value**.
7. If a batch had a quality control warning, enter your explanation in **QC acknowledgement reason (required)**, then click **Accept Item** (or **Accept** for all submitted results).
   *If a result needs to be re-measured, click **Return for correction** instead to open **Return for repeat testing**.*
8. Once every test on the sample is **Accepted**, click **Final approve sample** (or approve it from the **Final Approvals** tab in **Manager Task List**).
   *You should see the sample status change to **Approved**.*

---

## What Happens Next

Approved samples are ready for report generation on the sample's **Reports** tab (see [Issue, Print, and Share a Certificate of Analysis](../review/issue-and-share-reports.md)). Any test you returned reappears in the technician's **Workbench** with status **Repeat requested**.

---

## If Something Goes Wrong

- *If you see* **Choose a final report value before accepting this test.** *→* Open the **Final report value** panel on that test row, pick **Use this try on report**, **Report mean**, or **Not reportable**, and click **Save final report value** first.
- *If you see* **The batch failed quality checks. The lab manager must record a decision.** *→* The analytical run failed quality control. Click **QA Dashboard** (or **QC Exceptions** in **Manager Task List**) to record a batch decision first.
- *If you see* **Enter a QC acknowledgement reason before acceptance.** *→* Type a short note in **QC acknowledgement reason (required)** explaining why the warning is acceptable for this sample.
- *If you see* **Accept and select SAND, SILT and CLAY before TEXTURE.** *→* Save the **Final report value** for **Sand**, **Silt**, and **Clay** first, and then save the **Texture (Sand/Silt/Clay)** selection.

---

## For the QA Person

- *Two-person independence*: When **Require a second reviewer** is active in **Policies**, the server blocks a user from accepting or approving any try they recorded themselves.
- *Explicit final report number selection*: SoilFER LIMS never uses a hidden "latest try wins" rule. Every approved test binds to an audited **Final report value** selection (**Automatic selection**, **Use this try on report**, **Report mean** within the method's **Repeatability limit**, or **Not reportable** with a mandatory reason).
- *Advisory cross-parameter checks*: The **Cross-parameter plausibility** panel checks internal soil chemistry consistency on matching moisture bases:
  - **Texture closure**: checks whether Sand + Silt + Clay sums to 100 % within your laboratory tolerance (default 2 %).
  - **Exchangeable bases / CEC** and **Base saturation**: flags when the sum of exchangeable calcium, magnesium, potassium, and sodium exceeds the configured CEC factor (default 1.1 times CEC) or maximum base saturation (default 100 %).
  - **C:N ratio**: flags when organic carbon divided by total nitrogen falls outside your configured bounds (default 8 to 25).
  - **Carbonate / water pH**, **KCl pH / water pH**, and **CaCl₂ pH / water pH**: flags if measurable carbonate is reported below the water-pH threshold (default 7.0) or if salt pH is not below water pH.
