# Correct an Approved Sample or Issue an Amended Report

## What This Is For

Use the **Sample amendments** workflow whenever you need to fix client metadata (**Clerical correction**), change test orders (**Order amendment**), or reopen and re-run an analytical test (**Scientific retest**) after a sample has already been **Approved** or reported.

> *Screenshot placeholder — docs/book/src/img/screenshots/review-amendment-dialog.png (screenshot coming once the training data is ready): The **Sample amendments** modal showing **Amendment type** (**Clerical correction**, **Scientific retest**, **Order amendment**, **Report amendment**), **Reason for the amendment**, **Request amendment**, and **Authorise request**.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- When two-person amendment authorization is enabled in your laboratory policy (**Another authorised person must authorise this request.**), a second manager or authorized reviewer must approve the request before the sample unlocks.

---

## Steps

### Step 1: Request the Amendment (**Request amendment**)

1. Open the **Approved** (or reported) sample from **Samples** or **Reports**.
2. Click **Start amendment** on the **Reports** tab (or click **Start report amendment** in the sample's top action menu).
   *You should see the **Sample amendments** window open.*
3. Under **Amendment type**, choose the type of change needed:
   - **Clerical correction**: fix sample or client text (such as a misspelled farmer name or field ID) without changing any test numbers.
   - **Scientific retest**: reopen one or more accepted test lines for repeat measurement or a new **Final report value** selection.
   - **Order amendment**: add or remove analyses on the sample order.
   - **Report amendment**: reissue the certificate after an approved change.
4. If you chose **Scientific retest**, select the **Retest reason** (**Client retest** or **Confirmation**) and tick the affected tests under **Selected order lines**.
5. Type a clear explanation in **Reason for the amendment** and click **Request amendment**.
   *You should see **Request saved. Authorisation is required before changes are applied.** and the request listed under **Amendment history** as **Pending authorisation**.*

### Step 2: Authorize the Request (**Authorise request**)

1. Ask a second authorized manager or reviewer to open the sample's **Sample amendments** dialog (or if your laboratory policy displays **This laboratory policy allows the requester to authorise their own request.**, you may authorize it directly).
2. Review the request under **Amendment history** and click **Authorise request**.
   *You should see **Amendment authorised. Scientific retests must complete the normal review and approval before a report can be reissued.** and the status change to **Authorised**.*
   *If the sample had a released report, that report is immediately marked **Withdrawn** (**Withdrawn pending amendment**) while the correction is in progress.*

### Step 3: Complete the Correction and Reissue the Report

1. Complete the change:
   - For a **Clerical correction**, update the sample details on **Sample & request** (**Correct the field reference**).
   - For a **Scientific retest**, have the technician record and submit the new try in **Workbench**, then select the new **Final report value**, accept the test on the **Review** tab, and click **Final approve sample**.
2. Open the sample's **Reports** tab and click **Authorize & release report** to issue the new report **Version** (for example, Version 2).
   *The new Certificate of Analysis is published as **Published**, and the earlier version moves to **Replaced by newer version**.*

---

## What Happens Next

The amended Certificate of Analysis prints an amendment banner showing which report version it **Replaces** and the recorded reason. All amendments are tracked in **QA Dashboard** under the **Amendments** tab (**Traceable Amendments**).

---

## If Something Goes Wrong

- *If the* **Authorise request** *button is disabled and you see* **Awaiting another authorised person.** *→* Your laboratory policy requires two-person sign-off on amendments. Have a second manager sign in and click **Authorise request**.
- *If you try to change a sample's test order without an amendment and see* **Approved, archived and disposed samples require the amendment workflow before changing their order.** *→* Open **Sample amendments** and request an **Order amendment** first.

---

## For the QA Person

- Opening a **Scientific retest** immediately marks the currently released report **Withdrawn** so any public link or QR code scan displays **This report is under amendment and is temporarily unavailable.** instead of serving questionable numbers.
- Once the new version is released, scanning the old version's link displays **A newer version replaced this report. Ask the laboratory for the current report.**
