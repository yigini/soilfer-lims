# Review Submitted Results and Choose the Reported Value

## What This Is For

Inspect measurements submitted by technicians, review quality control verdicts and **Cross-parameter plausibility** flags, approve or reject technician **Override requests** (requests to accept unusual readings), and choose the official **Reported value** (the final number printed on the report) for each test.

> *Screenshot placeholder — docs/book/src/img/screenshots/review-reported-value-selection.png (screenshot coming once the training data is ready): The sample **Review** tab showing the **Reported value** comparison table (**Report attempt**, **Report mean**, **Not reportable**), **Save reported value**, and **Cross-parameter plausibility**.*

---

## Before You Start

- Sign in with a **Laboratory Manager** account (or an account with review authority).
- Under two-person review rules, you must be a different person from the technician who recorded the try.

---

## Steps

### Part 1: Open a Submitted Sample and Check Plausibility & Overrides

1. Click **Manager Task List** in the left menu, open the **Review Submissions** tab, and click **Review** on a sample card.
   *You should see the sample open on its **Review** tab.*
2. If a technician requested an out-of-range approval, check the **Override requests** panel first:
   - Read the technician's **Reason**, type your **Decision reason**, and click **Approve** or **Reject**.
3. Scroll to the **Cross-parameter plausibility** card and check the **Outcome** column (**Pass**, **Flagged**, or **Not evaluated**) for **Texture closure**, **Exchangeable bases / CEC**, **Base saturation**, **C:N ratio**, and pH comparisons.

### Part 2: Choose and Save the Official **Reported value**

1. On each submitted test row, look at the **Reported value** table showing every recorded **Attempt** (measurement try), **Batch / QC** status, **Analyst**, **Recorded date**, **Replicates**, and **Mean / selected output**.
2. Under **Choose the value to report**, pick how this test should be reported:
   - **Automatic selection**: uses your laboratory's default reporting rule when only one clean try exists.
   - **Report attempt** (use this measurement try on the report): picks one specific try (for example, choosing *Try 2* after *Try 1* was diluted or invalidated).
   - **Report mean**: averages two or more selected tries (**Include attempt in mean** (average this try with another try)) that agree within the method's repeatability limit.
   - **Not reportable**: waives the test when a valid number cannot be produced (for example, insufficient sample left).
3. If you chose **Not reportable** or selected a previously **Questioned** try, type the required explanation in **Reason**.
4. Click **Save reported value** (lock in the final number for the report).
   *You should see **Current selection** update to show the saved value and unit.*
5. For soil particle size, save the **Reported value** for **Sand**, **Silt**, and **Clay** first, and then save the **Texture (Sand/Silt/Clay)** selection.

---

## What Happens Next

Once a valid **Reported value** is saved for a test, you can click **Accept Item** (or **Return for correction** if a repeat is needed; see [Return a Test for Repeat or Give Final Sample Approval](return-for-repeat-or-approve.md)).

---

## If Something Goes Wrong

- *If you see* **The selected measurements exceed their recorded repeatability limit.** *when clicking* **Save reported value** *→* The tries you ticked for **Report mean** are too far apart. Choose a single valid try (**Report attempt**) or return the test for a repeat check.
- *If you see* **Censored values cannot be averaged.** *→* One of the tries is a **< LOQ** (below the limit of quantification — the lowest amount the method can measure reliably) reading (**Report below quantification limit**). Choose **Report attempt** instead of **Report mean**.
- *If you see* **Accept and select SAND, SILT and CLAY before TEXTURE.** *→* Save the three individual particle-size fraction selections first, then save **Texture (Sand/Silt/Clay)**.

---

## For the QA Person

- SoilFER LIMS stores the reviewer's explicit **Reported value** selection as a permanent, locked record linked to the specific measurement try IDs and repeatability limits in effect at review time.
- When **Report mean** is saved, the server stores the full-precision arithmetic mean and rounds it to the method's configured decimal places only when rendering the Certificate of Analysis.
