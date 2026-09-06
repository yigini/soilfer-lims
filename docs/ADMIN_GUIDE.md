<div align="center">

<img src="./assets/soilfer-logo.png" alt="SoilFER LIMS Logo" width="300" />

# 🔧 SoilFER-LIMS — Comprehensive Administration Guide

**Operational Reference for System Administrators & Laboratory Managers**  
*Aligned with FAO GLOSOLAN, ISO/IEC 17025, and GloSIS Standards*

[![Admin Reference](https://img.shields.io/badge/Guide-Administration-0284c7.svg)](#)
[![Security Hardened](https://img.shields.io/badge/Security-RBAC%20Enforced-emerald.svg)](#)
[![GloSIS Compatible](https://img.shields.io/badge/GloSIS-v1.0-green.svg)](https://github.com/glosis-ld/glosis)

</div>

---

## 📖 Table of Contents
1. [Introduction & First-Time Setup](#1-introduction--first-time-setup)
2. [Role-Based Access Control (RBAC) Matrix](#2-role-based-access-control-rbac-matrix)
3. [Laboratory Configuration & Multi-Tenancy](#3-laboratory-configuration--multi-tenancy)
4. [FAO GLOSOLAN Method Catalogue & Analytical Packages](#4-fao-glosolan-method-catalogue--analytical-packages)
5. [ISO/IEC 17025 Quality Control & Batch Disposition](#5-isoiec-17025-quality-control--batch-disposition)
6. [Machine-to-Machine SIS API & GloSIS Exchange](#6-machine-to-machine-sis-api--glosis-exchange)
7. [Field Intake & KoboToolbox Integration](#7-field-intake--kobotoolbox-integration)
8. [Historical Analysis Backfill (Pre-Delivery Compatibility)](#8-historical-analysis-backfill-pre-delivery-compatibility)
9. [Localization, Branding & Translation Editor](#9-localization-branding--translation-editor)
10. [Automated Backups & Disaster Recovery](#10-automated-backups--disaster-recovery)
11. [Production Security Hardening Checklist](#11-production-security-hardening-checklist)

---

## 1. Introduction & First-Time Setup

Welcome to the **SoilFER-LIMS Administration Guide**. This document is designed for System Administrators and Laboratory Directors responsible for setting up, configuring, and operating a production soil laboratory information management system.

### Initial Access Checklist
1. Open your web browser to your LIMS domain (e.g. `https://lims.your-institution.org` or `http://localhost`).
2. Sign in with the primary administrative credentials:
   * **Username:** `admin`
   * **Password:** The initial password randomly generated upon database seed (displayed once in server startup logs as `<generated-initial-password>`) or configured via `ADMIN_INITIAL_PASSWORD` in your `.env` file.
3. Upon first login, the system will prompt you to replace the initial password with an institutional-strength passphrase (minimum 8 characters with letters, numbers, and symbols).
4. Navigate to the **Admin Panel** (`/admin`) using the top-right navigation menu.

> 💡 **Tip:** In **Global Mode** (`DEPLOYMENT_MODE=global`), the initial `admin` account possesses the `SUPER_ADMIN` role, enabling multi-laboratory management. In **Local Mode**, `admin` operates as the primary `LAB_MANAGER`.

---

## 2. Role-Based Access Control (RBAC) Matrix

SoilFER-LIMS enforces strict, type-safe Role-Based Access Control with automatic database query scoping:

| Role Persona | System Code | Scope of Access | Primary Operational Responsibilities |
| :--- | :--- | :--- | :--- |
| **Global Administrator** | `SUPER_ADMIN` | Global (All Laboratories) | Laboratory creation, user provisioning, institutional branding locks, SIS API tokens, system backups. |
| **Laboratory Manager** | `LAB_MANAGER` | Single Laboratory (e.g. `GTM-LAB1`) | Work item assignment, batch approvals, QC disposition overrides, equipment calibration, inventory lots. |
| **Bench Analyst** | `LAB_TECHNICIAN` | Assigned Work Queue | Sample drying and milling checklist receipts, worksheet results recording, instrument linkage, MIR scan uploads. |
| **Intake Officer** | `SAMPLE_RECEPTION` | Reception Desk | Physical sample inspection, container condition checks, barcode/QR label printing, Kobo manifest matching. |
| **Project Sponsor** | `PROJECT_MANAGER` | Assigned Projects | Project progress dashboards, spatial GIS coordinates, and batch CSV/Excel report exports. |

> 🔒 **Security Guarantee:** Technicians and Intake Officers are physically scoped to their assigned laboratory. Cross-laboratory queries fail closed with an HTTP 403 Forbidden error.

---

## 3. Laboratory Configuration & Multi-Tenancy

In multi-laboratory deployments, national ministries can host multiple regional laboratories on a single server instance:

1. Navigate to **Admin Panel → Laboratories** (`/admin?tab=labs`).
2. Click **Create New Laboratory**.
3. Fill in the required institutional parameters:
   * **Lab Code:** Unique identifier (e.g. `GTM-LAB1`, `MOZ-SOIL2`).
   * **Laboratory Name:** Official institutional title.
   * **Country:** Target nation ISO code.
   * **Default Timezone:** Local IANA timezone (e.g. `America/Guatemala`, `Africa/Maputo`).
   * **Active Status:** Toggle laboratory operations on or off.
4. Assign a **Laboratory Manager** to the newly registered facility.

---

## 4. FAO GLOSOLAN Method Catalogue & Analytical Packages

SoilFER-LIMS natively includes the **FAO GLOSOLAN Standard Operating Procedures** catalogue:

Navigate to **Admin Panel → Lab Configuration → Analyses & Methods** (`/admin?tab=lab-config`):

### A. Core Soil Properties (Measurands)
* **Canonical Codes:** `pH`, `carbonOrganic`, `nitrogenTotal`, `electricalConductivity`, `exchangeableBases` (`Ca`, `Mg`, `K`, `Na`), `pSA` (Sand, Silt, Clay).
* **Controlled Units:** Automatically converts and standardizes units (`g/kg`, `mg/kg`, `cmol(+)/kg`, `dS/m`, `µS/cm`, `%`).
* **Plausibility Bounds:** Enforces strict physical minimum and maximum bounds to catch data entry errors before submission.

### B. Standard Analysis Suites (Packages)
Group common laboratory determinations into 1-click packages for intake officers:
* **Routine Soil Fertility Suite:** pH ($1:2.5\ \text{H}_2\text{O}$), Organic Carbon (Walkley-Black), Total Nitrogen (Kjeldahl), Available Phosphorus (Olsen / Mehlich-3), Electrical Conductivity.
* **Physical Soil Suite:** Particle Size Analysis (`SAND`, `SILT`, `CLAY` with USDA 12-class textural closure validation), Bulk Density, Moisture Content.
* **Exchangeable Cations & CEC:** Ammonium Acetate extraction for exchangeable $\text{Ca}^{2+}$, $\text{Mg}^{2+}$, $\text{K}^+$, $\text{Na}^+$, and Effective Cation Exchange Capacity (ECEC).

---

## 5. Quality Assurance & Batch Control Aligned with ISO/IEC 17025

Quality assurance is embedded into every analytical batch to support an ISO/IEC 17025 aligned management system:

1. **Batch QC Samples**:
   * **Method Blanks:** Checked against default background limit ($\le 0.05$).
   * **Analytical Duplicates:** Verified using Relative Percent Difference (default $\text{RPD} \le 10.0\%$).
   * **Certified Reference Materials (CRMs):** Verified against recovery windows (default $90.0\% \le \text{Recovery} \le 110.0\%$).
   * *Note: Thresholds are configurable defaults. Laboratories must validate and approve method-specific acceptance limits.*
2. **Automated Evaluation:** Batches are classified as `QC_PASS` or `QC_FAIL` by the calculation engine based on configured limits.
3. **Manager Disposition Overrides:** When natural soil heterogeneity causes duplicate failure, only an authorized `LAB_MANAGER` can sign a `PROCEED_WITH_WARNING` disposition with a mandatory written justification recorded in the audit trail.

---

## 6. Machine-to-Machine SIS API & GloSIS Exchange

National Soil Information Systems (SIS) and research repositories can ingest laboratory data programmatically:

1. Navigate to **Admin Panel → API Keys** (`/admin?tab=api-keys`).
2. Click **Generate New API Key**.
3. Specify a client description (e.g. `National-SIS-Data-Exchange`), select the authorized laboratory scope, and set an expiration date.
4. Clients pass the token in the `X-API-Key` header:

```bash
# Query authorized sample data in standardized RFC 7946 GeoJSON format:
curl -H "X-API-Key: sis_live_a8f9c2d1..." \
     https://lims.your-institution.org/api/v1/data-exchange/samples?limit=50
```

---

## 7. Field Intake & KoboToolbox Integration

Connect field sampling campaigns directly with the laboratory reception desk:

1. Open **Projects** (`/projects`) and select your target project.
2. Open **KoboToolbox Settings** within the project configuration.
3. Enter your KoboToolbox server endpoint (e.g. `https://kf.kobotoolbox.org`) and your API Account Token.
4. Select the active sampling survey form.
5. Field records, geographic GPS coordinates, depth horizons ($0\text{--}20\text{ cm}$, $20\text{--}50\text{ cm}$), and bag photographs will synchronize automatically into the **Reception** queue as expected arrivals.

---

## 8. Historical Analysis Data Ingestion

For laboratories migrating historical soil datasets analyzed prior to SoilFER LIMS deployment:

1. Authorized Intake Officers and Lab Managers can open the historical ingestion engine directly at **Admin Panel → Legacy Import** (`/admin/legacy-import`) or via the backfill informational modal in **Projects** (`/projects`).
2. Upload a standard `.csv` file (plain text comma-separated values).
3. The engine parses and previews CSV headers.
4. Map each column to:
   * A canonical analysis code from the method catalogue.
   * A validated laboratory methodology.
   * A controlled measurement unit.
5. Review the preview validation check to resolve any unmapped columns or format discrepancies.
6. Execute import. Successfully ingested records are stored with standard provenance and recorded in the audit log.

---

## 9. Localization, Branding & Language Editor

SoilFER-LIMS provides multi-lingual access in English, Spanish (`es` and `es-419`), French, and Portuguese:

1. Open **Admin Panel → Languages** (`/admin?tab=languages`).
2. Choose your target language.
3. Modify any UI label or scientific terminology in real time.
4. Click **Save Translations** — changes update immediately across connected sessions.

---

## 10. Automated Backups & Disaster Recovery

SoilFER-LIMS stores all database records in SQLite with Write-Ahead Logging (WAL) enabled.

> [!WARNING]
> **Do not copy a live `dev.db` file directly.** Doing so risks creating an inconsistent copy due to uncommitted WAL transactions. Always use the provided online backup utilities.

### Creating an Online Backup
Execute an online backup inside the running container:
```bash
docker exec soilfer-lims node scripts/backup_db.js
```
The compressed backup is stored at `/app/server/backups/soilfer_lims_backup_<timestamp>.db.gz` inside the `lims-backups` Docker named volume.

### Verifying and Restoring Backups
```bash
# 1. Verify backup archive integrity:
docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<backup-filename>.db.gz

# 2. To restore (stop application first to ensure clean state):
docker compose stop
docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups \
  soilfer-lims-app node scripts/restore_db.js /app/server/backups/<backup-filename>.db.gz
docker compose start
curl -f http://localhost/api/health
```

---

## 11. Production Security Hardening Checklist

Prior to commissioning your laboratory system for official use, verify the following:

- [ ] **HTTPS Enforced:** Strict Transport Security (HSTS) and automatic HTTP $\rightarrow$ HTTPS redirection active.
- [ ] **High-Entropy Secrets:** Ensure `JWT_SECRET` in `.env` is at least 64 random alphanumeric characters.
- [ ] **Initial Password Changed:** Change the generated administrator password immediately upon first login.
- [ ] **User Role Least-Privilege:** Assign users strictly to required roles (`SAMPLE_RECEPTION`, `LAB_TECHNICIAN`, `LAB_MANAGER`).
- [ ] **Firewall Restricted:** Only ports `80` and `443` should be reachable publicly. Port `22` (SSH) restricted to authorized administrative IPs.
- [ ] **Branding Protection:** Partner logos and institutional badges locked by global `SUPER_ADMIN`.

---

## 12. Scope & Validation Responsibility

SoilFER-LIMS provides analytical data management tools, calculation routines, and quality record structures. Each adopting laboratory remains responsible for:
- Validating analytical methods, calculations, and instruments prior to reporting operational results.
- Establishing and approving method-specific quality control acceptance thresholds (blanks, duplicates, and reference materials).
- Managing user access controls, role assignments, and password rotation policies according to institutional security standards.
- Ensuring compliance with national, regional, and international laboratory accreditation requirements (such as ISO/IEC 17025).
- Implementing routine off-site database backups and validating disaster recovery procedures.
