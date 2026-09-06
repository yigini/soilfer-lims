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
   * **Password:** `password`
3. Upon first login, the system will prompt you to replace the default password with an institutional-strength passphrase (minimum 8 characters with letters, numbers, and symbols).
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

## 5. ISO/IEC 17025 Quality Control & Batch Disposition

Quality assurance is embedded into every analytical batch:

1. **Mandatory QC Samples**:
   * **Method Blanks:** Checked against maximum background limit ($\le 0.05$).
   * **Analytical Duplicates:** Verified using Relative Percent Difference ($\text{RPD} \le 10.0\%$).
   * **Certified Reference Materials (CRMs):** Verified against certified recovery windows ($90.0\% \le \text{Recovery} \le 110.0\%$).
2. **Automated Evaluation:** Batches are automatically classified as `QC_PASS` or `QC_FAIL` by the calculation engine.
3. **Manager Disposition Overrides:** When natural soil heterogeneity causes duplicate failure, only a `LAB_MANAGER` can sign a `PROCEED_WITH_WARNING` disposition with a mandatory written justification recorded in the immutable audit log.

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

1. Open **Admin Panel → KoboToolbox Integration** (`/admin?tab=kobo`).
2. Enter your KoboToolbox server endpoint (e.g. `https://kf.kobotoolbox.org`) and your API Account Token.
3. Select the active sampling survey form.
4. Field records, geographic GPS coordinates, depth horizons ($0\text{--}20\text{ cm}$, $20\text{--}50\text{ cm}$), and bag photographs will synchronize automatically into the **Reception** queue as expected arrivals.

---

## 8. Historical Analysis Backfill (Pre-Delivery Compatibility)

For laboratories with thousands of historical soil samples analyzed prior to SoilFER LIMS deployment:

1. Open the **Projects** console (`/projects`).
2. Select your target project and click **Historical Analysis Backfill**.
3. Use the guided backfill modal to:
   * Specify legacy sample ID ranges and collection intervals.
   * Attach historical standard operating procedures.
   * Ingest pre-analyzed determinations with the formal `PROVENANCE: PRE_DELIVERY_BACKFILL` audit tag.
4. Historical records are preserved for national reporting without corrupting active chain-of-custody ledgers.

---

## 9. Localization, Branding & Translation Editor

SoilFER-LIMS provides multi-lingual access in English, Spanish (`es` and `es-419`), French, and Portuguese:

1. Open **Admin Panel → Translations** (`/admin?tab=translations`).
2. Choose your language.
3. Modify any UI label or scientific terminology in real time.
4. Click **Save Translations** — changes update immediately across all connected users.

---

## 10. Automated Backups & Disaster Recovery

### Automated Nightly Database Backup
Configure a daily cron job on the host machine to back up the SQLite WAL database:

```bash
# Open host crontab editor
crontab -e

# Add automated daily backup at 02:00 UTC:
0 2 * * * docker exec -w /app/server soilfer-lims node scripts/backup_db.js
```

Backups are saved with UTC timestamps in `/opt/soilfer-lims/server/backups/`.

---

## 11. Production Security Hardening Checklist

Prior to commissioning your laboratory system for official use, verify the following:

- [ ] **HTTPS Enforced:** Strict Transport Security (HSTS) and automatic HTTP $\rightarrow$ HTTPS redirection active.
- [ ] **High-Entropy Secrets:** Ensure `JWT_SECRET` in `.env` is at least 64 random alphanumeric characters.
- [ ] **Default Passwords Changed:** Change passwords for `admin`, `mgr_*`, and `tech_*` demo accounts.
- [ ] **Firewall Restricted:** Only ports `80` and `443` should be reachable publicly. Port `22` (SSH) restricted to authorized administrative IPs.
- [ ] **Branding Protection:** Partner logos and institutional badges locked by global `SUPER_ADMIN`.
