# Redo or Reopen a Completed Preparation Step

## What This Is For

Handle situations where a drying or preparation step needs a second look. You can verify a step in **Awaiting verification**, resolve a **Legacy Completion — Evidence Gap**, or return work for **Preparation error**.

> *Screenshot placeholder — docs/book/src/img/screenshots/preparation-reopen-and-verify.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Work & results** tab on a sample page showing **Preparation Prerequisites**, **Evidence needs verification**, and the manager verification controls on **Operational Gates**.*

---

## Before You Start

- As a **Laboratory Technician**, you can view whether a gate is **Awaiting verification** or **Repeat requested**, and record a new pass.
- As a **Laboratory Manager**, you can verify **Awaiting verification** gates, return work for **Preparation error**, or click **Reopen Sample**.

---

## Steps

### Case 1: Your Lab Requires Two-Person Verification of Preparation (**Awaiting verification**)

1. When a technician confirms **Air Drying** or **Sample Preparation** in a laboratory requiring verification, the task moves to **Awaiting verification**.
2. Sign in as a **Laboratory Manager** and open the sample in **Samples**.
3. Look at the **Ordered Analyses** table on the **Work & results** tab under **Operational Gates** and inspect the technician's checklist:
   - Click the green check button (**Approve submitted result**) to accept the preparation step so its status becomes **Completed**.
   - Or click the red return button (**Reject (Request Reanalysis)**) and enter a note if the technician must redo the step (**Repeat requested**).

### Case 2: An Analytical Test Reveals a Preparation Mistake (**Preparation error**)

1. If a bench run or review shows poor homogenization or contamination during preparation, open the sample's **Review** tab in **Samples**.
2. Click the red return button (**Return for correction**) to open the **Return for repeat testing** dialog.
3. Under **Repeat reason**, choose **Preparation error**.
4. In **Review note**, instruct the technician to prepare a fresh **Fine earth** or **Ground** container and re-run the test. Then click **Confirm return**.
   *You should see the previous attempt marked **Invalidated**, and a new attempt open with status **Repeat requested**.*
5. The technician creates a new child container in **Containers and aliquots**, selects it in **Workbench**, and records the repeat reading.

### Case 3: A Historical Sample Shows **Legacy Completion — Evidence Gap**

1. An older or imported sample may show **Evidence needs verification** on **Preparation Prerequisites** (or **Legacy Completion — Evidence Gap** in **Workbench**). This means the sample was marked done before procedural checklists were turned on.
2. Open the sample in **Samples** as a **Laboratory Manager** and inspect the original paper preparation log.
3. Either return the preparation gate for a fresh documented checklist or verify the record according to your laboratory's procedure.

---

## What Happens Next

Once the returned or unverified preparation step is confirmed and verified (**Checklist Verified**), **Preparation Prerequisites** shows **Completed** for both gates. Downstream bench tests can then proceed and be approved.

---

## If Something Goes Wrong

- *If a technician sees* **Revert the completed gate with a reason before a new verification attempt.** *→* Ask a **Laboratory Manager** to return the gate first so the reason for redoing preparation is recorded.
- *If the sample was already finally approved (**Approved**) before the error was discovered →* A **Laboratory Manager** must open the sample in **Samples**, click **More actions**, click **Undo final approval**, enter the reason, and click **Reopen Sample**. If a PDF report was already released, click **Start report amendment** instead.

---

## For the QA Person

- SoilFER LIMS never overwrites a completed preparation receipt or analytical attempt in place. Returning work for **Preparation error** marks the prior attempt **Invalidated** in **Attempt history** and links the new attempt to the new **Aliquot**.
- Reopening an approved sample (**Reopen Sample**) creates a distinct pass in the timeline (**Reopened Analytical Record — Multiple Passes**). Auditors can see every pass, reason, and approval date.
