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
If your field teams use [KoboToolbox](https://www.kobotoolbox.org/) for data collection, sample information flows into LIMS automatically during synchronization. When a field worker submits a collection form, the record is created in the LIMS Reception queue with status `EXPECTED` and `receptionDate: null`. 

This record captures field identity, GPS coordinates, depth, collection date, surveyor name, and field photos. Crucially, an imported Kobo submission represents an expected field consignment—it does not by itself prove that the physical soil container has arrived at the laboratory.

### Manual Walk-In Entry
If samples arrive without a prior Kobo submission, reception staff enter sample and collection details manually directly in SoilFER-LIMS.

---

## Stage 2: Physical Reception & Confirmation

Physical receipt is the authoritative operational gate that transitions expected specimens into active laboratory custody. When physical soil containers arrive at the facility, authorized **Reception** staff:

1. **Open Reception** (`/reception`) in SoilFER-LIMS.
2. **Locate the expected record** (pre-registered via KoboToolbox with status `EXPECTED`) or create a walk-in intake.
3. **Verify the physical delivery** — inspect container integrity, moisture condition, physical sample volume, and match physical label identifiers against the digital record.
4. **Assign the Laboratory ID** — generate or assign the official, unique laboratory accession identifier (`labId`).
5. **Record intake non-conformances** (if any) — damaged container, leakage, insufficient volume, or label discrepancies. If non-conforming, the sample can be quarantined or rejected (`RECEIVED_REJECTED`).
6. **Confirm physical receipt** — this authoritative action sets `receptionDate` to the current timestamp and moves the sample status to `RECEIVED` / `ACCEPTED`, generating a durable audit log record.

Only confirmed physical samples can advance to downstream preparation, drying, and analytical queues. Submissions remaining in `EXPECTED` status cannot enter laboratory testing pipelines.

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

| Status | Meaning | Operational Gate / Next Actor |
|--------|---------|-------------------------------|
| `EXPECTED` | Registered in field via KoboToolbox, consignment in transit; not yet physically received at lab (`receptionDate: null`) | Reception staff confirm physical delivery |
| `RECEIVED` | Physically arrived at the laboratory; intake inspection and verification in progress | Reception staff validate and assign Lab ID |
| `ACCEPTED` | Intake validated, official Laboratory ID assigned, ready for preparation and testing | Lab Technician (drying, prep & analytical work) |
| `PROCESSING` | Sample preparation/drying completed; analytical testing actively in progress | Lab Technician executes tests & logs results |
| `SUBMITTED_PARTIAL` / `SUBMITTED_FULL` | Analytical results recorded by technician, pending managerial review | Lab Manager (review & approval) |
| `APPROVED` | All required analytical results validated and approved by Lab Manager | Ready for reporting, export & client release |
| `RECEIVED_REJECTED` | Physical sample rejected at intake due to non-conformance (leakage, damage, insufficient volume) | Quarantined / disposed per standard operating procedure |
| `ARCHIVED` / `DISPOSED` | Sample retained in long-term archive or safely discarded after retention window | Final lifecycle disposition |

---

## Quality Control

Throughout the workflow, several quality measures are in place:

- **Separation of duties** — technicians enter results, managers approve them
- **Audit trail** — every action is logged (who, what, when)
- **QC batches** — group samples with reference materials and blanks for batch-level quality assessment
- **Range checks** — flag results that fall outside expected ranges
- **Spectral validation** — automatic quality checks on uploaded spectra
