# Return a Test for Repeat or Give Final Sample Approval

## What This Is For

Accept reviewed test items (including confirming any quality control warnings). This page also shows how to send a questionable test back to the bench with a clear **Repeat reason** or give **Final Approval** once every test on a sample is complete.

> *Screenshot placeholder — docs/book/src/img/screenshots/review-accept-return-and-final-approve.png (screenshot coming once the training data is ready): The sample **Review** tab showing **QC acknowledgement reason (required)**, **Accept Item**, **Return for repeat testing**, and the **Final approve sample** button.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Before accepting a test, make sure you have saved its **Final report value** selection (see [Review Submitted Results and Choose the Reported Value](review-and-select-reported-value.md)).

---

## Steps

### Option A: Accept Submitted Results and Give Final Sample Approval

1. On the sample's **Review** tab, check whether any submitted item shows a quality control warning banner (**QC acknowledgement reason (required)**).
   - If a warning is shown, type your scientific justification in **QC acknowledgement reason (required)**. Your name and reason will appear in the report evidence.
2. Click the green checkmark button (**Accept Item**) on an individual test row. You can also click **Accept** at the bottom of the panel to accept all ready submitted results on the sample at once.
   *You should see the accepted rows change from **Submitted** to **Accepted**.*
3. Once every ordered test on the sample is **Accepted** (and **Air Drying** and **Sample Preparation** are **Completed**), click **Final approve sample** at the top of the sample page. You can also click **Approve** on the **Final Approvals** tab in **Manager Task List**.
   *You should see the sample status badge change to **Approved**.*

### Option B: Return a Submitted Result for Repeat Testing

1. If a reading looks implausible or had an instrument or preparation problem, click the return arrow button (**Return for correction**) on that test row.
   *You should see the **Return for repeat testing** dialog open.*
2. Under **Repeat reason**, select the reason that matches what happened:
   - **Review outlier**, **Duplicate disagreement**, or **Confirmation**: keeps the original try marked **Questioned** while asking the technician for a check run.
   - **QC batch failure**, **Above range: dilution required**, **Instrument fault**, or **Preparation error**: marks the original try **Invalidated** and opens a fresh repeat try.
   - **Other**: requires a detailed explanation in the note box.
3. In **Review note**, type clear instructions for the technician (**Explain the evidence and what needs to be checked.**).
4. Click **Confirm return**.
   *You should see the test status change to **Repeat requested**. The item returns to the technician's **Workbench** queue.*

---

## What Happens Next

- **Approved** samples are sealed against ordinary edits and are ready for report release on the **Reports** tab (see [Issue, Print, and Share a Certificate of Analysis](issue-and-share-reports.md)).
- Returned items are re-measured by the technician as a new numbered try under **Tries** and resubmitted for your review.

---

## If Something Goes Wrong

- *If you click* **Confirm return** *and see* **This laboratory’s configured attempt limit has been reached.** (this test has reached the maximum number of repeat tries allowed by your lab) *→* The test has already been repeated the maximum number of times allowed by your laboratory policy. Use **Ask manager for an extra repeat try**, enter the **Reason for exceeding the repeat limit** and **Impact assessment**, and submit. This automatically opens a linked record in **Problem records**.
- *If you see* **Use a transcription correction for a typo.** *→* If the bench measurement itself was valid and only typed wrongly, use a transcription correction rather than ordering a new physical repeat.
- *If you need to reopen an* **Approved** *sample before a report has been issued →* Click **Undo Approval**, enter the mandatory audit reason, and confirm to return the sample to **In Progress**.

---

## For the QA Person

- Blanket approval without submitted evidence is blocked (**Only submitted evidence can be reviewed and accepted. Blanket approval without submitted evidence is prohibited.**).
- When a manager authorizes **Ask manager for an extra repeat try**, the system automatically creates a **Repeat limit** problem record in **Problem records** so recurring analytical issues are investigated.
