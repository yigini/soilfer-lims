# Issue, Print, and Share a Certificate of Analysis

## What This Is For

Release an official Certificate of Analysis for an **Approved** sample, print or save it as a PDF, and create or revoke public verification links (**Manage Share Links**) for clients.

> *Screenshot placeholder — docs/book/src/img/screenshots/review-issue-and-share-report.png (screenshot coming once the training data is ready): The sample **Reports** tab showing **Authorize & release report** and the **Result Reports** page showing **Print / Save as PDF** and **Manage Share Links**.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Make sure the sample shows status **Approved** and all required tests are **Accepted**.

---

## Steps

### Part 1: Release the Certificate of Analysis on the Sample

1. Open the **Approved** sample from **Samples** or **Manager Task List**.
2. Click the **Reports** tab to open **Analytical Report Releases**.
3. Check the readiness summary confirming that all required results are reviewed and accepted.
4. Click **Authorize & release report**.
   *You should see the released report badge appear (**Released**) along with the **View Report v1** button.*

### Part 2: View and Print or Save the PDF

1. Click **View Report v1** on the sample's **Reports** tab (or click **Reports** in the left menu to open **Result Reports** and click **View report** on the row).
   *You should see the full Certificate of Analysis open in the report preview window.*
2. Check the sample details, **Preparation records**, results table, quality control summary (**All final report values passed their quality checks.** or **QC deviations:**), and electronic approval block.
3. Click **Print / Save as PDF** in the top right of the report window to print the certificate on paper or save it as a PDF file.

### Part 3: Create or Revoke a Public Share Link (**Manage Share Links**)

1. Click **Reports** in the left menu to open **Result Reports**.
2. On the report row you want to share, click the share icon (**Share report**) in the **Actions** column.
   *You should see the **Manage Share Links** window open.*
3. Under **Create Public Link**, enter the number of days the link should stay active in **Expires in (days)** (for example, 30) and click **Generate**.
   *The public verification link is created and copied to your clipboard so you can paste it into an email or message to the client.*
4. If you ever need to turn off a shared link early, open **Manage Share Links** on that report and click **Revoke** next to the link under **Existing Links**.
   *You should see the link status change to **Revoked**.*

---

## What Happens Next

- Releasing the first Certificate of Analysis starts the sample's archive retention clock (**Retain until** on the **Sample & request** tab).
- Clients can open the shared link or scan the QR code on the printed certificate to view the authentic report.

---

## If Something Goes Wrong

- *If* **Authorize & release report** *is disabled and you see a warning about accepted records without linked evidence →* Click **Inspect evidence** on the sample banner to verify or waive any legacy/incomplete row before releasing the report.
- *If a client says their share link stopped working →* Open **Reports**, click **Share report** on that sample's row, and check **Existing Links** to see if the link expired (**Expires:**) or was **Revoked**. Click **Generate** to create a fresh link if needed.

---

## For the QA Person

- Every released report version is stored as a permanent, locked record in the database. Later changes to method catalogue defaults or laboratory settings never alter an already-released Certificate of Analysis.
- Public share links are limited strictly to the single released report version and are automatically blocked if the report is **Withdrawn** or **Replaced by newer version**.
