# Record Blanks, Duplicates, and Reference Soils in a Run

## What This Is For

Enter the measurements for the quality control positions in your analytical run (*blanks*, *duplicates*, and *reference soils*; see [Glossary](../reference/glossary.md)), save the observations, and run the automatic quality control check (**Evaluate QC**).

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-qc-positions-and-evaluate.png (screenshot coming once the training data is ready): The native run panel in **Workbench** showing quality control positions, **Bound reference lot**, **Duplicate parent position**, **Save observations**, and **Evaluate QC**.*

---

## Before You Start

- You have started an analytical run in **Workbench** (see [Start an Analytical Run and Print a Bench Worksheet](start-run-and-print-worksheet.md)) and measured your physical quality control checks alongside your soil samples.

---

## Steps

1. In **Workbench**, open your active run in the **Worksheet** tab.
   *You should see the run sequence containing both your soil sample positions and the reserved quality control positions.*
2. Check that each quality control position has the right link before typing its value:
   - For a *reference soil* position, verify the **Bound reference lot** (check soil bottle linked to this batch slot) and its **Expected value** (**Keep every required reference position bound to an eligible lot.**). If you changed reference lots on an unstarted run, click **Save reference bindings** (lock in the chosen check soil bottles for this run).
   - For a *duplicate* position, verify the **Duplicate parent position** (**Select the original sample position** that was weighed a second time).
3. Type the measured reading into each quality control row:
   - Enter the reading for each *blank* (reagent-only check with no soil).
   - Enter the reading for each *reference soil* (laboratory reference material or certified reference material).
   - Enter the reading for each *duplicate* (and any calibration check standards in the run).
4. Click **Save observations**.
   *You should see the confirmation message **QC observations saved**.*
5. Click **Evaluate QC**.
   *You should see the **Verdict** and **Limits** displayed for each quality control position and for the run.*

---

## What Happens Next

- If all quality control positions pass (**QC within limits for all reported values.**), proceed to record and submit your samples (see [Review, Record, and Submit Completed Samples](record-and-submit-for-review.md)).
- If a quality control check fails (**QC failed**), do not panic and do not erase your readings. Record the factual observations as measured; your **Laboratory Manager** will review the failed run and decide whether to repeat a group of samples between two instrument check standards, repeat the batch, or record a manager batch decision (see [Quality Control, Control Charts & Failed QC](../usage/qc-management.md)).

---

## If Something Goes Wrong

- *If you see* **Start the run before entering or evaluating QC.** *→* Click **Start run** (or **Confirm and start**) first so the run's quality control rules and sample positions are frozen.
- *If you see* **Enter valid observations for every required position before evaluation.** *→* Check every reserved quality control row in the run and make sure none of them are left blank before clicking **Evaluate QC**.
- *If you see* **Select the actual SAMPLE parent position for each duplicate.** *→* Choose which sample row in the run was split as the duplicate under **Duplicate parent position** (**Select the original sample position**).
- *If you mistyped a quality control reading and need to fix it →* Click **Correct this observation**, enter the corrected reading and **Reason for correction or reopen**, and save.

---

## For the QA Person

- Quality control evaluation (**Evaluate QC**) compares each *blank*, *duplicate*, and *reference soil* against the **Rule version** and **Policy version** frozen when the run started (**Frozen evaluation evidence**).
- When a *reference soil* is tracked on a Shewhart Levey-Jennings control chart (**Control charts**), evaluating the run automatically checks the point against the active **Approved limits** (or records it in the **Provisional** / **Fixed window** baseline series).
