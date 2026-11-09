# Spectral Data Management (MIR & Vis-NIR)

> *Time:* 10 minutes
> *Who can do this:* Spectroscopy Technicians, Laboratory Managers, and Quality & Audit Officers

For laboratories that run infrared soil spectroscopy—Mid-Infrared (**MIR**, 4000 to 400 inverse centimetres) or Visible–Near-Infrared (**NIR**, 350 to 2500 nanometres)—SoilFER LIMS provides **Spectral Library** (**Spectral Library & Proximal Sensing**). You can upload, validate, review, and export spectral curves alongside wet-chemistry reference measurements.

> [!TIP]
> *GLOSOLAN Spectroscopy Resources:* Visit the [FAO GLOSOLAN Soil Spectroscopy Portal](https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/soil-spectroscopy) for standard operating procedures on fine ball-milling, background reference checks, and spectral calibration.

---

## 1. How Spectroscopy Fits into Your Laboratory Workflow

1. *Pair spectra with wet chemistry:* Link **MIR** or **NIR** scans to the same physical soil sample that has approved wet-chemistry results (such as organic carbon, total nitrogen, pH, clay, or cation exchange capacity).
2. *Check replicate scans:* Upload single or replicate sub-sample scans. The system verifies wavenumber range, signal bounds, and duplicate file fingerprints before review.
3. *Share calibrated matrices:* Export approved curves using **Export Spectral Matrix** or through **National SIS & Data Exchange** (**Lossless Spectroscopy Dataset (MIR/NIR)**).

---

## 2. Sample Preparation for Spectroscopy

Because particle size and residual moisture strongly affect infrared absorption, always record how the soil was prepared before scanning:

| Preparation Type | Physical Preparation | Typical Modality |
| :--- | :--- | :--- |
| *Air-dried 2 mm fine earth* | Air-dried below 40 °C and sieved to pass 2 mm | Routine **NIR** (350–2500 nm) |
| *Finely ground (agate / ball mill)* | Sub-sampled from 2 mm fine earth and finely ground to pass 100 micrometres | Routine **MIR** diffuse reflectance (4000–400 inverse cm) |
| *Pressed KBr pellet* | Finely ground soil diluted in potassium bromide pellet | Transmission **MIR** |
| *Intact core or aggregate* | Unprocessed soil aggregate or core | Specialized **NIR** scanning |

---

## 3. Upload and Validate Spectral Files

### Steps

1. Click **Spectral Library** in the left sidebar (or open a spectroscopy batch in **Workbench**).
2. Click **Upload Spectra** (or **Batch Upload OPUS/CSV**).
3. Select the spectrometer under **Calibrated Spectrometers** (**Instrument**). Confirm that its status in **Equipment** is **In Service** and **Ready / Calibrated**.
4. Drag and drop your spectrometer files into **Drag and drop raw spectrometer files (.0, .csv, .dpt) or click to browse**.
5. Match each scan to its sample code and replicate number, then upload.
6. For step-by-step bench instructions, see [Technician: Workbench & Analytical Runs](./technician-workbench.md).

---

## 4. Review and Approve Spectral Curves

1. In **Spectral Library**, use **Library Explorer** to filter by modality (**All Modalities**, **MIR**, or **NIR**) and workflow status (**All Workflow Status**, **Pending QC**, **Awaiting Review**, **Approved**, or **Rejected**).
2. Open a scan to inspect **Wavenumber (cm⁻¹) / Wavelength (nm)** against **Absorbance / Reflectance**. Toggle **Baseline Correction** or **Continuum Removal** for visual inspection, and check that replicate curves overlay cleanly without baseline shift.
3. Verify the quality badge (**✓ All quality checks passed**) alongside **Instrument**, **Scan Date**, and **Operator**.
4. Approve valid spectra so they become **Approved** in **Total Spectra Curves**. If a scan is noisy, reject it so the technician can re-pack the cup and re-scan.

---

## Related Tasks

- [Technician: Workbench & Analytical Runs](./technician-workbench.md)
- [Register Instruments, Log Calibrations, and Track Reagent Stock](../admin/register-equipment-and-inventory.md)
- [Data Exchange, NSIS / OpenNSIS & API v2](./data-exchange.md)

---

### For the QA Person

- *Automated spectral quality checks:* Every uploaded file is checked for duplicate file fingerprints, wavenumber or wavelength coverage, signal saturation or negative reflectance, and baseline anomalies before entering **Awaiting Review**.
- *Traceable metadata:* Approved spectra retain their linked **Instrument**, **Operator**, **Scan Date**, **Reviewed By**, preparation state, and paired wet-chemistry sample lineage.
