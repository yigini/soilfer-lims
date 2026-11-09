# Assign Pending Tests to Technicians

## What This Is For

Assign pending sample tests from **Manager Task List** or a sample's **Work & results** tab to the technicians who will run them at the bench.

> *Screenshot placeholder — docs/book/src/img/screenshots/review-assign-work.png (screenshot coming once the training data is ready): The **Manager Task List** on the **Assign Work** tab and the sample **Work & results** table showing **Assign to...** and **Assign Selected**.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Make sure the samples have been accepted at sample reception (status **Received** or **In Progress**).

---

## Steps

### Option A: Assign Tests From **Manager Task List**

1. Click **Manager Task List** in the left menu and click the **Assign Work** tab.
   *You should see cards for samples that have **Unassigned** analytical tasks.*
2. To focus on a single method (for example, pH or organic carbon), filter by method so you can assign all waiting samples for that test together.
3. Click **Assign Tech** on a sample card.
   *You should see the sample open on its **Work & results** tab with its unassigned tasks pre-selected.*
4. Choose the technician's name in **Assign to...** and click **Assign Selected**.
   *You should see a confirmation dialog (**Bulk Assignment Successful**), and the **Assigned To** column updates to show the technician's name.*

### Option B: Assign One Task Row Directly on a Sample

1. Open the sample from **Samples** and stay on the **Work & results** tab.
2. In the **Assigned To** column on any **Unassigned** row (**Please assign a tech**), open the dropdown and select the technician's name.
   *You should see **Assignment Successful** and the row status change to **Assigned**.*

---

## What Happens Next

Assigned tests appear immediately in that technician's **My Work** and **Workbench** queues (see [Technician: Workbench & Analytical Runs](../usage/technician-workbench.md)). You can pre-assign tests while a sample is still drying, and the technician's row will switch from **Blocked** to **Ready** as soon as **Air Drying** and **Sample Preparation** are completed.

---

## If Something Goes Wrong

- *If a technician's name does not appear in* **Assign to...** *→* Open **Laboratory Staff** in the left menu and check that the technician's account is **Active** and assigned to the same laboratory as the sample.
- *If the* **Assigned To** *dropdown is disabled on a row →* The test is already **Completed**, **Submitted**, or **Accepted**, or you are trying to assign **Dispose** while **Archive** is already assigned.

---

## For the QA Person

- Every single-task or bulk assignment writes an entry in **System Audit Logs** (**Work Assigned**) recording the manager who assigned the work, the target technician, and the timestamp.
- Only the assigned technician can edit or record results on an assigned task row in **Workbench**.
