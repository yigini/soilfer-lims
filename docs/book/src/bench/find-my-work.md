# Find Your Assigned Work and Open a Run

## What This Is For

Check which soil samples and analytical methods are waiting for you today. You can quickly see which items are **Ready** versus **Blocked** and open the right worksheet in **Workbench**.

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-find-my-work.png (screenshot coming once the training data is ready): The **My Work** and **Workbench** screens showing **My runs**, **My Work**, **Ready to Record**, and **Open run worksheet**.*

---

## Before You Start

- Sign in with your **Laboratory Technician** account on the **Sign in to SoilFER LIMS** screen.
- Check the top right **User Menu** to make sure your own name and laboratory are shown.

---

## Steps

1. Click **Workbench** in the left menu (or click **My Work** to view your personal dashboard first).
   *You should see the **Technician Workbench** open. It shows tabs for **My runs**, **My Work**, **Worksheet**, **Ready to Submit**, **Sent & Completed**, and **Activity Receipts** (saved confirmation records).*
2. On the **My runs** tab, check whether you already have an active run in progress:
   - Keep **My runs** selected to see runs assigned to you. Click **All runs** to see all runs in your laboratory.
   - If your run is listed, click **Open run worksheet** to jump straight into its grid.
3. To see individual sample tasks assigned to you, click the **My Work** tab inside **Workbench**.
   *You should see your tasks grouped by method, with filter pills for **Ready to Record** and **Ready to Submit**.*
4. Look at the readiness badges on each sample row:
   - **Ready**: drying and preparation are complete, so you can test the sample now.
   - **Blocked**: the sample is still waiting for **Air Drying** or **Sample Preparation** (**Prerequisites incomplete**), or has an active hold.
5. Click any method group or sample row to open it in the **Worksheet** tab. You can also use **Start run** on the **My runs** tab to build a new batch run.

---

## What Happens Next

Once you open a run or method in the **Worksheet** tab, you can start a new analytical batch (see [Start an Analytical Run and Print a Bench Worksheet](start-run-and-print-worksheet.md)). You can also enter readings right away (see [Enter Results, Replicates, and Raw Calculations](enter-results-and-replicates.md)).

---

## If Something Goes Wrong

- *If you see* **You have no tasks assigned for this sample** *(or your queue is empty) →* Ask your **Laboratory Manager** to assign the pending tests to you in **Manager Task List** under **Assign Work**. You can also check **All runs** if a colleague started the batch.
- *If a sample is in your queue but says* **Blocked** *→* Click **Inspect →** on that row and look at **Drying Gate:** (drying step that must finish first) and **Preparation Gate:** (sieving and grinding step that must finish first) in the right-hand panel. Complete drying and preparation first (see [Preparation: Drying, Grinding, Storage & Custody](../usage/preparation-and-custody.md)).

---

## For the QA Person

- **Workbench** automatically checks sample readiness before allowing result entry. No technician can enter analytical readings while **Air Drying** or **Sample Preparation** is still **Pending** or while a sample is **On Hold**.
