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
| **Global Administrator** | `SUPER_ADMIN` | Global (All Laboratories) | Laboratory creation, user provisioning, institutional branding locks, NSIS API tokens, system backups. |
| **Laboratory Manager** | `LAB_MANAGER` | Single Laboratory (e.g. `GTM-LAB1`) | Laboratory policy presets & overrides, work assignment, Stage 1/2 approvals, QC disposition overrides, COA issuance & amendments, equipment & PT oversight. |
| **Technical Reviewer** | `REVIEWER` | Single Laboratory | Stage 1 batch technical review, Stage 2 whole-sample review & Reported Value Selection, returning work items for repeat, co-signing scientific amendments. |
| **Bench Analyst** | `LAB_TECHNICIAN` | Assigned Work Queue | Sample drying and sieving gates, batch building, bench/terminal results recording, self-repeats (`R2`), instrument linkage, MIR/Vis-NIR scan uploads. |
| **Intake Officer** | `SAMPLE_RECEPTION` | Reception Desk | Consignment & walk-in intake, container condition/mass checks, barcode/QR label printing, sub-sample containers, Kobo manifest matching. |
| **Project Sponsor** | `PROJECT_MANAGER` | Assigned Projects | Project progress dashboards, spatial GIS coordinates, and batch CSV/Excel/PDF report downloads. |

> 🔒 **Security & Separation of Duties:** Technicians and Intake Officers are strictly scoped to their assigned laboratory. In addition, when `review.secondPersonRequired = true` (default in `ISO17025_STRICT` and `BASIC` presets), a Reviewer or Lab Manager cannot approve a batch or sample for which they recorded the measurements themselves.

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
* **One Canonical Unit per Analysis:** Each analysis stores one canonical reporting unit (`g/kg`, `mg/kg`, `cmol(+)/kg`, `dS/m`, `µS/cm`, `%`) and normalizes legacy synonyms automatically.
* **Plausibility & Cross-Parameter Bounds:** Enforces physical bounds (e.g. `results.phMin`/`phMax`), regional typical ranges (`results.typicalMin`/`typicalMax`), and cross-parameter checks (Sum of Bases vs. CEC, Texture Closure $100\% \pm \text{tolerance}$, C:N ratio).

### B. Standard Analysis Suites (Packages)
Group common laboratory determinations into 1-click packages for intake officers:
* **Routine Soil Fertility Suite:** pH ($1:2.5\ \text{H}_2\text{O}$), Organic Carbon (Walkley-Black), Total Nitrogen (Kjeldahl), Available Phosphorus (Olsen / Mehlich-3), Electrical Conductivity.
* **Physical Soil Suite:** Particle Size Analysis (`SAND`, `SILT`, `CLAY` with USDA 12-class textural closure validation), Bulk Density, Moisture Content.
* **Exchangeable Cations & CEC:** Ammonium Acetate extraction for exchangeable $\text{Ca}^{2+}$, $\text{Mg}^{2+}$, $\text{K}^+$, $\text{Na}^+$, and Effective Cation Exchange Capacity (ECEC).

---

## 5. Quality Assurance, Two-Stage Review & Report Amendments (ISO/IEC 17025)

Quality settings belong to each laboratory and its validated methods. The application supplies configurable presets (`ISO17025_STRICT`, `BASIC`, `ADVISORY`); it does not hard-code a single laboratory's fixed policy.

1. **Choose and customize the laboratory policy (`Settings → Laboratory Policy`).** `ISO17025_STRICT`, `BASIC` and `ADVISORY` are shipped presets. Laboratory overrides and supported analysis/method overrides are resolved by `policyService` (Preset $\to$ Lab Override $\to$ Analysis Override $\to$ Method `QcRule`). Changes are versioned and audited with a mandatory reason. See [Per-Lab Settings, Presets & Method Overrides](book/src/usage/lab-settings-and-presets.md) for the complete policy table.
2. **Configure versioned QC criteria (`QcRule`).** `QcRule` is scoped to a laboratory and analysis, with optional methodology-specific criteria and effective dates. Blank criteria, duplicate RPD/absolute-difference criteria, CRM/LRM recovery windows, calibration curve checks (`ICV`, `CCV`, `CCB`), and failure actions (`FAIL_BATCH`, `REPEAT_BRACKET`, `WARN`) are configured per method.
3. **Maintain reference materials, equipment readiness & Proficiency Testing.** Register `ReferenceMaterial` lots with expiry dates and target analyte values, track instrument calibration readiness by criticality (`CRITICAL`, `IMPORTANT`, `NON_CRITICAL`), and record external Proficiency Testing (`PT`) rounds with automatic $|z|$-score evaluation.
4. **Approve control-chart limits deliberately.** Control-chart series are scoped by lab, analysis, methodology and reference lot. Proposals use selected eligible observations and `qc.controlChartMinPoints` (default 20); authorized approval creates the limit version evaluated with Westgard rules.
5. **Two-stage review, Reported Value Selection & post-report amendments.** Stage 1 reviews the analytical batch, while Stage 2 evaluates the whole sample and saves the official `ReportedValueSelection`. Once a Certificate of Analysis is issued (`REPORTED`), any post-report correction follows the audited **Sample Amendment** (`CLERICAL` or `SCIENTIFIC`) and **Report Revision (`Rev 2+`)** workflow (immediately marking superseded reports `WITHDRAWN` on public links).

For the actual resolution order and supported fields, see [`policyService`](../server/services/policyService.js), [`qcRuleService`](../server/services/qcRuleService.js), [`qcPolicyService`](../server/services/qcPolicyService.js), [`referenceMaterialService`](../server/services/referenceMaterialService.js) and [`controlChartService`](../server/services/controlChartService.js).

---

## 6. Machine-to-Machine NSIS API (V1 & V2) & OpenNSIS Exchange

National Soil Information Systems (NSIS), FAO OpenNSIS, and research repositories can ingest approved laboratory data programmatically:

1. Navigate to **Admin Panel → Data Exchange Keys** (`/admin/api-keys`).
2. Click **Generate API Key**, specify a descriptive label, choose the access role (`NSIS_CONSUMER`, `EXTERNAL_GIS`, `GLOBAL_HARVESTER`), and check the **Authorized Laboratories** (fail-closed if empty) and **Countries**.
3. Use grace-period key rotation (**Rotate API Key** $\to$ **Confirm / Abort Rotation**) to rotate secrets without downtime.
4. Clients authenticate using `X-API-Key: slims_live_...` or `Authorization: Bearer slims_live_...`:

```bash
# V2 Lossless Specimen & Observation Exchange (Recommended for OpenNSIS):
curl -H "X-API-Key: slims_live_a8f9c2d1..." \
     "https://lims.your-institution.org/api/v2/data-exchange/samples?profile=opennsis&limit=50"

# V1 Legacy Selected Reported Values Exchange:
curl -H "X-API-Key: slims_live_a8f9c2d1..." \
     "https://lims.your-institution.org/api/v1/data-exchange/samples?limit=50"
```

See [NSIS Data Exchange Specification V2](data-exchange-api-v2.md) and the [NSIS Operator Runbook](nsis-operator-runbook.md) for snapshots, change feeds, and delivery receipts.

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
