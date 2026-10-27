<div align="center">

<img src="./client/public/assets/img/soilfer-logo.png" alt="SoilFER LIMS Logo" width="340" />

# SoilFER-LIMS

### Global & Local Laboratory Information Management System for Soil Analysis

*An open-source laboratory information platform designed to support soil testing workflows aligned with the **FAO Global Soil Partnership (GSP)**, **GLOSOLAN**, **ISO/IEC 17025**, and **GloSIS Soil Ontology** guidelines.*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue.svg)](Dockerfile)
[![GloSIS Format](https://img.shields.io/badge/GloSIS-Format%20Ready-green.svg)](https://github.com/glosis-ld/glosis)
[![Tests](https://img.shields.io/badge/Tests-77%20Suites%20%7C%20555%20Passing-brightgreen.svg)](#-automated-test-suite-77-suites-555-tests)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B%20%7C%20v22%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg)](https://vitejs.dev/)

</div>

---

## 📖 In-Repository & Local Documentation

Complete, plain-language documentation for laboratory managers, bench technicians, reception staff, and IT administrators is available directly in the repository and viewable locally as an interactive book (`mdbook serve docs/book`):

### User Manual Chapters (`docs/book/src/usage/`)
* 📥 **[Sample Reception & Intake](docs/book/src/usage/reception-and-intake.md)** — Consignments (`CSG-...`), walk-in intake, [KoboToolbox mobile sync](docs/book/src/usage/kobotoolbox.md), arrival inspection, blind lab coding, and sub-sample container barcodes (`C-...`).
* 🌡️ **[Drying, Preparation, Storage & Custody](docs/book/src/usage/preparation-and-custody.md)** — Air-drying (`< 40 °C`), `2 mm` sieving and `< 100 µm` grinding gates, storage locations, chain of custody, and post-report retention countdowns.
* 🧪 **[Technician Workbench & Analytical Runs](docs/book/src/usage/technician-workbench.md)** & **[Shared Bench Terminals, Attempts & Repeats](docs/book/src/usage/bench-terminals-and-attempts.md)** — Rack/microplate batch builder, formula-backed wet-chemistry worksheets, shared bench PIN attribution, and append-only attempts (`R1`, `R2`, ...).
* 🛡️ **[Quality Control, Control Charts & Failed QC](docs/book/src/usage/qc-management.md)** & **[Equipment Readiness, Reference Materials & PT](docs/book/src/usage/equipment-inventory.md)** — Blanks, duplicates, LRMs, CRMs, `ICV`/`CCV`/`CCB` drift checks, Shewhart control charts, Westgard rules, failed-QC remedies, instrument readiness gates, and Proficiency Testing ($z$-scores).
* ✅ **[Review, Approval & Plausibility Checks](docs/book/src/usage/review-and-approval.md)** — Stage 1 batch review, Stage 2 whole-sample approval, saved Reported Value Selection, soil chemistry cross-checks, and second-person review rules.
* 📄 **[Certificates of Analysis, PDF Reports & Amendments](docs/book/src/usage/reporting-pdf.md)** — ISO/IEC 17025 §7.8 PDF certificates, `AIR_DRY` vs. `OVEN_DRY` moisture basis, QR verification, and post-report clerical/scientific amendments & revisions (`Rev 2+`).
* ⚙️ **[Per-Lab Settings, Presets & Method Overrides](docs/book/src/usage/lab-settings-and-presets.md)** & **[Roles & Permissions](docs/book/src/usage/roles.md)** — `ISO17025_STRICT`, `BASIC`, and `ADVISORY` presets, lab policy overrides, and per-method `QcRule` settings.
* 🌐 **[Data Exchange, NSIS / OpenNSIS & API v2](docs/book/src/usage/data-exchange.md)**, **[Spectral Data Management](docs/book/src/usage/spectral.md)**, **[Agronomic Interpretation](docs/book/src/usage/agronomic-interpretation.md)** & **[Glossary](docs/book/src/reference/glossary.md)**.

### Administrator & Technical Reference Guides (`docs/`)
* 📊 **[Deployment Readiness Status & Operator Guide](docs/DEPLOYMENT_READINESS.md)** — Tracked readiness status, single-lab and multi-lab guides, and technical audit ledger.
* 📖 **[Administration Guide](docs/ADMIN_GUIDE.md)** — Laboratory configuration, user RBAC, GloSIS procedures, quality rules, and SIS API keys.
* 🚀 **[Deployment & Production Guide](docs/DEPLOYMENT_GUIDE.md)** — Comprehensive VPS setup, Docker Compose, Nginx/Apache reverse proxy, SSL/Certbot, and zero-downtime updates.
* 🛠️ **[Installation Quickstart](docs/INSTALL.md)** — Step-by-step local machine and server installation for beginners.
* 🔄 **[Upgrading & Maintenance Guide](docs/UPGRADING.md)** — Backup procedures, container updates, and database migration routines.
* 📡 **[NSIS Data Exchange API v2 Specification](docs/data-exchange-api-v2.md)** & **[Operator Runbook](docs/nsis-operator-runbook.md)** — Lossless observations, snapshots, change feeds, delivery receipts, and [Soil Profile References](docs/profile-reference-guide.md).

---

## 🌟 What is SoilFER-LIMS?

**SoilFER-LIMS** (Laboratory Information Management System) is an open-source web application designed to help soil testing laboratories manage their daily analytical workflow digitally. Developed to support laboratories implementing FAO SoilFER Programme and GLOSOLAN guidance, it replaces paper logbooks, disconnected spreadsheets, and error-prone manual calculations with a structured, auditable digital chain of custody.

Whether you run a single provincial soil laboratory or coordinate a national network across agricultural research stations, SoilFER-LIMS connects your staff, field teams, bench analysts, and laboratory managers in a unified, multilingual platform.

### The 6 Core Stages of Soil Analysis

```
+-----------------+     +-----------------+     +-----------------+
| 1. Field Intake | --> | 2. Prep Gates   | --> | 3. Bench Work   |
| Kobo GPS & Bags |     | Drying & Sieve  |     | Wet Chem & MIR  |
+-----------------+     +-----------------+     +-----------------+
                                                         |
+-----------------+     +-----------------+     +--------v--------+
| 6. SIS Exchange | <-- | 5. Certificates | <-- | 4. QA Review    |
| V2 & GeoJSON    |     | PDF & Revisions |     | Blanks/Dups/QC  |
+-----------------+     +-----------------+     +-----------------+
```

1. **Field Intake & Provenance**: Expected arrivals from KoboToolbox mobile surveys, consignment (`CSG-...`) and walk-in registration, physical inspection of bags, barcode/QR label printing, and sub-sample container tracking (`C-...`).
2. **Operational Prerequisite Gates**: Server-side enforced preparation gates (configurable drying and sieving steps, default $< 40\ ^\circ\text{C}$ forced-air drying and $2\text{ mm}$ sieving) requiring verified operational records before bench testing unlocks.
3. **Bench Execution, Terminals & Runs**: Structured analytical batches (`RunBatch`) with rack/microplate layouts, formula-backed wet-chemistry worksheets, shared bench terminal PIN attribution, append-only repeat attempts (`R1`, `R2`), and MIR/Vis-NIR spectroscopy.
4. **Configurable Quality Assurance & Two-Stage Review**: Evaluate method blanks, analytical duplicates, LRMs, CRMs, calibration drift (`ICV`/`CCV`/`CCB`), Shewhart control charts, and cross-parameter soil chemistry checks against configurable per-lab (`ISO17025_STRICT`, `BASIC`, `ADVISORY`) and per-method (`QcRule`) policies.
5. **Certificates of Analysis & Amendments**: Server-side PDF reports (`RPT-...`) featuring actual drying/prep records, `AIR_DRY` vs. `OVEN_DRY` moisture basis, saved Reported Values, truthful QC/caveat disclosures, QR verification, and ISO/IEC 17025 §7.8.8 post-report amendments & revisions (`Rev 2+`).
6. **National Soil Information System (NSIS / OpenNSIS) Interoperability**: Read-only Data Exchange Gateway (`v1` and `v2`) providing lossless replicate observations, Soil Profile References, RFC 7946 GeoJSON, resumable 24-hour snapshots, continuous change feeds, and delivery receipts.

---

## 🚀 Two Deployment Modes

SoilFER-LIMS can be deployed in two operating modes depending on institutional requirements:

| Feature | **Local Lab Mode (`DEPLOYMENT_MODE=local`)** | **Global Network Mode (`DEPLOYMENT_MODE=global`)** |
| :--- | :--- | :--- |
| **Primary Target** | Single independent soil testing laboratory | National soil program, ministry network, multi-lab initiative |
| **User Roles** | Lab Manager, Reviewers, Receptionists, Bench Technicians | Super Admin, National Lab Managers, Reviewers, Technicians, Intake Officers |
| **Data Scoping** | Single unified laboratory pool | Strict multi-tenant RBAC isolation per laboratory code (`GTM-LAB1`, `MOZ-LAB1`) |
| **Default Admin** | `admin` (Role: `LAB_MANAGER`) | `admin` (Role: `SUPER_ADMIN`) |
| **Best Used For** | University laboratories, provincial testing centers | National ministries, international soil research consortia |

To switch modes, simply adjust `DEPLOYMENT_MODE=local` or `DEPLOYMENT_MODE=global` in your `.env` file.

---

## ✨ Key Capabilities & Scientific Standards

### 🔬 1. FAO GLOSOLAN Harmonized Method Catalogue
* **Standard Operating Procedures (SOPs)**: Standardized analytical procedure catalogue aligned with FAO GLOSOLAN guidelines.
* **One Canonical Unit per Analysis**: Built-in unit normalization converting legacy `%`, `ppm`, `meq/100g` inputs into each analysis's canonical unit (`g/kg`, `mg/kg`, `cmol(+)/kg`, `dS/m`, `µS/cm`, `%`) with exact conversion factors.
* **Canonical Soil Measurands**: Standardized parameters for `pH`, `carbonOrganic`, `nitrogenTotal`, `electricalConductivity`, `exchangeableBases`, `particleSizeAnalysis`, and `cationExchangeCapacitySoil`.

### 🛡️ 2. Quality Assurance & Batch Control Aligned with ISO/IEC 17025
SoilFER-LIMS is designed to support workflows and records that contribute to an ISO/IEC 17025 quality system. Formal accreditation belongs to the testing laboratory and its validated procedures.
* **Laboratory-owned policy**: `ISO17025_STRICT`, `BASIC` and `ADVISORY` presets provide shipped defaults. Labs can override supported settings, with analysis/method overrides where available; no acceptance number is a universal rule. Review and validate limits for the method and laboratory before operational use.
* **Versioned QC rules**: `QcRule` supplies lab/analysis criteria and optional method-specific criteria. The evaluator resolves these with `policyService` and applicable shipped analysis defaults, and records the resolved rule and policy snapshot with the evaluation.
* **Reference materials & Proficiency Testing**: `ReferenceMaterial` records identify CRM/LRM lots, expiry dates, and target analyte values, while the Proficiency Testing (`PT`) module tracks inter-laboratory rounds and evaluates $|z|$-scores ($\le 2$ satisfactory, $2\text{--}3$ questionable, $\ge 3$ unsatisfactory).
* **Control charts**: Lab/analysis/method/reference-lot series use approved limits and the configured control-chart/Westgard rules. Proposals and approvals are deliberate actions; the limits are not continuously re-estimated after every measurement.
* **Batch evaluation, two-stage review, and disposition**: QC results and the applicable policy determine blocking, warning or advisory behavior. Stage 1 reviews the analytical batch, while Stage 2 reviews the whole sample across parameters and locks the saved `ReportedValueSelection`.

The current resolution paths are documented in [`policyService`](server/services/policyService.js), [`qcRuleService`](server/services/qcRuleService.js), [`qcPolicyService`](server/services/qcPolicyService.js) and [`controlChartService`](server/services/controlChartService.js).

### 🌿 3. USDA Soil Texture & Agronomic Interpretation Engine
* **USDA 12-Class Textural Triangle**: Automatic soil texture derivation (`Sandy Loam`, `Clay`, `Silty Clay Loam`, etc.) with configurable mass-balance closure validation ($\text{Sand} + \text{Silt} + \text{Clay} = 100\% \pm \text{crossCheck.textureClosureTolerancePct}$).
* **FAO 5-Tier Fertility Ratings**: Classifies results into `VERY_LOW`, `LOW`, `OPTIMAL`, `HIGH`, `VERY_HIGH`.
* **Stoichiometric & Chemical Cross-Checks**: Evaluates C:N organic matter equilibrium, Sum of Bases vs. CEC, Base Saturation %, $\text{Ca:Mg}$ and $\text{Mg:K}$ ratios, and SAR/ESP sodicity hazards.

### ⚡ 4. Technician Workbench, Shared Bench Terminals & Spectral Library
* **Append-Only Attempts & Shared Bench Terminals**: Supports shared wet-lab tablets with idle auto-lock (`bench.idleLockMinutes`), per-action operator PIN verification (`bench.pinAtRecord`), and non-destructive repeat attempts (`R1`, `R2`, ...).
* **Diffuse Reflectance Spectroscopy**: Upload, validate, and review Mid-Infrared (`MIR`, $4000\text{--}400\text{ cm}^{-1}$) and `Vis-NIR` ($350\text{--}2500\text{ nm}$) CSV and Bruker OPUS files linked directly to sample custody IDs.
* **Instrument Readiness Gates**: Tracks analytical balances, pH/EC meters, and spectrophotometers by criticality (`CRITICAL`, `IMPORTANT`, `NON_CRITICAL`) and blocks or warns when calibration is overdue or a fault is open.

### 📄 5. Certificate of Analysis, Revisions & Amendments
* **Server-Side PDF Engine**: High-performance pure JavaScript PDF generator powered by PDFKit without a headless browser.
* **Truthful ISO/IEC 17025 §7.8 Layout**: Displays actual drying/prep records, `AIR_DRY` vs. `OVEN_DRY` moisture basis, saved Reported Values, optional measurement uncertainty ($U$), and truthful QC/caveat disclosures.
* **Post-Report Amendments & Public QR Protection**: Supports clerical and scientific amendments (`#210`), immediately marks superseded reports `WITHDRAWN` on public QR links, and issues numbered revisions (`Rev 2+`, `#211`) with `†`/`‡` change markers.

### 📦 6. Historical Sample Analysis Backfill
* **Legacy Batch Ingestion**: Built-in CSV ingestion engine in the Admin Panel (`/admin/legacy-import`, accessible by authorized intake and manager roles) with CSV header preview, required column-to-method mappings, unit validation, duplicate handling, and audit logging.

---

## Installation

Follow the [HTTPS-first installation walkthrough](docs/INSTALL.md). It covers
server sizing, certificates, the shipped proxy, environment configuration,
first sign-in and off-host backups. For an existing instance, use the
[upgrade guide](docs/UPGRADING.md).

---

## 🔑 Initial Administration & User Provisioning

When a fresh database is initialized, SoilFER-LIMS provisions a single administrative account:

- **Username:** `admin`
- **Role Assignment:**
  - In **Local Mode** (`DEPLOYMENT_MODE=local`): `LAB_MANAGER` scoped to the initial default laboratory.
  - In **Global Mode** (`DEPLOYMENT_MODE=global`): `SUPER_ADMIN` with system-wide management authority.
- **Initial Password:** Use your supplied `ADMIN_INITIAL_PASSWORD`, or privately read the owner-only handoff file whose path appears in the startup log. Password values are never printed. See [administrator handoff](docs/http-deployment-settings.md#initial-administrator-password).
- **Mandatory Password Change:** You will be prompted to set an institutional-strength password upon first login.
- **Staff Provisioning:** Operational roles (`SAMPLE_RECEPTION`, `LAB_TECHNICIAN`, `LAB_MANAGER`, `PROJECT_MANAGER`) are created by administrators via **Admin Panel → User Management** (`/admin?tab=users`) rather than persistent default accounts.

---

## 💻 Local Development (Without Docker)

For software developers or contributors who prefer running Node.js directly on their workstation:

### Prerequisites
* **Node.js**: `^20.19`, `^22.12`, or `>=24` (Docker is strongly recommended for standard deployment)
* **Git**: ([Download Git](https://git-scm.com/))

### 1. Install Server Dependencies
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run seed
```

### 2. Install Client Dependencies
```bash
cd ../client
npm install
```

### 3. Start Development Servers
In two separate terminal windows:
```bash
# Terminal 1: Backend API Server (Port 5000)
cd server
npm run dev

# Terminal 2: Frontend Vite Server (Port 5173)
cd client
npm run dev
```

Open `http://localhost:5173` to access your local development environment.

---

## 🧪 Automated Test Suite

SoilFER-LIMS features an extensive automated test suite covering security authorization, database schema integrity, scientific metrology, and operational prerequisite contracts:

```bash
cd server
npm test
```

---

## 💾 Backups & Disaster Recovery

SoilFER-LIMS stores all database records in SQLite with Write-Ahead Logging (WAL) enabled.

> [!WARNING]
> **Do not directly copy a live `dev.db` file while the application is running.** Doing so can omit committed WAL transactions and produce a corrupted database copy. Always use the provided online backup utilities.

### 1. Creating an Online SQLite Backup
Run the online backup script inside the container. It uses SQLite's online backup API to take a non-blocking, transactionally consistent snapshot and compresses it with gzip:

```bash
docker exec soilfer-lims node scripts/backup_db.js
```

The backup archive is saved to `/app/server/backups/soilfer_lims_backup_<timestamp>.db.gz` inside the `lims-backups` Docker named volume.

### 2. Identifying and Copying the Backup File
```bash
# List recent backup files:
docker exec soilfer-lims ls -la /app/server/backups/

# Copy the backup archive to safe host or off-host storage:
docker cp soilfer-lims:/app/server/backups/<backup-filename>.db.gz ./backups/
```

### 3. Verifying Backup Integrity
Verify that the backup uncompresses cleanly and passes SQLite `PRAGMA integrity_check`:
```bash
docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<backup-filename>.db.gz
```

### 4. Safe Database Restoration
To restore a backup safely without corrupting active connections:

```bash
# 1. Stop the application container to flush open connections
docker compose stop

# 2. Run the restore utility against the target database
docker run --rm -v lims-data:/app/server/prisma -v lims-backups:/app/server/backups \
  soilfer-lims-app node scripts/restore_db.js /app/server/backups/<backup-filename>.db.gz

# 3. Restart the application container
docker compose start

# 4. Verify system health and verify read-only accessibility
curl -f http://localhost/api/health
```

---

## ⚖️ Scope & Validation Responsibility

SoilFER-LIMS provides analytical data management tools, calculation routines, and quality record structures. Each adopting laboratory remains responsible for:
- Validating all analytical methods, calculations, and instruments prior to reporting operational results.
- Establishing and approving method-specific quality control acceptance thresholds (blanks, duplicates, and reference materials).
- Managing user access controls, role assignments, and password rotation policies according to institutional security standards.
- Ensuring compliance with national, regional, and international laboratory accreditation requirements (such as ISO/IEC 17025).
- Implementing routine off-site database backups and validating disaster recovery procedures.

---

## 📄 License & Attribution

SoilFER-LIMS is distributed under the **MIT License**. See [`LICENSE`](LICENSE) for terms.

### Method & Standards References
* **FAO Global Soil Partnership (GSP) & GLOSOLAN**: Standard Operating Procedures and soil laboratory guidelines referenced under CC BY-NC-SA 3.0 IGO.
* **International Organization for Standardization (ISO)**: Method references (ISO/IEC 17025, ISO 10390, ISO 11265, ISO 14255).
* **USDA Natural Resources Conservation Service (NRCS)**: Soil Survey Laboratory Methods and USDA 12-Class Textural Classification.

*Disclaimer: This open-source software is developed to support soil testing laboratories adopting international guidelines. It is an independent community software project and does not represent formal accreditation, official certification, or endorsement by FAO, GSP, GLOSOLAN, or ISO.*

---

<div align="center">
  <sub>SoilFER-LIMS — Open-Source Laboratory Information Management System for Soil Analysis.</sub>
</div>
