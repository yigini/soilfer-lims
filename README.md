<div align="center">

<img src="./soilfer-logo.png" alt="SoilFER LIMS Logo" width="340" />

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

Complete, operator-focused documentation is available directly in the repository and viewable locally as an interactive book:

* 📖 **[Administration Guide](docs/ADMIN_GUIDE.md)** — Laboratory configuration, user RBAC, GloSIS procedures, quality rules, and SIS API keys.
* 🚀 **[Deployment & Production Guide](docs/DEPLOYMENT_GUIDE.md)** — Comprehensive VPS setup, Docker Compose, Nginx/Apache reverse proxy, SSL/Certbot, and zero-downtime updates.
* 🛠️ **[Installation Quickstart](docs/INSTALL.md)** — Step-by-step local machine and server installation for beginners.
* 🔄 **[Upgrading & Maintenance Guide](docs/UPGRADING.md)** — Backup procedures, container updates, and database migration routines.
* 📚 **Interactive mdBook Site (Local)** — Run `mdbook serve docs/book` from the repository root to launch the local interactive documentation site at `http://localhost:3000`.

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
| RFC 7946 GeoJSON|     | PDF Report      |     | Blanks/Dups/QC  |
+-----------------+     +-----------------+     +-----------------+
```

1. **Field Intake & Provenance**: Expected arrivals from KoboToolbox mobile surveys, physical inspection of bags, barcode/QR label printing, and non-conformance tracking.
2. **Operational Prerequisite Gates**: Server-side enforced preparation gates (configurable drying and sieving steps, default 40 °C forced-air drying and 2 mm sieving) requiring verified operational checklist receipts before testing can begin.
3. **Bench Execution & Worksheets**: Single-entry bench worksheets for routine soil chemistry, AAS, ICP, photometry, titration, and mid-infrared (MIR) diffuse reflectance spectroscopy.
4. **Quality Assurance Workflows**: Automated calculation and evaluation of method blanks, analytical duplicate RPD, and Certified Reference Material (CRM) recovery against laboratory-approved acceptance limits (with configurable default thresholds).
5. **Analytical Reports**: PDF reports generated via PDFKit featuring laboratory branding, USDA 12-class soil texture classification, 5-tier agronomic ratings, and authorized electronic approval records.
6. **National Soil Information System (SIS) Interoperability**: Data exchange and export tools formatted according to GloSIS ontologies and RFC 7946 GeoJSON guidelines.

---

## 🚀 Two Deployment Modes

SoilFER-LIMS can be deployed in two operating modes depending on institutional requirements:

| Feature | **Local Lab Mode (`DEPLOYMENT_MODE=local`)** | **Global Network Mode (`DEPLOYMENT_MODE=global`)** |
| :--- | :--- | :--- |
| **Primary Target** | Single independent soil testing laboratory | National soil program, ministry network, multi-lab initiative |
| **User Roles** | Lab Manager, Receptionists, Bench Technicians | Super Admin, National Lab Managers, Technicians, Intake Officers |
| **Data Scoping** | Single unified laboratory pool | Strict multi-tenant RBAC isolation per laboratory code (`GTM-LAB1`, `MOZ-LAB1`) |
| **Default Admin** | `admin` (Role: `LAB_MANAGER`) | `admin` (Role: `SUPER_ADMIN`) |
| **Best Used For** | University laboratories, provincial testing centers | National ministries, international soil research consortia |

To switch modes, simply adjust `DEPLOYMENT_MODE=local` or `DEPLOYMENT_MODE=global` in your `.env` file.

---

## ✨ Key Capabilities & Scientific Standards

### 🔬 1. FAO GLOSOLAN Harmonized Method Catalogue
* **Standard Operating Procedures (SOPs)**: Standardized analytical procedure catalogue aligned with FAO GLOSOLAN guidelines.
* **Controlled Unit Vocabulary**: Built-in unit normalization converting `%`, `ppm`, `meq/100g`, `g/kg`, `mg/kg`, `cmol(+)/kg`, `dS/m`, and `µS/cm` with exact scientific conversion factors.
* **Canonical Soil Measurands**: Standardized parameters for `pH`, `carbonOrganic`, `nitrogenTotal`, `electricalConductivity`, `exchangeableBases`, `particleSizeAnalysis`, and `cationExchangeCapacitySoil`.

### 🛡️ 2. Quality Assurance & Batch Control Aligned with ISO/IEC 17025
SoilFER-LIMS is designed to support workflows and records that contribute to an ISO/IEC 17025 quality system. Formal accreditation belongs to the testing laboratory and its validated procedures.
* **Typed Quality Control Samples**:
  * **Method Blanks**: Automatic evaluation against background limits (default $\le 0.05$).
  * **Analytical Duplicates**: Relative Percent Difference monitoring (default $\text{RPD} \le 10.0\%$).
  * **Certified Reference Materials (CRMs)**: Recovery monitoring (default $90.0\% \le \text{Recovery} \le 110.0\%$).
* **Automated Batch Disposition**: Batches transition to `QC_PASS` or `QC_FAIL` based on entered readings and configured acceptance criteria.
* **Managerial Disposition Overrides**: Authorize `PROCEED_WITH_WARNING` or order batch re-runs with mandatory audit trail justification.
* **Method-Specific Thresholds**: Laboratories must review, validate, and approve method-specific limits appropriate to their testing scope.

### 🌿 3. USDA Soil Texture & Agronomic Interpretation Engine
* **USDA 12-Class Textural Triangle**: Automatic soil texture derivation (`Sandy Loam`, `Clay`, `Silty Clay Loam`, etc.) with strict composite mass-balance closure validation ($\text{Sand} + \text{Silt} + \text{Clay} = 100\% \pm 2.0\%$).
* **FAO 5-Tier Fertility Ratings**: Evaluates values into `VERY_LOW`, `LOW`, `OPTIMAL`, `HIGH`, `VERY_HIGH` with practical soil health guidance.
* **Stoichiometric Balances**: Calculates C:N organic matter equilibrium, Base Saturation %, $\text{Ca:Mg}$ and $\text{Mg:K}$ ratios, and SAR/ESP sodicity hazards.

### ⚡ 4. Technician Workbench & Spectral Library
* **Single-Entry Recording**: Eliminates duplicate entry forms and maintains clean separation between draft autosaves and submitted results.
* **Diffuse Reflectance Spectroscopy**: Upload, display, and manage Full-Range Mid-Infrared (MIR $400\text{--}4000\text{ cm}^{-1}$) and VIS-NIR spectral files linked directly to sample custody IDs.
* **Instrument Readiness**: Tracks analytical balances, pH meters, and spectrophotometers with calibration reminders.

### 📄 5. Certificate & Report Generation
* **Server-Side PDF Engine**: High-performance pure JavaScript PDF generator powered by PDFKit without a headless browser.
* **Official Layout**: Laboratory and program headers, sample GPS coordinates, depth layers, complete analytical results grid, and authorized electronic approval records.
* **Public QR Verification**: Instant validation of printed certificates via secure public URL tokens (`/api/reports/public/:token/pdf`).

### 📦 6. Historical Sample Analysis Backfill
* **Legacy Batch Ingestion**: Built-in CSV ingestion engine in the Admin Panel (`/admin/legacy-import`, accessible by authorized intake and manager roles) with CSV header preview, required column-to-method mappings, unit validation, duplicate handling, and audit logging.

---

## ⚡ 5-Minute Quick Start (Docker Deployment)

The fastest and most reliable way to run SoilFER-LIMS is with **Docker** and **Docker Compose**. Everything (Node.js API, React frontend, database engine) runs in a single optimized container.

### 1. Clone the Repository
```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
```

### 2. Configure Environment
```bash
# Copy template environment file
cp .env.example .env
```

*(Optional)* Open `.env` in any text editor to set your custom `JWT_SECRET` or customize your domain name.

### 3. Launch with Docker Compose
```bash
# For a Single Local Laboratory:
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build

# For a Multi-Lab National Network:
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d --build
```

### 4. Access the Application
Open your web browser and navigate to:
👉 **`http://localhost`** (or your server's public IP address)

---

## 🔑 Initial Administration & User Provisioning

When a fresh database is initialized, SoilFER-LIMS provisions a single administrative account:

- **Username:** `admin`
- **Role Assignment:**
  - In **Local Mode** (`DEPLOYMENT_MODE=local`): `LAB_MANAGER` scoped to the initial default laboratory.
  - In **Global Mode** (`DEPLOYMENT_MODE=global`): `SUPER_ADMIN` with system-wide management authority.
- **Initial Password:** Randomly generated during first initialization (or set via `ADMIN_INITIAL_PASSWORD` in your `.env` file). The password is printed once to the container/server logs:
  ```text
  ┌────────────────────────────────────────────────────────┐
  │ 🔑 INITIAL ADMIN CREDENTIALS (Generated — Print Once): │
  │    Username: admin                                     │
  │    Password: <generated-initial-password>              │
  └────────────────────────────────────────────────────────┘
  ```
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
