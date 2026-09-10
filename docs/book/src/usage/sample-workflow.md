# The Sample Workflow

This is the heart of SoilFER-LIMS — how a soil sample moves through the system from field to final report.

---

## Visual Overview

```
 📱 Field          📋 Reception       🔬 Analysis        ✅ Review          📊 Report
┌───────────┐    ┌─────────────┐    ┌──────────────┐    ┌────────────┐    ┌───────────┐
│ Collect   │    │  Receive &  │    │  Perform     │    │  Review &  │    │  Export   │
│ sample in │ →  │  log the    │ →  │  soil tests  │ →  │  approve   │ →  │  results  │
│ field     │    │  sample     │    │  in the lab  │    │  results   │    │  & report │
└───────────┘    └─────────────┘    └──────────────┘    └────────────┘    └───────────┘
  KoboToolbox      Reception          Technician         Lab Manager     Data Results
  (optional)       staff              (assigned)         (required)      page
```

---

## Stage 1: Field Collection

Soil samples are collected in the field by field teams. There are two ways samples enter the system:

### Automatic (via KoboToolbox)
If your field teams use [KoboToolbox](https://www.kobotoolbox.org/) for data collection, sample information flows into LIMS automatically. When a field worker submits a form on their phone, the data appears in the LIMS Reception queue at the next sync interval.

This includes GPS coordinates, soil depth, field observations, and any photos taken.

### Manual Entry
If you don't use KoboToolbox, samples are entered manually when they physically arrive at the lab.

---

## Stage 2: Reception

When a physical soil sample arrives at the laboratory, the **Reception** staff:

1. **Open the Reception page** in SoilFER-LIMS
2. **Find the matching entry** (if it was pre-submitted via KoboToolbox) or create a new one
3. **Verify the sample** — check the label, condition, and quantity
4. **Assign a Laboratory ID** — a unique identifier for this sample (auto-generated or custom)
5. **Record any observations** — damaged container, insufficient quantity, soggy soil, etc.
6. **Submit for analysis** — moves the sample to the next stage

The sample's status changes from `RECEIVED` to `IN_ANALYSIS`.

---

## Stage 3: Analysis

The **Lab Manager** assigns samples to **Lab Technicians** for analysis. Each sample may have multiple analyses assigned (pH, organic carbon, texture, etc.).

The technician:

1. Goes to **My Work** or **Tech Workbench** to view their assigned analytical queue
2. Selects the method worksheet (e.g. pH, texture panel, or spectra intake)
3. Confirms prerequisites (sample drying, physical preparation, instrument eligibility)
4. Enters observations or uploads original spectral exports with QC validation
5. Saves local drafts and clicks **Submit for Review**

The results are now pending approval in the Manager Review Queue.

> 💡 Technicians can only **save** and **submit** analytical results — they cannot approve them. This separation of duties is strictly enforced by the system for laboratory quality control and ISO/GLOSOLAN compliance. Guidance is available at every step via the **Help Centre** and page contextual drawer.

---

## Stage 4: Review & Approval

The **Lab Manager** reviews submitted results:

1. Goes to the **Manager Queue** or **Dashboard**
2. Sees a list of samples with results pending review
3. For each result:
   - **Approve** ✅ — the result is finalized and becomes part of the official record
   - **Reject** ❌ — the result is sent back to the technician with comments explaining why (e.g., "Value out of expected range, please re-analyze")

Only approved results appear in exports and reports.

---

## Stage 5: Reporting & Export

Once results are approved, they're available for export:

1. Go to **Data Results**
2. Filter by project, date range, sample type, or analysis
3. Export to:
   - **Excel (.xlsx)** — formatted spreadsheets with headers
   - **CSV** — raw data for statistical software (R, Python, SPSS)
   - **PDF** — formatted reports suitable for clients or publications

---

## Sample Status Lifecycle

At any point, you can see where a sample is in the workflow by its status:

| Status | Meaning | Who Moves It Forward |
|--------|---------|---------------------|
| `SYNCED` | Pre-submitted from KoboToolbox, waiting for physical receipt | Reception |
| `RECEIVED` | Physically received at the lab | Reception |
| `IN_ANALYSIS` | Assigned to technicians, work in progress | Technician |
| `PENDING_REVIEW` | Results submitted, waiting for manager approval | Lab Manager |
| `APPROVED` | All results approved — final record | (Complete) |
| `REJECTED` | Sample rejected at reception (e.g., damaged, wrong type) | Reception |

---

## Quality Control

Throughout the workflow, several quality measures are in place:

- **Separation of duties** — technicians enter results, managers approve them
- **Audit trail** — every action is logged (who, what, when)
- **QC batches** — group samples with reference materials and blanks for batch-level quality assessment
- **Range checks** — flag results that fall outside expected ranges
- **Spectral validation** — automatic quality checks on uploaded spectra
