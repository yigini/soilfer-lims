# Features Overview

SoilFER-LIMS includes everything a soil laboratory needs to operate digitally. Here is a detailed look at each major feature.

---

## 📋 Sample Lifecycle Management

The central feature of any LIMS. Track every soil sample from the moment it's collected in the field until the final report is delivered to the client.

**What you can do:**
- Register new samples (manually or automatically from KoboToolbox)
- Assign unique laboratory IDs
- Track the sample's status at every stage (received → in analysis → pending review → approved → reported)
- View the complete history of a sample — who handled it, what tests were performed, when results were entered
- Search and filter samples by project, date, status, location, or any other property

**Why it matters:** Paper-based systems make it nearly impossible to answer the question "Where exactly is this sample in the process?" With SoilFER-LIMS, the answer is always just a search away.

---

## 📱 KoboToolbox Field Data Sync

**[KoboToolbox](https://www.kobotoolbox.org/)** is a free, open-source tool for mobile data collection, widely used by the UN, NGOs, and government agencies. SoilFER-LIMS integrates directly with it.

**How it works:**
1. A field worker opens the KoboToolbox app on their phone
2. They fill in sample details (GPS location, soil depth, field observations, photos)
3. They submit the form (works even offline — data syncs when back online)
4. SoilFER-LIMS automatically pulls the submission at the next sync interval
5. The sample appears in the Reception queue, pre-filled with all field data

**What you can do:**
- Connect multiple KoboToolbox forms to different projects
- Set automatic sync intervals (every 15 minutes, hourly, or manual)
- Review synced data and match it to physical samples arriving at the lab
- View field photos and GPS coordinates on the 3D map

**External help:**
- [KoboToolbox documentation](https://support.kobotoolbox.org/)
- [KoboToolbox sign-up](https://www.kobotoolbox.org/) (free for humanitarian and research use)

---

## 🔬 Spectral Data Management

For laboratories that perform **infrared spectroscopy** (MIR — Mid-Infrared, or NIR — Near-Infrared), SoilFER-LIMS includes a full spectral data management module.

Soil spectroscopy is a fast, cost-effective method for estimating soil properties. Instead of wet chemistry (which uses reagents and takes hours), a spectrometer can scan a soil sample in seconds and predict its properties using mathematical models.

**What you can do:**
- Upload spectral files (CSV or OPUS format)
- Automatic validation (wavelength range checks, duplicate detection, quality flags)
- Link spectra to existing samples by lab ID
- Visualize spectral curves
- Review and approve spectra through the same workflow as wet chemistry results

**External help:**
- [GLOSOLAN spectroscopy resources](https://www.fao.org/global-soil-partnership/glosolan/soil-analysis/soil-spectroscopy)
- [What is soil spectroscopy? (ICRAF)](https://www.worldagroforestry.org/sd/landhealth/soil-plant-spectral-diagnostics-laboratory)

---

## 🌍 3D Field Maps

Visualize your sampling sites on an interactive globe using **CesiumJS** — the same technology used by NASA and USGS for geospatial visualization.

**What you can do:**
- View all sampling locations on a 3D globe with satellite imagery
- Click on markers to see sample details, field photos, and analysis status
- Filter map pins by project, analysis status, or date range
- Full 360° field audit photo gallery for each sampling site

---

## 👥 Multi-Laboratory Support (Global Mode)

For organizations managing multiple soil laboratories, Global mode provides complete data isolation and centralized management.

**What you can do:**
- Create and manage multiple laboratories from a single system
- Assign a Lab Manager to each lab who independently manages their own staff, projects, and analyses
- View system-wide statistics while respecting data isolation
- Transfer samples between laboratories if needed

---

## 🔐 Role-Based Access Control (RBAC)

Not everyone in a lab should have access to everything. RBAC ensures people only see what they need.

| Role | What They Can Do |
|------|-----------------|
| **Super Admin** | Full system access: create labs, manage all users, see everything. Only in Global mode. |
| **Lab Manager** | Run their laboratory: create users, assign work, review and approve results, configure settings |
| **Lab Technician** | Perform assigned analyses, enter results, submit for review |
| **Sample Reception** | Receive physical samples, assign lab IDs, manage the intake queue |
| **Project Manager** | View project data and export reports (read-only access) |

---

## 📊 Data Export & Reporting

Get your data out of the system in the format you need.

**Export formats:**
- **Excel (.xlsx)** — formatted spreadsheets with headers and styling
- **CSV** — raw data for statistical analysis (R, Python, etc.)
- **PDF** — formatted reports suitable for clients or stakeholders

---

## 🔧 Equipment Module

Track all laboratory instruments in one place.

**What you can do:**
- Register instruments with model, serial number, manufacturer, and location
- Set calibration schedules and receive alerts when calibration is due
- Record maintenance activities with dates, costs, and notes
- Mark equipment as eligible or ineligible for use (ineligible instruments get flagged in analysis records)

---

## 📦 Inventory Module

Manage reagents, chemicals, and consumables used in the lab.

**What you can do:**
- Create an item catalog with categories, units, and suppliers
- Track stock levels and record additions (purchases) and usage
- Set minimum stock thresholds and receive alerts when stock is low
- Track lot numbers for traceability

---

## ✅ QC Batches

Organize analytical work into quality-controlled batches.

**What you can do:**
- Group samples into analytical batches for a specific test
- Include quality control samples (reference materials, blanks, duplicates)
- Review batch results together before individual approval
- Flag outliers and non-conforming results

---

## 📝 Audit Trail

Every action in the system is logged — who did what, when, and to which record.

This is critical for:
- **Accreditation** — auditors can verify that processes were followed correctly
- **Accountability** — if a result is questioned, you can trace exactly who entered, reviewed, and approved it
- **Debugging** — if something goes wrong, you can see exactly what happened

---

## 🌙 Dark Mode

Full dark/light theme support. Because lab technicians entering data at the end of a long day deserve gentle lighting.

---

## 🌐 Multi-Language Support

The interface is available in:
- 🇬🇧 English
- 🇫🇷 Français (French)
- 🇪🇸 Español (Spanish)
- 🇵🇹 Português (Portuguese)

Users can switch languages from their profile settings. The system remembers their preference.
