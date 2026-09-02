# Quality Control & Batch Management

SoilFER-LIMS complies with **ISO/IEC 17025** and **GLOSOLAN Quality Assurance / Quality Control (QA/QC)** guidelines for soil laboratory testing.

---

## 🎯 QC Sample Types & Acceptance Criteria

Analytical batches in SoilFER-LIMS group routine sample determinations with three essential typed quality control samples:

### 1. Method Blanks (Reagent Blanks)
- **Purpose**: Verify that reagents, glassware, and analytical instruments are free from contamination and baseline drift.
- **Acceptance Rule**: Measured value must not exceed the maximum allowed background limit:
  $$|\text{Measured Value}| \le \text{Max Allowed Threshold (Default } \le 0.05\text{)}$$
- **Status Outcome**: Evaluated automatically as `PASS` or `FAIL`.

### 2. Analytical Duplicates (Laboratory Replicates)
- **Purpose**: Evaluate analytical repeatability and precision within the laboratory.
- **Acceptance Rule**: Calculates the **Relative Percent Difference (RPD)** between duplicate measurements:
  $$\text{RPD} = \frac{|V_1 - V_2|}{(V_1 + V_2) / 2} \times 100\%$$
- **Threshold**: Acceptance limit is typically $\text{RPD} \le 10.0\%$ (or customized per procedure).
- **Status Outcome**: If $\text{RPD} \le \text{Max RPD} \rightarrow \text{PASS}$; otherwise $\text{FAIL}$.

### 3. Certified Reference Materials (CRMs) / Standard Controls
- **Purpose**: Assess the trueness, accuracy, and calibration drift of the analytical method.
- **Acceptance Rule**: Compares the measured concentration against the certified reference value to calculate **Recovery %**:
  $$\text{Recovery \%} = \frac{\text{Measured Concentration}}{\text{Certified Reference Value}} \times 100\%$$
- **Threshold**: Standard acceptable recovery window is $90.0\% \le \text{Recovery} \le 110.0\%$.
- **Status Outcome**: If within the recovery range $\rightarrow \text{PASS}$; otherwise $\text{FAIL}$.

---

## 🔄 Automated Batch Lifecycle & State Machine

```
   ┌────────┐
   │  OPEN  │ ── (Add Work Items & Instruments)
   └───┬────┘
       │
       ▼
   ┌─────────┐
   │ RUNNING │ ── (Enter QC Measurements: Blanks, Duplicates, CRMs)
   └───┬─────┘
       │
       ├──► All QC criteria met ──────────► ┌─────────┐
       │                                   │ QC_PASS │ (Allowed for Manager Acceptance)
       │                                   └─────────┘
       │
       └──► Any QC criteria out-of-spec ──► ┌─────────┐
                                           │ QC_FAIL │ (Blocks Manager Acceptance)
                                           └────┬────┘
                                                │
                                                ▼ (Managerial Override)
                                           ┌──────────────────────┐
                                           │ PROCEED_WITH_WARNING │
                                           │   REANALYZE_BATCH    │
                                           │     REJECT_BATCH     │
                                           └──────────────────────┘
```

---

## 🛡️ Downstream Quality Gate Enforcement

1. **Submission Review Blocking**: When a technician submits analytical results tied to a batch, the submission review endpoint checks the batch status.
2. **Conflict Prevention (HTTP 409)**: If any sample belongs to a batch in `QC_FAIL` status and no approved manager disposition exists, the system strictly blocks acceptance (`HTTP 409 Conflict`).
3. **Managerial Disposition Override**:
   - Laboratory Managers or Super Administrators can review batch anomalies and apply an official disposition (`POST /api/qc/batches/:id/disposition`).
   - If a manager selects `PROCEED_WITH_WARNING` with an audit trail rationale (e.g. *"Duplicate variance acceptable due to high organic soil matrix heterogeneity"*), downstream sample approval is enabled with full traceability.
