<div align="center">

<img src="https://raw.githubusercontent.com/yigini/soilfer-lims/main/client/public/assets/img/soilfer-logo.png" alt="SoilFER LIMS Logo" width="340" />

# SoilFER-LIMS

### Global & Local Laboratory Information Management System for Soil Analysis

*An enterprise-grade, open-source laboratory platform aligned with the **FAO Global Soil Partnership (GSP)**, **GLOSOLAN**, **ISO/IEC 17025**, and **GloSIS Soil Ontology Standards**.*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue.svg)](Dockerfile)
[![GloSIS Compatible](https://img.shields.io/badge/GloSIS-v1.0%20Compatible-green.svg)](https://github.com/glosis-ld/glosis)
[![ISO 17025 Ready](https://img.shields.io/badge/ISO%2FIEC-17025%20Ready-brightgreen.svg)](docs/ADMIN_GUIDE.md)
[![Tests](https://img.shields.io/badge/Tests-77%20Suites%20%7C%20555%20Passing-brightgreen.svg)](#-automated-test-suite-77-suites-555-tests)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B%20%7C%20v20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg)](https://vitejs.dev/)

</div>

---

## 📖 Online Documentation (GitHub Pages)

Our comprehensive, beginner-friendly online documentation is continuously published and updated:

* 🌐 **Interactive Documentation Site**: [https://yigini.github.io/soilfer-lims/](https://yigini.github.io/soilfer-lims/)
* 📖 **[Administration Guide](https://github.com/yigini/soilfer-lims/blob/main/docs/ADMIN_GUIDE.md)** — Laboratory configuration, user RBAC, GloSIS procedures, quality rules, and SIS API keys.
* 🚀 **[Deployment & Production Guide](https://github.com/yigini/soilfer-lims/blob/main/docs/DEPLOYMENT_GUIDE.md)** — Comprehensive VPS setup, Docker Compose, Nginx/Apache reverse proxy, SSL/Certbot, and zero-downtime updates.
* 🛠️ **[Installation Quickstart](https://github.com/yigini/soilfer-lims/blob/main/docs/INSTALL.md)** — Step-by-step local machine and server installation for beginners.
* 🔄 **[Upgrading & Maintenance Guide](https://github.com/yigini/soilfer-lims/blob/main/docs/UPGRADING.md)** — Backup procedures, container updates, and database migration routines.

---

## 🌟 What is SoilFER-LIMS?

**SoilFER-LIMS** (Laboratory Information Management System) is an open-source web application designed to help soil testing laboratories manage their entire daily workflow digitally. Developed under the FAO SoilFER Programme and supported by GLOSOLAN, it replaces paper logbooks, disconnected spreadsheets, and error-prone manual calculations with an immutable, auditable digital chain of custody.

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
| RFC 7946 GeoJSON|     | PDF with Sign   |     | Blank / Dups /QC|
+-----------------+     +-----------------+     +-----------------+
```

1. **Field Intake & Provenance**: Expected arrivals from KoboToolbox mobile surveys, physical inspection of bags, barcode/QR label printing, and non-conformance tracking.
2. **Operational Prerequisite Gates**: Server-side enforced preparation gates (forced-air drying at 40°C, 2mm sieving) requiring immutable operational checklist receipts before testing can begin.
3. **Bench Execution & Worksheets**: Single-entry bench worksheets for routine soil chemistry, AAS, ICP, photometry, titration, and mid-infrared (MIR) diffuse reflectance spectroscopy.
4. **ISO/IEC 17025 Quality Control**: Automated evaluation of method blanks ($\le 0.05$), analytical duplicate RPD ($\le 10.0\%$), and Certified Reference Material (CRM) recovery ($90\%\text{--}110\%$).
5. **Publication-Grade Certificates**: Tamper-evident PDF certificates featuring FAO/lab co-branding, USDA 12-class soil texture classification, 5-tier agronomic ratings, and manager signatures.
6. **National Soil Information System (SIS) Interoperability**: Automated machine-to-machine data exchange conforming to GloSIS ontologies and RFC 7946 GeoJSON standards.

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

### 🛡️ 2. ISO/IEC 17025 Quality Assurance & Batch Control
* **Typed Quality Control Samples**:
  * **Method Blanks**: Automatic evaluation against background limits ($\le 0.05$).
  * **Analytical Duplicates**: Relative Percent Difference monitoring ($\text{RPD} \le 10.0\%$).
  * **Certified Reference Materials (CRMs)**: Standard recovery window ($90.0\% \le \text{Recovery} \le 110.0\%$).
* **Automated Batch Disposition**: Batches transition to `QC_PASS` or `QC_FAIL` automatically based on entered readings.
* **Managerial Disposition Overrides**: Authorize `PROCEED_WITH_WARNING` or order batch re-runs with mandatory audit trail justification.

### 🌿 3. USDA Soil Texture & Agronomic Interpretation Engine
* **USDA 12-Class Textural Triangle**: Automatic soil texture derivation (`Sandy Loam`, `Clay`, `Silty Clay Loam`, etc.) with strict composite mass-balance closure validation ($\text{Sand} + \text{Silt} + \text{Clay} = 100\% \pm 2.0\%$).
* **FAO 5-Tier Fertility Ratings**: Evaluates values into `VERY_LOW`, `LOW`, `OPTIMAL`, `HIGH`, `VERY_HIGH` with practical soil health guidance.
* **Stoichiometric Balances**: Calculates C:N organic matter equilibrium, Base Saturation %, $\text{Ca:Mg}$ and $\text{Mg:K}$ ratios, and SAR/ESP sodicity hazards.

### ⚡ 4. Technician Workbench & Spectral Library
* **Single-Entry Recording**: Eliminates duplicate entry forms and maintains clean separation between draft autosaves and submitted results.
* **Diffuse Reflectance Spectroscopy**: Upload, display, and manage Full-Range Mid-Infrared (MIR $400\text{--}4000\text{ cm}^{-1}$) and VIS-NIR spectral files linked directly to sample custody IDs.
* **Instrument Readiness**: Tracks analytical balances, pH meters, and spectrophotometers with calibration reminders.

### 📄 5. Publication-Grade Certificates & Public Verification
* **Zero-Dependency PDF Engine**: High-performance pure JavaScript PDF generator powered by PDFKit (no Chromium/Puppeteer overhead).
* **Official Layout**: FAO and laboratory co-branded headers, sample GPS coordinates, depth layers, complete analytical results grid, and Lab Manager digital signature.
* **Public QR Verification**: Instant validation of printed certificates via secure public URL tokens (`/api/reports/public/:token/pdf`).

### 📦 6. Historical Sample Analysis Backfill (Pre-Delivery Compatibility)
* **Legacy Batch Ingestion**: Built-in backward compatibility module in Projects workspace allowing laboratories to backfill historical samples analyzed prior to system delivery without corrupting active chain-of-custody ledgers.

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

## 🔑 Default User Roles Reference

Upon first deployment, the database is pre-seeded with demonstration accounts across all operational roles:

| Username | Default Password | Role Persona | Typical Duties & Capabilities |
| :--- | :--- | :--- | :--- |
| **`admin`** | `password` | `SUPER_ADMIN` / `LAB_MANAGER` | Global administration, laboratory creation, SIS API keys, institutional branding |
| **`mgr_gtm`** | `password` | `LAB_MANAGER` | Work assignment, batch reviews, QC dispositions, report approvals (`GTM-LAB1`) |
| **`intake_gtm`** | `password` | `SAMPLE_RECEPTION` | Sample arrival verification, condition inspection, Lab ID barcodes, Kobo sync |
| **`tech_gtm_1`** | `password` | `LAB_TECHNICIAN` | Bench worksheets, drying/milling preparation receipts, MIR spectral scans |
| **`mgr_moz`** | `password` | `LAB_MANAGER` | Mozambique laboratory manager (`MOZ-LAB1`) |
| **`tech_moz_1`** | `password` | `LAB_TECHNICIAN` | Mozambique bench analyst (`MOZ-LAB1`) |

> 🔒 **Security Notice:** You will be prompted to change default administrator passwords immediately upon your initial login.

---

## 💻 Local Development (Without Docker)

For software developers or contributors who prefer running Node.js directly on their workstation:

### Prerequisites
* **Node.js**: v18.0.0+ or v20.0.0+ ([Download Node.js](https://nodejs.org/))
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

## 🧪 Automated Test Suite (77 Suites, 555 Tests)

SoilFER-LIMS features an extensive automated test suite covering security authorization, database schema integrity, scientific metrology, and operational prerequisite contracts:

```bash
cd server
npm test
```

```text
PASS tests/contracts/reception_honest_metrics.test.js
PASS tests/contracts/reception_stage_e.test.js
PASS tests/contracts/reception_stage_b.test.js
PASS tests/contracts/catalogue_seeder.test.js
PASS tests/contracts/texture_boundary_verification.test.js
PASS tests/contracts/matrix_validation.test.js
PASS tests/contracts/nsis_exchange.test.js
PASS tests/contracts/prerequisite_gate.test.js
PASS tests/contracts/workbench_draft_integrity.test.js
PASS tests/contracts/spectral_mir_window.test.js
PASS tests/contracts/rbac_sample_registry.test.js
PASS tests/contracts/qc_disposition_flagging.test.js
PASS tests/contracts/workflow_map_redesign.test.js
...
Test Suites: 77 passed, 77 total
Tests:       555 passed, 555 total
Snapshots:   0 total
Time:        144.256 s
```

---

## 💾 Backups & Disaster Recovery

SoilFER-LIMS stores all database records in an ACID-compliant, self-contained database engine with Write-Ahead Logging (WAL) enabled.

### Creating an Immediate Backup
```bash
# On a Docker deployment:
docker exec -w /app/server soilfer-lims node scripts/backup_db.js

# Or copy the database file directly:
docker cp soilfer-lims:/app/server/prisma/dev.db ./backup-$(date +%Y%m%d).db
```

### Restoring from a Backup
```bash
docker cp ./backup-20260906.db soilfer-lims:/app/server/prisma/dev.db
docker restart soilfer-lims
```

---

## 📄 License & Attribution

SoilFER-LIMS is distributed under the **MIT License**. See [`LICENSE`](LICENSE) for terms.

### Institutional Acknowledgements
* **Food and Agriculture Organization of the United Nations (FAO)**: GLOSOLAN Standard Operating Procedures, SoilFER technical guidelines, and GloSIS ontology specifications (CC BY-NC-SA 3.0 IGO).
* **International Organization for Standardization (ISO)**: Standard method references (ISO/IEC 17025, ISO 10390, ISO 11265, ISO 14255).
* **USDA Natural Resources Conservation Service (NRCS)**: Soil Survey Laboratory Methods and USDA 12-Class Textural Classification.

---

<div align="center">
  <sub>Developed in support of the <b>Global Soil Partnership (GSP)</b>, <b>GLOSOLAN</b>, and the <b>FAO SoilFER Programme</b> for global soil health, agricultural resilience, and food security.</sub>
</div>
