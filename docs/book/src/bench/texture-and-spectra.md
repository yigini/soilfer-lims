# Record Soil Texture (Sand, Silt, Clay) and Spectra

## What This Is For

Record multi-part soil measurements that use specialized bench editors in **Workbench**. These include particle size fractions (**Sand**, **Silt**, and **Clay** percentages with automatic closure and USDA texture class calculation) and soil spectroscopy scans (**Upload spectra →** / **Open Spectral Capture** for MIR and Vis-NIR).

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-texture-and-spectra.png (screenshot coming once the training data is ready): The **Workbench** showing the **Fractions (Sand / Silt / Clay %)** editor with closure badge and the **Spectra Acquisition Status** column with **Upload spectra →**.*

---

## Before You Start

- Sign in with a **Laboratory Technician** account. Make sure the samples have completed **Air Drying** and **Sample Preparation**.
- For spectroscopy, make sure your spectrometer is registered and **In Service** in **Equipment**. Have your .spc, .0, .csv, or .jdx scan files ready.

---

## Steps

### Part 1: Record Soil Particle Size / Texture (**Sand**, **Silt**, **Clay**)

1. Click **Workbench** in the left menu and select your particle size method in **Work type:**.
   *You should see the worksheet table with the **Fractions (Sand / Silt / Clay %)** column (or **Soil Texture Fractions** in **Card View**).*
2. On your sample row, type the **Sand:** percentage and press Enter to move to **Silt:**. Type **Silt:** and press Enter to move to **Clay:**.
   *While fewer than three boxes are filled, you will see **All 3 fractions required for closure check**.*
3. Once all three numbers are entered, look at the closure badge underneath the row:
   - If Sand + Silt + Clay adds up to 100 % within your laboratory's allowed tolerance, a green badge shows the sum and the calculated USDA texture class (for example, Loam, Sandy Clay Loam, or Clay).
   - If the sum is outside tolerance, an amber warning badge shows the sum error. Check your hydrometer or pipette calculations before recording.
4. Click **Record all ready** (or **Record this sample** in **Card View**) to record the three fractions and derived texture class.

### Part 2: Upload MIR or Vis-NIR Soil Spectra

1. In **Workbench**, select your spectral analysis (such as Vis-NIR or MIR) in **Work type:**.
   *You should see the **Spectra Acquisition Status** column showing **Spectrum required** on unrecorded rows.*
2. Click **Upload spectra →** on the sample row (or click **Open Spectral Capture** in **Card View**).
   *You should see the spectral intake window open.*
3. Confirm the spectrometer instrument and select or drag in your spectral scan file(s). Preview the wavenumber range and quality check flags.
4. Confirm and commit the spectral upload.
   *You should see the **Import receipt** showing the count of recorded scans. The row badge in **Workbench** changes to **Scan Recorded** (or shows the scan's quality status).*

---

## What Happens Next

- Recorded texture rows and spectral scans are ready to be bundled and sent to your reviewer on the **Ready to Submit** tab (see [Review, Record, and Submit Completed Samples](record-and-submit-for-review.md)).
- Reviewers and managers can inspect the full absorbance curve in the **Spectral Library** or by clicking **Open Spectra Viewer** during review.

---

## If Something Goes Wrong

- *If the texture row stays excluded when you click* **Record all ready** *→* Check whether one of the three boxes (**Sand:**, **Silt:**, or **Clay:**) is missing or whether the sum error exceeds your method's closure tolerance.
- *If a batch spectral upload finishes with* **Import partially completed** *→* Click **Review and retry remaining entries** to inspect the failed file and upload it again.
- *If you need to replace a spectrum on a sample that was already marked completed →* Click **Inspect / Rescan**. When prompted by **Reopen completed work** (**This change affects a completed work item. Enter a reason to reopen it and retry.**), type the **Reason (required)** and click **Reopen and retry**.

---

## For the QA Person

- When a particle size determination is recorded, SoilFER LIMS stores the three measured fractions (**Sand:**, **Silt:**, **Clay:**) and automatically derives the USDA texture classification so individual fraction tasks never drift out of sync.
- Uploaded spectra are checked automatically for wavenumber range, flatlines, and baseline anomalies before being linked to the sample's measurement try. For full details on managing the spectral library, see [Spectral Data Management (MIR & Vis-NIR)](../usage/spectral.md).
