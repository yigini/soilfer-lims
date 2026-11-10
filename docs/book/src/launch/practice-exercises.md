# Hands-On Practice Exercises & Answer Key

> *Time:* 10–15 minutes per role during training.
> *Who can do this:* All laboratory staff practicing in the training project (*Demo Soil Lab*).

Use these ten short exercises during your hands-on training sessions. Each exercise uses fictional *Demo Soil Lab* samples so staff can practice realistic daily tasks—including mistakes and blocked screens—before touching real client samples.

---

## Part 1: Reception & Sample Preparation Exercises

### Exercise 1: Receive a healthy walk-in soil sample and print its label
- *Scenario:* Farmer K. Mensah brings one topsoil bag (0–20 cm, roughly 500 g, dry and intact) for routine fertility testing.
- *Your task:* Open **Walk-in Intake** (or **Sample Reception**), register the sample, confirm the bag is intact, click **Accept Sample**, and open **Print labels** to preview a **Standard (101 × 54 mm)** label.
- *Answer key (what you should see):* The sample receives a permanent laboratory sample code with a check character, its status badge becomes **Accepted**, and drying and preparation tasks are created automatically.

### Exercise 2: Handle a torn, leaking bag in a project box
- *Scenario:* You are receiving a 5-bag shipping box of samples in **Sample Reception**. Bag 4 is torn and only 30 g of wet mud remains inside (not enough for testing).
- *Your task:* Accept the four healthy bags, and record Bag 4 as damaged and insufficient.
- *Answer key (what you should see):* The four healthy bags move to **Accepted**. Bag 4 is marked **Rejected (problem recorded)** with your written note, and the system never creates bench work items for the rejected bag.

### Exercise 3: Complete drying and sieving for an accepted sample
- *Scenario:* Sample 1 from Exercise 1 has finished air-drying below 40 °C and has been sieved through a 2 mm sieve (total dry mass 480 g, coarse stones retained on sieve 24 g).
- *Your task:* Open the sample in **My Work** or **Workbench**, complete the drying record (**Confirm work is done**), and enter the sieving masses.
- *Answer key (what you should see):* The system calculates the coarse fraction percentage (5.0%), unlocks the analytical bench tests, and moves the sample status from **Accepted** to **Processing**.

---

## Part 2: Bench Technician Exercises

### Exercise 4: Run a pH batch with a Blank, Duplicate, and Reference Soil
- *Scenario:* You have three prepared samples ready for Soil pH (1:2.5 water) using your calibrated bench pH meter.
- *Your task:* Open **Workbench**, select your pH method and an **In Service**, **Ready / Calibrated** pH meter, enter pH readings for the three samples (6.42, 5.18, 7.05), the **Blank**, the **Duplicate** of Sample 1 (6.45), and the active **Laboratory reference material (LRM)** (your lab's own in-house check soil) check soil (assigned value 6.10, measured 6.08), then submit the batch.
- *Answer key (what you should see):* Because the duplicate agreement and reference soil recovery are within your laboratory's **Policies** limits, the batch QC verdict passes and the results move to **Submitted** for manager review.

### Exercise 5: Enter sand, silt, and clay on the texture panel
- *Scenario:* On a particle-size sample, you measured 45.0% sand, 35.0% silt, and 28.0% clay (which adds up to 108.0% due to a typing mistake on clay; the true clay reading in your notebook is 20.0%).
- *Your task:* Type 45.0, 35.0, and 28.0 first to see what the screen does. Then correct clay to 20.0% and save.
- *Answer key (what you should see):* At 108.0%, the closure check flags that the three fractions exceed **Texture closure tolerance (%)**. Once corrected to 45.0% + 35.0% + 20.0% = 100.0%, the closure check passes and the USDA texture class (*Loam*) is derived automatically.

### Exercise 6: Fix a result that the manager returned for a repeat run
- *Scenario:* Your manager returned Sample 2's phosphorus reading with the note *Dilution factor 10x was not applied; please re-check or repeat*.
- *Your task:* Find the **Returned** item in **My Work**, open it in **Workbench**, see Try 1 preserved in history, and record Try 2 with the corrected reading.
- *Answer key (what you should see):* Try 1 stays visible and untouched in the measurement history, Try 2 is recorded as the new current try with your explanation, and the item returns to **Submitted**.

---

## Part 3: Manager, QA & Administrator Exercises

### Exercise 7: Choose the official reported value when two attempts exist
- *Scenario:* Open **Manager Task List** and inspect the sample from Exercise 6, which now has Try 1 (questioned) and Try 2 (valid).
- *Your task:* Open the **Final report value** selector (**Choose the value to report**), select **Use this try on report** for Try 2, click **Save final report value**, and click **Approve**.
- *Answer key (what you should see):* Try 2 becomes the **Current selection**, while Try 1 remains in the audit history. Once all required tests on the sample are approved, the sample status becomes **Approved**.

### Exercise 8: Disposition a batch where the reference soil failed QC
- *Scenario:* In a potassium batch, the **Laboratory reference material (LRM)** control read 25% too high because the flame photometer drifted.
- *Your task:* Inspect the failed batch in **QA Dashboard** or **Manager Task List** and reject/return the batch for re-measurement after recalibrating the instrument.
- *Answer key (what you should see):* Under **ISO 17025 strict** (**Required, blocking**), the system blocks approval of the sample results in that failed batch until a valid repeat try passes QC.

### Exercise 9: Issue an official PDF report and then amend it
- *Scenario:* Generate a **Certificate of Analysis** PDF for the approved sample from Exercise 7 in **Reports**. Then suppose the client notifies you that the field sample depth on the manifest was 0–30 cm instead of 0–20 cm.
- *Your task:* Open a formal amendment on the released report, record the reason, and issue the amended report revision.
- *Answer key (what you should see):* The new report is issued as Revision 2 with an **Amended report statement** referencing Revision 1, and any public verification link to Revision 1 is automatically retired.

### Exercise 10: Invite a new technician and check a method's QC rule
- *Scenario:* A new analyst joins your laboratory.
- *Your task:* Open **Laboratory Staff**, click **Invite Team Member**, select **Laboratory Technician**, and generate a **One-Time Activation Link**. Then open **Policies** and inspect the **Duplicate interval** for Soil pH in your laboratory.
- *Answer key (what you should see):* You get a single-use 24-hour link (**Copy Activation Link**), and **Policies** shows the **Effective value** and **Source** (**Lab starting rules** or **Custom method rule**) for your laboratory.

---

## Related Guides

- [Three-Session Lab Training Plan](./training-plan.md)
- [Day-One & Week-One Parallel-Run Guide](./day-one-guide.md)
- [Printable Bench Cards & Posters](../print/index.md)

---

### For the QA Person

- *Answer key verification:* Every outcome in the answer key above reflects the live server validation rules in SoilFER LIMS, giving trainees realistic practice with duplicate detection, required preparation steps, closure checks, and QC blocking before go-live.
