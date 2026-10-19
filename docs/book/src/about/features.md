# Features Overview

SoilFER LIMS includes everything a soil testing laboratory needs to operate digitally—from sample arrival at the reception desk to ISO/IEC 17025 quality control, PDF Certificates of Analysis, and national database exchange.

---

## 1. Sample Intake, Barcoding & Chain of Custody

Track every physical soil bag and sub-sample container from the field to archive disposal:
- **Three Intake Paths**: Register multi-sample **Consignments** (`CSG-...`), quick **Walk-In Samples**, or expected arrivals synced from **KoboToolbox** mobile surveys.
- **Physical Arrival Inspection**: Record arrival condition, gross weight ($g$), moisture state, and any reception deviations (`INSUFFICIENT_MASS`, `DAMAGED_PACKAGE`, `Wet/Unsealed`) with reject or caveat-override workflows.
- **Blind Lab Coding & Container Barcodes**: Automatically generate sequential Laboratory Sample Codes (`{LAB}-{YY}-{SEQ:6}{CHK}`) and Sub-Sample Container barcodes (`C-{LAB}-{YY}-{SEQ:6}{CHK}`) for $2\text{ mm}$ archive jars and $< 100\ \mu\text{m}$ spectroscopy vials.
- **Pre-Analytical Preparation Gates**: Enforce air-drying ($< 40^\circ\text{C}$, `DRYING`) and crushing/sieving (`PREPARATION`) before analytical bench work items unlock.
- **Storage, Custody & Retention**: Track rack/shelf locations, custody transfers, and post-report retention countdowns (`sample.retentionDaysAfterReport`).

---

## 2. Technician Workbench, Shared Bench Terminals & Analytical Runs

Purpose-built for wet-chemistry analysts and instrument operators:
- **Structured Analytical Runs (`RunBatch`)**: Organize work items into batches with visual rack/microplate layouts (`MICROPLATE_96`, `CENTRIFUGE_24`, `RACK_40`), linked reagent lots, and verified instruments.
- **Formula-Backed Worksheets**: Enter raw weights, extraction volumes, dilution factors, and instrument readings (pH, EC, Walkley–Black titration, Kjeldahl N, Olsen/Bray/Mehlich P, AAS/ICP cations, Hydrometer/Pipette texture, gravimetric moisture) while the LIMS computes final concentrations automatically.
- **Shared Bench Terminals**: Support shared tablets and balance PCs in the wet lab with configurable idle auto-lock (`bench.idleLockMinutes`) and per-action **4–6 digit operator PIN** attribution (`bench.pinAtRecord`).
- **Append-Only Analytical Attempts (`R1`, `R2`, ...)**: Every repeat creates a numbered attempt without overwriting earlier measurements, with automatic Non-Conformance Report (`NCR`) prompts when attempts exceed `repeats.maxAttemptsBeforeNcr`.

---

## 3. Configurable Quality Control, Control Charts & Proficiency Testing

Because SoilFER LIMS is used by many independent laboratories, **all QC frequencies, limits, and enforcement modes are configurable per laboratory and per method**:
- **Three Built-In Lab Presets**: Start with **`ISO17025_STRICT`**, **`BASIC`**, or **`ADVISORY`** and customize any individual rule in **Settings → Laboratory Policy** or per-method **`QcRule`** overrides.
- **Complete Batch & Instrument QC**:
  - **Method Blanks (`BLANK`)**: Evaluated against absolute limits, `< LOQ`, or `< 0.5 × LOQ`, plus rolling blank history for empirical LOD ($3s$) and LOQ ($10s$) estimation.
  - **Analytical Duplicates (`DUPLICATE`)**: Evaluated by Relative Percent Difference (`RPD %`) above $5 \times \text{LOQ}$ and absolute difference near the LOQ.
  - **In-House Controls (`LRM`) & Certified Reference Materials (`CRM`)**: Evaluated by recovery % or certified uncertainty windows against registered reference material lots.
  - **Calibration Verification (`ICV`, `ICB`, `CCV`, `CCB`)**: Checks linear regression correlation ($r$), minimum calibration standards, and mid-run drift with configurable `FAIL_BATCH` or **`REPEAT_BRACKET`** actions.
- **Shewhart Control Charts & Westgard Rules**: Plot historical LRM/CRM measurements against approved $\bar{x} \pm 2s / 3s$ limits with configurable Westgard rules (`1-3s`, `2-2s`, `R-4s`, `1-2s`, `4-1s`, `10x`).
- **Equipment Readiness & Proficiency Testing (PT)**: Block or warn when a `CRITICAL` or `IMPORTANT` instrument has an overdue calibration or open fault, and track external PT rounds (such as GLOSOLAN PT) with automatic $|z|$-score evaluation and CAPA tracking.

---

## 4. Two-Stage Technical Review & Soil Plausibility Checks

- **Stage 1 (Batch/Method Review)**: Verify calibration curves, QC pass/warn/fail badges, and replicate agreement ($r$) across an analytical run.
- **Stage 2 (Whole-Sample Approval)**: Inspect all parameters on a sample side by side with automated soil chemistry cross-checks:
  - Sum of Exchangeable Bases vs. CEC ($\sum \text{Bases} \le 1.1 \times \text{CEC}$) and Base Saturation ($\le 100\%$)
  - Particle-Size Texture Closure ($\text{Sand} + \text{Silt} + \text{Clay} = 100\% \pm 2\%$)
  - Organic Carbon to Total Nitrogen ($\text{C:N}$) ratio ($8\text{--}25$)
  - Carbonate presence vs. low pH, $\text{EC}_{1:2.5}$ vs. $\text{EC}_e$, and Available P vs. Total P
- **Saved Reported Value Selection**: Locks the official reported value (`MEAN_IF_WITHIN_R`, `LATEST_VALID`, or `REVIEWER_PICKS`) and enforces independent second-person review (`review.secondPersonRequired`).

---

## 5. Certificates of Analysis (PDF), Revisions & Amendments

- **Server-Side Vector PDF Reports**: Generates official Certificates of Analysis showing actual recorded drying/preparation conditions, explicit **`AIR_DRY` vs. `OVEN_DRY`** moisture basis, saved Reported Values, optional expanded measurement uncertainty ($U$), truthful QC/caveat disclosures, and a scannable **QR Verification Code**.
- **ISO/IEC 17025 §7.8.8 Amendments & Revisions**:
  - Supports post-report **Clerical** and **Scientific** amendments (with second-person authorization when `report.amendmentRequiresSecondPerson = true`).
  - Opening a scientific amendment immediately marks the existing report **`WITHDRAWN`** and replaces the public QR download with a plain-text withdrawal notice.
  - Issuing the corrected **Report Revision (`Rev 2+`)** prints the official replacement banner and marks changed (`†`), added (`‡`), and removed results.

---

## 6. Spectral Library (MIR & Vis-NIR) & National Data Exchange (API v2)

- **Infrared Spectroscopy**: Upload CSV or native Bruker OPUS scans for **MIR** ($4000\text{--}400\text{ cm}^{-1}$) and **Vis-NIR** ($350\text{--}2500\text{ nm}$), validate signal quality, overlay replicates, and pair spectra with wet-chemistry reference measurements.
- **NSIS / OpenNSIS Data Exchange Gateway**:
  - **API v1 & CSV/Excel Exports**: Export the official saved Reported Value per sample and parameter.
  - **API v2 (`/api/v2/data-exchange`)**: Lossless observation export preserving all replicates, decimal depths, Soil Profile References (`{namespace}:{code}`), RFC 7946 GeoJSON, resumable 24-hour **Snapshots**, monotonic **Change Feeds**, and **Delivery Receipts**.
- **Multilingual & Accessible**: Full interface and PDF reporting support in **English (`en`)**, **French (`fr`)**, **Spanish (`es` & `es-419`)**, and **Portuguese (`pt`)**, with light and dark themes.
