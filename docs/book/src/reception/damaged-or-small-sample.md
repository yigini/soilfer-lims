# Sample Arrived Damaged, Leaking, or Too Small

## What This Is For

Handle a soil bag that arrives torn, cross-contaminated, unlabelled, or without enough soil for all requested tests, either by rejecting it cleanly (**Rejected (Non-Conformance)**) or by accepting it with a documented **Mass deficit** warning.

> *Screenshot placeholder — docs/book/src/img/screenshots/reception-condition-checks.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **2. Condition** (**Reception Compliance**) step showing **Container Intact / Sealed**, **Sample Quantity Sufficient**, **Fail**, **Describe the observed problem**, and **Mass deficit**.*

---

## Before You Start

- Sign in with a **Sample Reception** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Inspect the damaged or small bag on your desk without opening any leaking inner bag that could contaminate other samples in the box.

---

## Steps

### Case A: The Sample Is Too Damaged or Contaminated to Test (Reject)

1. Look up the sample in **Sample Reception** under **Project Sample** (or **Walk-in / External**) and open **2. Condition** (**Reception Compliance**).
2. Click **Fail** on the check that failed (**Container Intact / Sealed**, **Label Legible & Matches ID**, **Sample Quantity Sufficient**, or **Sample Condition (Dry, No Contam.)**).
   *You should see the **Describe the observed problem** box appear.*
3. Type a clear description of what you see on the bag in **Describe the observed problem** (for example, that the plastic bag burst in transit and mixed with another sample).
4. Click **Reject** (**Non-Conformance**).
   *You should see the sample status change to **Rejected (Non-Conformance)**.*
5. Place the rejected bag in your quarantine tray so it is never carried to the drying room.

### Case B: The Bag Is Intact, But Has Less Soil Than Normal (Accept With Mass Warning)

1. Weigh the bag and type its actual weight in grams into the mass field in **Sample Reception**.
   *If the weight is below the total needed for the ordered tests, you should see a **Mass deficit** warning showing the required grams versus the received grams.*
2. Check with your **Laboratory Manager** which tests should take priority if there is not enough soil for every method.
3. Type the priority order or customer agreement in **Intake Notes / Visual Observations**.
4. Tick **Acknowledge this sample’s mass warning** and click **Accept & Print Label**.
   *You should see **INTAKE CONFIRMED!** and the sample move to **Accepted** with the mass warning saved on its record.*

---

## What Happens Next

- A sample marked **Rejected (Non-Conformance)** is permanently locked out of **Workbench** so no technician can accidentally record results for it, and the project coordinator can see the rejection reason in **Samples**.
- A sample accepted with an acknowledged **Mass deficit** moves to **Accepted** (**Waiting for drying**) with your note visible to the technician and reviewer.

---

## If Something Goes Wrong

- *If you see a validation message for* **Non-conformance reason** *→* Make sure you typed an explanation in **Describe the observed problem** for each check you marked **Fail**.
- *If you see a validation message that the* **Mass deficit** *must be acknowledged →* Either tick **Acknowledge this sample’s mass warning** after checking with your manager, or untick lower-priority tests in **3. Analyses**.
- *If a sample was accepted earlier and you only discover a problem when opening the bag at the drying bench →* Open the sample in **Samples** and place a hold on it (**Sample holds**), or ask a reception clerk to click **Undo intake** before preparation is recorded.

---

## For the QA Person

- Required sample mass is computed automatically by summing the sample mass required by each ordered analytical method and multiplying by your laboratory's reserve factor in **Policies** (see [Per-Lab Settings, Presets & Method Overrides](../usage/lab-settings-and-presets.md)).
- Rejecting a sample at intake preserves the record in **Rejected (Non-Conformance)** rather than deleting it, providing full traceability for field teams and ISO/IEC 17025 nonconforming-work records.
