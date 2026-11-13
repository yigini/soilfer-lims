# Manager Card: Reviewing, Failed QC & Reports

> *Pin this A4 card at the Laboratory Manager and QA Officer desks.*

---

## 1. Reviewing a Submitted Batch in Manager Task List

1. *Open the review queue:* Click **Manager Task List** in the left menu to see batches and samples with status **Submitted** (**Awaiting Review**).
2. *Check the batch QC verdict first:* Verify that the batch **Blank**, **Duplicate pair**, and **Control** (**Laboratory reference material (LRM)** (your lab's own in-house check soil) or **Certified reference material (CRM)** (official standard soil with a certified value)) passed your laboratory's **Policies** criteria.
3. *Check cross-parameter plausibility flags:* Review any warning flags (for example, texture sum of fractions, exchangeable bases vs. CEC, C:N ratio, or carbonate vs. water pH).
4. *Select the final report number (when multiple tries or replicates exist):*
   - Open **Final report value** (**Choose the value to report**).
   - Pick **Use this try on report**, **Report mean** (average of agreeing tries within the **Repeatability limit**), **Report class from selected fractions** (for texture), or **Not reportable** (with a written **Reason**).
   - Click **Save final report value**.
5. *Approve or return for repeat:*
   - Click **Approve** on valid results. If **Require a second reviewer** is enabled in **Policies**, a second reviewer must approve any batch you measured yourself.
   - If a measurement needs re-testing, return it to the technician with a clear reason note. It appears in their **My Work** queue as **Returned**.

---

## 2. What to Do When a Batch Fails QC

1. *Inspect the failure in* **QA Dashboard** *or* **Manager Task List**: Check which control slot failed (**Blank**, **Duplicate pair**, **LRM** (laboratory reference material — your lab's own in-house check soil), **CRM** (certified reference material — official standard soil with a certified value), or calibration check).
2. *Choose the right action:*
   - *Typing or dilution-factor mistake on the raw reading:* Use a reviewed transcription correction with a mandatory reason (when **Allow reviewed transcription correction of undispositioned failed QC** is enabled).
   - *Continuing calibration drift mid-run:* Select **Repeat samples since last good instrument check** to re-run only the affected samples after recalibrating.
   - *Blank contamination or reference soil out of range:* Reject the batch (**Fail batch**) and return the affected samples for a fresh measurement try. Log a problem record in **QA Dashboard** if root-cause investigation is needed.

---

## 3. Issuing & Amending Official PDF Reports

1. *Issue the report:* Once all required tests on a sample are **Approved**, open **Reports** (**Result Reports**), preview the **Certificate of Analysis** PDF, and issue or download it.
2. *Amend a released report:* Approved and reported results are locked. If a correction or client retest is ever needed after release, open a formal report amendment (co-signed by a second person when **Require a second person for amendments** is enabled). Issuing the new revision automatically retires public links to the replaced report version.

{{#include ../_includes/pilot-support.md}}
