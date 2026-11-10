# Wall Poster: QC Failed — What Now?

> *Print this A4 poster and pin it above the wet-chemistry and quality control benches.*

---

## Step 1: Stop — Never Delete or Overwrite a Failed QC Number

When a batch **Blank**, **Duplicate**, or **Control** (**Laboratory reference material (LRM)** (your lab's own in-house check soil) or **Certified reference material (CRM)** (official standard soil with a certified value)) falls outside your laboratory's **Policies** limits, SoilFER LIMS flags the batch (**Warn** or **Fail batch**). Never change a raw reading to make a red badge turn green.

---

## Step 2: Follow This 4-Question Decision Guide

| Question | What to Check | What the Technician & Manager Do |
| :--- | :--- | :--- |
| *1. Was it a simple typing or copy-paste mistake?* | Compare the number on screen in **Workbench** against the bench notebook or balance printout. | Before submission, the technician corrects the reading with a reason note. After submission, the **Laboratory Manager** applies a reviewed transcription correction (when **Allow reviewed transcription correction of undispositioned failed QC** is enabled in **Policies**). |
| *2. Did only the Blank fail?* | Check whether the **Blank** exceeded **Maximum blank value** (**< LOQ** (below the limit of quantification — the lowest amount the method can measure reliably), **< LOQ / 2**, or **Absolute limit**). | Check glassware, extractant bottle, and deionized water for contamination. Prepare fresh reagent and re-run the batch (**Fail batch**). |
| *3. Did a Calibration Check (CCV) drift mid-run?* | Check whether the initial curve and early checks passed, and only a later check standard drifted outside **Minimum CCV recovery** / **Maximum CCV recovery**. | Recalibrate the instrument and select **Repeat samples since last good instrument check** to re-measure only the samples after the last passing check standard. |
| *4. Did the Reference Soil or Duplicate Pair fail?* | Check whether the **LRM** (laboratory reference material — your lab's own in-house check soil) or **CRM** (certified reference material — official standard soil with a certified value) missed its recovery window (**Minimum control recovery** to **Maximum control recovery** or **LRM window (%)** (allowed percent range for the laboratory reference material (your lab's in-house check soil))) or the **Duplicate pair** exceeded **Maximum duplicate RPD** (relative percent difference — largest allowed percent difference between two repeat readings of the same sample) / **Absolute duplicate limit**. | If only one duplicate pair disagreed, return that sample (**Returned**) for a repeat try. If the **LRM** or **CRM** failed, reject the batch, fix the instrument or extraction issue, re-run the batch as Try 2, and log a problem record in **QA Dashboard** if the problem repeats. |

---

## Golden Rule for Bench Staff

*A failed QC check is not a punishment. It is the safety net that catches a drifted meter or contaminated reagent before a wrong fertilizer recommendation reaches a farmer.*
