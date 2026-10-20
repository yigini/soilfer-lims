# The Sample Workflow

This page gives you a start-to-finish map of how a soil sample moves through SoilFER-LIMS—from the moment it is collected in the field or brought to the front desk until the final report is issued and the sample is archived or disposed of.

---

## Visual Overview

```
 📱 1. Intake         🥣 2. Prep & Aliquots   🔬 3. Bench & QC       ✅ 4. Review           📄 5. Report & Custody
┌──────────────┐     ┌────────────────────┐  ┌─────────────────┐   ┌──────────────────┐   ┌────────────────────┐
│ Consignment, │     │ Drying (°C/time),  │  │ Analytical run, │   │ Compare attempts,│   │ Issue PDF report,  │
│ Kobo sync or │ ──► │ Sieving (coarse %),│ ─►│ blanks, dups,   │ ──►│ select reported  │ ──►│ track retention,   │
│ walk-in desk │     │ containers/aliquot │  │ LRMs, CRMs, CCV │   │ value & approve  │   │ archive or dispose │
└──────────────┘     └────────────────────┘  └─────────────────┘   └──────────────────┘   └────────────────────┘
 Reception Staff       Lab Technician          Lab Technician        Lab Manager /          Lab Manager /
                       (Preparation)           (Workbench)           Reviewer               Data Exchange
```

---

## Stage 1: Field Collection & Sample Reception

Samples can enter your laboratory in three ways:
1. **KoboToolbox Field Sync**: Field teams submit mobile survey forms with GPS coordinates, sampling depth, soil profile reference, and bag photos. Synchronized records appear in Reception as `EXPECTED` (in transit, `receptionDate: null`).
2. **Consignments & Batch Manifests**: Boxes of samples arrive with a shipment manifest and an optional **Declared Expected Count**.
3. **Walk-In Clients**: Farmers, researchers, or extension workers bring samples directly to the reception counter.

### At the Reception Desk (`/reception`)
- **What you see**: The **Expected Arrivals** queue and the **Walk-In / Batch Intake** forms.
- **What you do**:
  1. Physically inspect each bag (container intact, label readable, enough soil, no leakage).
  2. Confirm **Physical Arrival** (`RECEIVED`, logging an automatic `RECEIVED` custody event) and then **Accept** (`ACCEPTED`) the sample—or place it **On Hold (`ON_HOLD`)** if paperwork/provenance needs clarification, or **Reject (`RECEIVED_REJECTED`)** if damaged.
  3. Print **Standard (`101 × 54 mm`)** or **Compact (`50 × 25 mm`)** QR + Code128 barcode labels carrying the issued **Laboratory Sample Code** (with its ISO 7064 check character) and assign work items to technicians.
- **What happens next**: Accepted samples receive their unique Laboratory Sample Code, an active **Order Revision**, and a set of **Work Items** for preparation and analysis.

👉 *Full step-by-step guide:* [Sample Reception, Intake, Labels & Assignment](./reception-and-intake.md) and [KoboToolbox Integration](./kobotoolbox.md).

---

## Stage 2: Drying, Preparation & Sub-Sampling (Aliquots)

Before chemical or spectral testing can begin, the sample must pass your laboratory's **operational prerequisite gates**.

- **What you see**: Assigned `DRYING` and `PREPARATION` tasks in the Technician Workbench. Analytical test rows stay locked until these gates are confirmed.
- **What you do**:
  1. Record the **Structured Drying Record** (method: `AIR`, `OVEN_40`, `OVEN_105`, or `OTHER`; temperature in °C; start/end times; optional oven asset and masses) and click **Confirm Complete**.
  2. Record the **Structured Preparation Record** for your lab's active steps—such as **Sieving** (sieve mesh in mm, mass before sieving, and coarse fraction/stones mass in `g`, which automatically calculates coarse fraction %), **Grinding** (fineness in mm), or **Splitting**.
  3. Optionally create child **Containers & Aliquots** (`BULK` → Fine Earth → Ground → `ALIQUOT`) and print container barcode labels.
- **What happens next**: The sample automatically advances from `ACCEPTED` to `PROCESSING`, unlocking all assigned analytical tests.

👉 *Full step-by-step guide:* [Sample Preparation, Containers, Storage & Custody](./preparation-and-custody.md).

---

## Stage 3: Bench Analysis & Quality Control Runs

Technicians perform tests inside an **Analytical Batch (Run)** in the **Technician Workbench** (`/workbench`).

- **What you see**: A run-first worksheet with a **Run Header** (method, instrument, analyst, calibration curve if applicable) and a keyboard- and barcode-friendly **Run Grid** containing both routine samples and **QC Positions** (Method Blanks, Analytical Duplicates, Laboratory Reference Materials / check soils, CRMs, and ICV/CCV/CCB checks for instrumental methods).
- **What you do**:
  1. Create or open a run for your method and select an eligible, calibrated instrument (`IN_SERVICE`).
  2. Scan sample barcodes or navigate the grid with the keyboard (`Enter` / arrow keys), or print a **Run Worksheet PDF** to take to the bench.
  3. Enter raw observations (using server-side calculation templates for titrations, dilutions, moisture, or stoichiometry) or import instrument CSV files (ICP-OES, AAS, UV-Vis), along with the batch's QC measurements.
  4. If an instrument fault, preparation error, above-range dilution, or typing mistake happens **before submission**, record a technician repeat or transcription correction with a reason code.
  5. Click **Record / Submit for Review** (entering your bench PIN if shared bench terminal lock is enabled in your lab's policy).
- **What happens next**: SoilFER-LIMS creates a numbered **Work Attempt** (`attemptNo = 1, 2, ...`) for each test, evaluates the batch's QC rules per analyte (`QC_PASS`, warning, or `QC_FAIL`), and sends submitted results to the Manager Review Queue.

👉 *Full step-by-step guide:* [Quality Control & Batch Management](./qc-management.md).

---

## Stage 4: Manager Review, Repeats & Approval

Technicians can enter and submit results, but **only a Lab Manager (or authorized reviewer) can approve them**.

- **What you see**: In the **Manager Review Queue** (`/manager-queue`), you see submitted work items alongside their batch QC verdict, cross-parameter plausibility checks (for example, texture sum of fractions, sum of bases vs. CEC, organic carbon vs. nitrogen, EC vs. soluble salts), and a side-by-side table of all **Work Attempts** if a test was repeated.
- **What you do**:
  1. Check that the analytical batch passed QC (or apply a documented manager batch disposition if permitted by your laboratory's policy).
  2. If a test has multiple attempts or replicates, explicitly choose the **Reported Value Selection**:
     - Pick a specific valid attempt (`ATTEMPT`),
     - Report the **Mean** of agreeing attempts (`MEAN`, allowed when their spread is within the method's repeatability limit $r$),
     - Use a **Derived** calculated value (`DERIVED`), or
     - Mark the test **Not Reportable / Waive** (`NOT_REPORTABLE`) with a mandatory reason.
  3. Approve (`APPROVE`) valid results, or **Return / Request Repeat** with a structured **Repeat Reason Code** (`QC_BATCH_FAIL`, `REVIEW_OUTLIER`, `DUPLICATE_DISAGREEMENT`, `ABOVE_RANGE_DILUTION`, `INSTRUMENT_FAULT`, `PREP_ERROR`, `TRANSCRIPTION_ERROR`, `CONFIRMATION`).
- **What happens next**: When every required work item on a sample is approved (or waived with a reason), the sample moves to `APPROVED`.

---

## Stage 5: Reporting, Amendments, Data Exchange & Retention

Once a sample is `APPROVED`, its results are ready for official reporting and external data exchange.

- **Certificates of Analysis (PDF)**: Generate an official PDF report aligned with ISO/IEC 17025 §7.8 showing sample provenance, structured drying/preparation records, moisture basis (`AIR_DRY` or converted `OVEN_DRY`), the selected reported values, truthful QC statements, agronomic ratings, and a public QR verification link.
- **Post-Report Amendments (`Rev 1`, `Rev 2`, ...)**: Once a sample is approved or reported, results are locked. If a client retest (`CLIENT_RETEST`) or correction is ever needed after approval, a manager opens a formal **Sample Amendment** (which requires a second authoriser when your lab policy enables `report.amendmentRequiresSecondPerson`). Issuing the amended report creates a new revision (`Rev 1`, `Rev 2`) and automatically revokes public share links to the superseded version (`HTTP 410 Gone`).
- **Exports & National SIS Exchange**: Excel/CSV exports and the Data Exchange API v2 publish **only** the explicitly selected reported value for `APPROVED` samples.
- **Retention & Disposal**: Publishing the report starts the sample's retention countdown (`sample.retentionDaysAfterReport`). After `retainUntil`, samples with no open holds or amendments appear in the **Disposal Queue** for archival (`ARCHIVED`) or safe disposal (`DISPOSED`).

👉 *Full step-by-step guide:* [Certificate of Analysis & PDF Reports](./reporting-pdf.md).

---

## Sample Status Lifecycle Reference

| Sample Status | Plain-Language Meaning | Who Acts Next |
| :--- | :--- | :--- |
| `EXPECTED` | Pre-registered from KoboToolbox or manifest; bag has **not** physically arrived (`receptionDate: null`). | **Reception**: Verify physical bag upon arrival. |
| `RECEIVED` | Physical arrival logged at the reception desk (`RECEIVED` custody event recorded); intake inspection in progress. | **Reception**: Complete inspection and accept or reject. |
| `ACCEPTED` | Intake accepted, permanent Lab Sample Code issued, preparation and analytical work items created. | **Technician**: Complete `DRYING` and `PREPARATION` gates. |
| `ON_HOLD` | Temporarily frozen due to a provenance discrepancy, Kobo replay conflict, or manual hold. Remembers its prior status. | **Lab Manager**: Investigate and resolve the hold with a reason. |
| `PROCESSING` | Drying and preparation gates completed; sample is actively in bench analysis. | **Technician**: Run tests in the Workbench and submit results. |
| `SUBMITTED_PARTIAL` | Some (but not all) analytical work items have been submitted for review. | **Technician** (remaining tests) & **Lab Manager** (review). |
| `SUBMITTED_FULL` | All required analytical work items have been submitted and are awaiting review. | **Lab Manager**: Review QC, select reported values, and approve. |
| `APPROVED` | All required work items are approved (or waived). Results are locked against direct edits. | **Lab Manager**: Issue PDF report; **Amendment** required for any post-approval change. |
| `RECEIVED_REJECTED` | Sample rejected at intake due to damage, leakage, or insufficient material. | **Lab Manager / Reception**: Dispose of rejected material with reason. |
| `ARCHIVED` | Sample moved to long-term archive storage after completion. | Retained in controlled archive location. |
| `DISPOSED` | Physical soil material safely discarded after retention period expired (all digital records remain). | Lifecycle complete. |

---

## Work Item Status Lifecycle Reference

Each individual gate (`DRYING`, `PREPARATION`) or test (`pH`, `SOC`, `P`, etc.) on a sample has its own **Work Item** status:

| Work Item Status | Plain-Language Meaning |
| :--- | :--- |
| `NOT_ASSIGNED` | Created at intake; not yet assigned to a specific technician. |
| `ASSIGNED` | Assigned to a technician and waiting in their Workbench queue. |
| `IN_PROGRESS` | Technician has started working on the item or opened an analytical attempt. |
| `AWAITING_VERIFICATION` | Operational gate completed by technician and waiting for second-person verification (when `gate.verificationRequired` is enabled). |
| `COMPLETED` | Operational gate confirmed complete, or analytical measurement recorded and ready for submission. |
| `SUBMITTED` | Submitted by the technician and waiting in the Manager Review Queue. |
| `APPROVED` | Reviewed and approved by the Lab Manager with an explicit reported-value selection. |
| `REPEAT_REQUIRED` | Returned for re-analysis in a new batch (due to QC batch failure, CCV bracket failure, duplicate disagreement, or reviewer return). *(Legacy read alias: `REANALYSIS_REQUIRED`)* |
| `ON_HOLD` | Paused while the parent sample has an active hold. |
| `WAIVED` | Explicitly marked *Not Reportable / Waived* by a manager with a recorded reason. |
| `CANCELLED` | Cancelled because intake was undone (`INTAKE_UNDONE`), sample was rejected at intake (`INTAKE_REJECTED`), or analysis was removed via an Order Revision before work started. |
