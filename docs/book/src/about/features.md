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

## 📜 Publication-Grade Certificates & PDF Reports

Generate structured **Certificates of Analysis (COA)** aligned with laboratory SOPs and soil testing guidelines.

**What you can do:**
- **Server-Side PDF Rendering**: Built on PDFKit for fast, container-friendly rendering without headless browsers.
- **Complete Provenance & Quality Gates**: 2-column metadata grid showing sampling coordinates, depths (D1/D2), reception date, and preparation gate checks (Drying $<40^\circ\text{C}$, 2mm sieving).
- **Categorized Results with FAO Ratings**: Displays analytical parameters with standardized units, method references, and FAO 5-tier agronomic classification badges.
- **Derived Diagnostics & Approvals**: Derives USDA texture triangle class, C:N stoichiometry, and includes Lab Manager electronic approval record.
- **Secure Public Verification Tokens**: Share certificates via secure token links (`/api/reports/public/:token/pdf`) without requiring login.

---

## 🌿 FAO Agronomic Interpretation Engine & Soil Metrology

Transform raw analytical numbers into actionable agronomic insights.

**What you can do:**
- **Controlled Unit Standardization**: Automatic conversion of `%`, `ppm`, `meq/100g`, `g/kg`, `mg/kg`, `cmol(+)/kg`, `dS/m`, and `µS/cm`.
- **FAO 5-Tier Ratings**: Classifies parameters into `VERY_LOW`, `LOW`, `OPTIMAL`, `HIGH`, and `VERY_HIGH` with tailored agronomic advisory text.
- **USDA 12-Class Texture Derivation**: Computes textural triangle classes with 100% closure error validation ($\pm 2.0\%$).
- **Stoichiometry & Cation Balance**: Evaluates C:N organic matter equilibrium, Base Saturation %, Ca:Mg ($<2.0$) and Mg:K ($<1.0$) balance alerts, and SAR/ESP sodicity hazards.

---

## 🛡️ ISO/IEC 17025 Typed Quality Control & Batch Disposition

Enforce rigorous analytical quality assurance across every testing run.

**What you can do:**
- **Typed QC Control Types**:
  - **Method Blanks**: Automatic evaluation against baseline contamination limits ($\le 0.05$).
  - **Analytical Duplicates**: Relative Percent Difference precision checks ($\text{RPD} \le 10.0\%$).
  - **Certified Reference Materials (CRMs)**: Standard recovery window evaluation ($90.0\% \le \text{Recovery} \le 110.0\%$).
- **Automated Batch Evaluation**: Transitions batch to `QC_PASS` or `QC_FAIL` automatically.
- **Managerial Quality Gate Overrides**: Blocks unapproved acceptance of failed batch items; supports `PROCEED_WITH_WARNING` with audit trail justification.

---

## 🔧 Equipment & Inventory Modules

Track all laboratory instruments, calibrations, and consumables in one place.

**What you can do:**
- Register instruments with model, serial number, manufacturer, and location.
- Set calibration schedules and receive alerts when calibration is due.
- Record maintenance activities with dates, costs, and notes.
- Manage reagents, minimum stock thresholds, lot numbers, and supplier catalogs.

---

## 📝 Audit Trail

Every action in the system is logged — who did what, when, and to which record.

This is critical for:
- **Accreditation** — auditors can verify that processes were followed correctly
- **Accountability** — if a result is questioned, you can trace exactly who entered, reviewed, and approved it
- **Debugging** — if something goes wrong, you can see exactly what happened

---

## 📦 Historical Analysis Data Ingestion

For soil laboratories with historical soil datasets analyzed prior to SoilFER LIMS rollout:

**What you can do:**
- **Legacy CSV Ingestion**: Ingest historical sample datasets through the Admin Panel CSV ingestion engine (`/admin/legacy-import`).
- **Controlled Mapping & Validation**: Map legacy columns to canonical catalogue analyses, validated laboratory methods, and controlled measurement units with pre-import validation.
- **Audit Trail Traceability**: Ingested determinations are stored with sample provenance and recorded in the audit trail for reporting and statistics.

---

## 🌐 National SIS Interoperability & Machine-to-Machine APIs

Connect laboratory data directly with national Soil Information Systems (SIS) and international FAO repositories.

**What you can do:**
- **RFC 7946 GeoJSON & GloSIS Schemas**: Standardized geospatial exchange format containing field metadata, depth horizons, and categorized analytical findings.
- **Secure API Key Token Authorization**: Issue scoped, revocable machine-to-machine API keys with expiration management.
- **RESTful Neutral Endpoints**: Access analytics and statistics through standard, automated endpoints.

---

## 🌙 Dark Mode

Full dark/light theme support. Because lab technicians entering data at the end of a long day deserve gentle lighting.

---

## 🌐 Multi-Language Support

The interface is available in:
- 🇬🇧 English
- 🇫🇷 Français (French)
- 🇪🇸 Español (Spanish & Latin American Spanish)
- 🇵🇹 Português (Portuguese)

Users can switch languages from any page or their profile settings. The system remembers their preference.
