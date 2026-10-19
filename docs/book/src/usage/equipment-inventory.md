# Equipment Readiness, Inventory & Proficiency Testing

Reliable soil testing depends on calibrated instruments, traceable reagent lots, and regular participation in interlaboratory **Proficiency Testing (PT)** schemes (such as FAO GLOSOLAN PT rounds). This guide explains how SoilFER-LIMS manages your laboratory's instruments, consumables, and proficiency testing records.

---

## 1. Equipment & Instrument Readiness

### Registering & Qualifying Instruments
In **Equipment & Inventory → Equipment**, Lab Managers (`MANAGE_EQUIPMENT`) maintain an inventory of all laboratory instruments (analytical balances, drying ovens, sieve shakers, pH/EC meters, spectrophotometers, flame photometers, AAS, ICP-OES, and MIR/NIR spectrometers).

- **What you see**: Each instrument card shows its name, internal asset tag (e.g. `OV-02`, `PH-01`, `ICP-01`), serial number, physical location, current status (`IN_SERVICE`, `MAINTENANCE`, `OUT_OF_SERVICE`), calibration/verification schedule, and live **Readiness Verdict**.
- **What you do**:
  1. Click **Register Instrument** and enter the asset details, status, and calibration interval.
  2. Map the instrument to the **Analyses & Methodologies** it is qualified to run.
  3. Log **Calibration**, **Intermediate Verification**, and **Maintenance** events as they occur.
  4. *(Optional)* For instruments that export data files (ICP, AAS, UV-Vis), configure a versioned **Instrument Import Template** under the instrument's settings.

### How Instrument Readiness Protects Analytical Runs
SoilFER-LIMS evaluates instrument readiness dynamically whenever you build a run or record a measurement:

| Situation | What Happens in the Workbench |
| :--- | :--- |
| **Instrument is `IN_SERVICE` and within calibration window** | Instrument appears in the eligible instrument picker and can start runs and record results normally. |
| **Instrument calibration is approaching due date** | Displays a **Warning (`WARN`)** badge in the Equipment Registry and Workbench drawer so you can schedule calibration before it expires. |
| **Instrument is overdue for calibration, out of service, or not qualified for the method** | Blocked at run start and at result commit (`EQUIPMENT_NOT_READY`) when required by your laboratory's equipment criticality policy. |
| **Frozen Readiness Evidence on Every Result** | When you click **Confirm & Record** in the Workbench (or confirm a Drying/Preparation gate with an equipment asset), SoilFER-LIMS re-verifies the instrument inside the transaction and saves an immutable `equipmentReadiness` snapshot on both the **Work Attempt** and the **Result**. |

---

## 2. Reagent Inventory, Storage Locations & Lot Linking

### Reagent vs. Sample Storage Locations
In **Equipment & Inventory → Locations**, every storage location has an explicit **Purpose**:
- **Reagent / Consumable Locations**: Chemical cabinets, acid stores, refrigerator shelves for standards, and glassware cupboards.
- **Sample Storage Locations (`SAMPLE`)**: Soil drying rooms, fine-earth racks, and archive rooms (used exclusively by the Sample Custody & Retention workflow).

### Managing Stock & Reagent Lots
- **What you see**: The **Inventory Catalogue** shows each chemical, buffer, standard, or consumable item, its current stock quantity, minimum alert threshold, and individual **Inventory Lots** (with lot number, supplier, expiration date, and `AVAILABLE` status).
- **What you do**:
  1. Create catalogue items for your reagents and set a **Minimum Stock Threshold** to receive low-stock alerts before you run out mid-batch.
  2. Record **Stock Additions** (with supplier lot number and expiry date) when new bottles arrive, and **Stock Withdrawals** when bottles are opened or consumed.
  3. **Link Reagent Lots to Analytical Runs**: When creating or running a batch in the **Workbench**, select the active, unexpired reagent lots (`AVAILABLE`) used in that run. SoilFER-LIMS records an immutable `BatchReagentLot` link in the batch's evidence (linking a lot to a run records quality traceability without automatically subtracting bottle stock).

---

## 3. Proficiency Testing (PT) & Interlaboratory Comparisons

Participating in **Proficiency Testing (PT)**—where multiple laboratories analyze blind sub-samples of the same homogenised soil and compare their results—is a cornerstone of **FAO GLOSOLAN** harmonization and **ISO/IEC 17025 (§7.7.2)**.

### Recording a Proficiency Testing Round (`ProficiencyRound`)

- **What you see**: In **Quality Control → Proficiency Testing**, you see your laboratory's historical PT rounds, their calculated **$z$-scores**, classification badges (`SATISFACTORY`, `QUESTIONABLE`, `UNSATISFACTORY`), and any linked **Nonconformity Reports (NCRs)**.
- **What you do**:
  1. Click **Record PT Result**.
  2. Fill in the round details:
     - **Scheme / Provider**: e.g., `GLOSOLAN PT 2026`, `WEPAL`, or national interlaboratory ring test.
     - **Round Identifier & Date**: The official round code and report date.
     - **Analysis**: Select the canonical analysis code from your catalogue.
     - **Lab Measured Value ($x_{\text{lab}}$)**: The concentration reported by your laboratory.
     - **Assigned Reference Value ($X_{\text{pt}}$)**: The consensus or reference value published by the PT provider.
     - **Proficiency Standard Deviation ($\sigma_{\text{pt}}$)**: The standard deviation for proficiency assessment published by the scheme provider (must be an explicit positive number, $\sigma_{\text{pt}} > 0$).
  3. Click **Save & Evaluate PT Round**.

### How PT Scores Are Evaluated & What Happens Next
SoilFER-LIMS calculates the full-precision **$z$-score** and freezes the laboratory's resolved PT limits (configurable per laboratory and per analysis in **Settings → Laboratory Policy**):

$$z = \frac{x_{\text{lab}} - X_{\text{pt}}}{\sigma_{\text{pt}}}$$

| Classification | Shipped Default Threshold (Configurable per Lab & Analysis) | Meaning & System Action |
| :--- | :--- | :--- |
| **`SATISFACTORY`** | $\|z\| \le 2.0$ | Green badge. Analytical performance is in agreement with the interlaboratory consensus. |
| **`QUESTIONABLE`** | $2.0 < \|z\| < 3.0$ | Amber warning badge. Investigatory warning—check calibration curves, standards, and control charts for early drift. |
| **`UNSATISFACTORY`** | $\|z\| \ge 3.0$ | Red badge. **Mandatory Corrective Action**: SoilFER-LIMS automatically sets the round's NCR status to `RAISED` and creates a linked **Nonconformity Report (`NonconformityReport`)** in the same transaction. |

### Correcting or Reviewing a PT Round
- **If you need to correct a PT entry**: A manager can submit an audited correction (providing an explicit $\sigma_{\text{pt}} > 0$ and reason). Both the before and after values are preserved in the audit log. If a round was already linked to a Nonconformity Report, that NCR link is permanently retained even if a corrected score becomes satisfactory—you still close the NCR with an explanation of what happened.
- **Tracking PT Trends**: Your laboratory's recent PT $z$-scores and any open PT Nonconformity Reports appear directly on the **QA Dashboard**.
