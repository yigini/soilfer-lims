# Spectral Data Management

For laboratories that perform infrared spectroscopy — **MIR** (Mid-Infrared) or **NIR** (Near-Infrared) — SoilFER-LIMS includes a dedicated spectral data module.

---

## What Is Soil Spectroscopy?

Soil spectroscopy is a rapid, cost-effective technique for estimating soil properties. Instead of performing time-consuming wet chemistry analyses, a spectrometer shines infrared light at a soil sample and measures how the light is absorbed at different wavelengths. Mathematical models then predict soil properties (pH, carbon, nitrogen, clay content, etc.) from the spectral signature.

This is especially valuable for:
- **High-volume sampling campaigns** where wet chemistry for every sample is impractical
- **Rapid screening** to prioritize samples for full analysis
- **Building spectral libraries** for future predictions

> 📖 **GLOSOLAN spectroscopy resources:** [fao.org/global-soil-partnership/glosolan/soil-analysis/soil-spectroscopy](https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/soil-spectroscopy)

---

## Uploading Spectra

1. Go to **Spectral Library → Upload**
2. Select your files:
   - **CSV format** — wavelengths in columns, samples in rows
   - **OPUS format** — native Bruker spectrometer format
3. The system will:
   - Parse the file and extract individual spectra
   - Validate wavelength ranges (flag unexpected ranges)
   - Detect duplicates
   - Generate quality flags
4. Link spectra to existing samples by **Lab ID**

---

## Review Workflow

Spectral data follows the same review workflow as other analysis results:

```
Upload → PENDING → Validation → VALIDATED → Manager Review → APPROVED / REJECTED
```

A Lab Manager can review spectra from:
- **Spectral Library** page — for batch review of many spectra
- **Sample Details** page — for reviewing all data associated with one sample

---

## Equipment & Inventory

### Equipment Module

Track all laboratory instruments in one place:

- **Register instruments** — model, serial number, manufacturer, acquisition date, location
- **Calibration schedules** — set due dates, receive alerts when calibration is overdue
- **Maintenance logs** — record repairs, servicing, and costs
- **Eligibility status** — mark instruments as eligible or ineligible for use

### Inventory Module

Manage reagents, chemicals, and consumables:

- **Item catalog** — create entries with categories, units, and suppliers
- **Stock tracking** — record additions (purchases) and usage (withdrawals)
- **Minimum stock alerts** — get notified when stock falls below a threshold
- **Lot tracking** — record batch/lot numbers for traceability
