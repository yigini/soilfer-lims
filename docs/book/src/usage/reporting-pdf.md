# Lab Manager & QA: Certificates of Analysis, PDF Reports & Amendments

## What This Is For

Issue official PDF Certificates of Analysis for **Approved** samples, share verifiable report links and QR codes with clients, and export approved results to **CSV** or **Excel**. This page also covers formal **Sample amendments** when a released report needs a correction or retest.

| What do you need to do? | Open this task page |
|---|---|
| Issue a PDF Certificate of Analysis, print it, or create a public share link | [Issue, Print, and Share a Certificate of Analysis](../review/issue-and-share-reports.md) |
| Fix a clerical typo or reopen an analytical test after a report was issued | [Correct an Approved Sample or Issue an Amended Report](../review/amend-a-released-report.md) |
| Read or download reports as a client or project viewer | [Clients & Viewers: Reading Results & Reports](viewer-guide.md) |

> *Screenshot placeholder — docs/book/src/img/screenshots/reports-and-amendments-overview.png (screenshot coming once the training data is ready): The **Result Reports** page showing **Published**, **Replaced by newer version**, and **Withdrawn** filters, **View report**, **Share report**, and **Manage Share Links**.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Make sure the sample has completed review and shows status **Approved** (see [Return a Test for Repeat or Give Final Sample Approval](../review/return-for-repeat-or-approve.md)).

---

## Steps

1. Open the **Approved** sample from **Samples** or **Manager Task List**, and click the **Reports** tab.
   *You should see the **Analytical Report Releases** panel.*
2. Click **Authorize & release report** to issue the official Certificate of Analysis.
   *You should see the released report badge (such as **View Report v1**) and the sample's archive retention date under **Retain until**.*
3. Click **Reports** in the left menu to open **Result Reports** across your whole laboratory.
4. Click **View report** on any row to preview the certificate. Click **Print / Save as PDF** to print or download the PDF.
5. To share a report with an external client without creating a user account, click **Share report** to open **Manage Share Links**. Enter **Expires in (days)** and click **Generate**.
   *If you ever need to cancel external access, open **Manage Share Links** and click **Revoke**.*
6. If an error is found after a sample is **Approved** or its report is released, click **Start amendment** (or **Start report amendment**) on the sample. This opens **Sample amendments** (see [Correct an Approved Sample or Issue an Amended Report](../review/amend-a-released-report.md)).

---

## What Happens Next

- Once a report is released, clients and project staff can view it in **Reports** (**Result Reports**). They can also verify it using the QR code and public share link.
- Approved results appear in **Data Results** (**Analytical Results Master**), where you can export them using the **CSV** or **Excel** buttons.

---

## If Something Goes Wrong

- *If the* **Authorize & release report** *button is disabled →* Check that every ordered test on the sample has been reviewed and accepted (**Accepted**). Also make sure the sample has received **Final Approval** (**Final approve sample**).
- *If you see* **An amended report needs an approved amendment. Request and authorise one first.** *→* Open **Sample amendments**, submit your **Request amendment**, and have an authorized reviewer click **Authorise request** before reissuing the report.
- *If a client opens an old QR code link and sees* **This report is under amendment and is temporarily unavailable.** *(or* **A newer version replaced this report. Ask the laboratory for the current report.***) →* The system automatically blocks outdated PDFs when a scientific amendment is opened or a newer version is released. Send the client the updated report.

---

## For the QA Person

- *Locked report records*: Every released report saves a permanent copy of the sample's origin and history, recorded **Drying** and **Preparation** details, moisture basis, **Final report value** choices, units, methods, **QC deviations:** notes, and sign-off timestamps.
- *Immediate withdrawal during scientific retests*: When a **Scientific retest** amendment is authorized on a sample with a released report, the released version is immediately marked **Withdrawn**. External share links cannot serve unverified data while retesting is underway.
- *Traceable revisions*: When the new report version is released, the previous version moves to **Replaced by newer version**. The new certificate states which report version it **Replaces** and why.
- *Master exports*: Exporting from **Data Results** (**Analytical Results Master**) via **CSV** or **Excel** outputs the official saved **Final report value** along with its **Reported value selection ID**, **Attempt IDs**, and **Batch IDs**.
