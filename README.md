# 🧪 SoilFER-LIMS

**Global & Local Laboratory Information Management System for Soil Analysis**  
*Aligned with the FAO Global Soil Partnership (GSP), GLOSOLAN, ISO/IEC 17025, and GloSIS Soil Ontology Standards.*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue.svg)](Dockerfile)
[![GloSIS Compatible](https://img.shields.io/badge/GloSIS-v1.0%20Compatible-green.svg)](https://github.com/glosis-ld/glosis)
[![ISO 17025 Ready](https://img.shields.io/badge/ISO%2F规-17025%20Ready-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/Tests-14%20Suites%20%7C%2058%20Passing-brightgreen.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)

---

## 🌟 Overview

**SoilFER-LIMS** is an enterprise-grade, open-source Laboratory Information Management System purpose-built for national soil laboratories, international research networks, and agricultural development initiatives under the FAO SoilFER Programme.

It connects the entire soil analytical pipeline:
1. **Field Sample Intake & Chain of Custody** (KoboToolbox GPS, field photo inspection, auto-generated barcodes)
2. **Operational Pre-Analytical Gates** (Drying, Grinding, and Preparation tracking)
3. **Analytical Testing & Bench Workbenches** (Wet chemistry, AAS, ICP-OES, Photometry, Titration)
4. **Spectral Analysis** (MIR / VIS-NIR spectral library & validation)
5. **Typed Quality Assurance & Batch Control** (Blanks, Duplicate RPD %, CRM Recovery %, Batch Disposition)
6. **FAO Agronomic Interpretation Engine & Matrix Diagnostics** (5-tier ratings, USDA texture classes, C:N stoichiometry, Base Saturation, Ca:Mg, SAR/ESP)
7. **Publication-Grade Reporting & Certificates** (Zero-dependency pure JS PDFKit generator with digital signatures & public verification tokens)
8. **National & Global Data Exchange** (FAO GloSIS Linked Data & Machine-to-Machine SIS APIs)

---

## 🚀 Two Deployment Modes

| Mode | **Local Lab Deployment** | **Global / National Network Deployment** |
| :--- | :--- | :--- |
| **Target** | Individual soil laboratory | National soil program, multi-lab ministry network |
| **Topology** | Standalone instance | Centralized instance with lab-scoped data isolation |
| **Security & RBAC** | Single lab manager, receptionists, technicians | Global Super Admin, National Lab Managers, Lab Technicians |
| **Data Isolation** | Unified lab context | Strict RBAC isolation per laboratory code (`GTM-LAB1`, `MOZ-LAB1`, etc.) |
| **Default User** | `admin` (Role: `LAB_MANAGER`) | `admin` (Role: `SUPER_ADMIN`) |
| **Best For** | Provincial or university soil testing facilities | National Soil Information Systems (SIS) & FAO programs |

Configure via `DEPLOYMENT_MODE=local` or `DEPLOYMENT_MODE=global` in your `.env`.

---

## ✨ Key Capabilities

### 🔬 1. FAO GloSIS & GLOSOLAN Ontology Standard
* **275 Standardized Analytical Procedures**: Built-in procedure catalog loaded directly from FAO `glosis-ld/glosis` specifications.
* **Controlled Unit Vocabulary & Conversion**: Centralized dictionary normalizes `%`, `ppm`, `meq/100g`, `g/kg`, `mg/kg`, `cmol(+)/kg`, `dS/m`, and `µS/cm` with automatic scientific conversion factors.
* **Canonical Soil Attributes**: Standardized codes for `pH`, `carbonOrganic`, `nitrogenTotal`, `electricalConductivity`, `extractableElements`, `exchangeableBases`, `pSA`, `cationExchangeCapacitySoil`, and more.
* **Machine-to-Machine SIS API**: Export sample analyses in standardized JSON/Linked-Data format with API Key authentication.

### 🛡️ 2. ISO/IEC 17025 Quality Control & Batch Disposition
* **Typed QC Sample Types**:
  * **Method Blanks**: Automatic evaluation against background threshold ($\le 0.05$).
  * **Analytical Duplicates**: Relative Percent Difference ($\text{RPD} \le 10.0\%$).
  * **Certified Reference Materials (CRMs)**: Standard recovery window ($90.0\% \le \text{Recovery} \le 110.0\%$).
* **Automated Batch Evaluation**: Automatic transition to `QC_PASS` or `QC_FAIL`.
* **Managerial Disposition Overrides**: Formal overrides (`PROCEED_WITH_WARNING`, `REANALYZE_BATCH`, `REJECT_BATCH`) requiring manager role and audit trail rationale.

### 🌿 3. Agronomic Interpretation & Multi-Parameter Soil Metrology
* **FAO 5-Tier Agronomic Engine**: Classifies parameters into `VERY_LOW`, `LOW`, `OPTIMAL`, `HIGH`, `VERY_HIGH` with practical soil fertility management recommendations.
* **USDA 12-Class Textural Derivation**: Automatically calculates texture class (e.g. `Sandy Loam`, `Clay`, `Silty Clay`) with closure error validation ($\text{Sand} + \text{Silt} + \text{Clay} = 100\% \pm 2.0\%$).
* **Stoichiometric & Balance Diagnostics**: Evaluates C:N organic matter equilibrium, Base Saturation %, $\text{Ca:Mg}$ and $\text{Mg:K}$ nutritional balances, and SAR/ESP sodicity hazards.

### 📄 4. Publication-Grade Certificate & PDF Generation
* **Zero-Dependency Pure JS PDF Engine**: Built on PDFKit (no headless Chrome / Puppeteer dependencies).
* **Official FAO SoilFER Layout**:
  * FAO and laboratory co-branding headers.
  * 2-column sample provenance and chain of custody grid.
  * Categorized analytical results table with standardized units, method references, and FAO interpretation badges.
  * USDA texture and soil diagnostic summaries.
  * ISO 17025 QA/QC statements and Lab Manager digital signature.
* **Secure Access**: Available via authenticated endpoints (`/api/reports/:id/pdf`) and secure public verification tokens (`/api/reports/public/:token/pdf`).

### 🛡️ 5. Multi-Lab Multi-Tenancy & Hardened RBAC
* **Granular Role-Based Access Control**:
  * `SUPER_ADMIN`: Global cross-laboratory visibility, laboratory creation, API key management, institutional branding lock.
  * `LAB_MANAGER`: Analytical assignment, batch approvals, QC disposition overrides, equipment oversight.
  * `LAB_TECHNICIAN`: Personal bench queue ("My Work"), draft autosaving, method-specific validations.
  * `SAMPLE_RECEPTION`: Chain-of-custody intake, label printing, non-conformance logging.
* **Scope Guard Isolation**: Automatic query scoping ensuring staff only access authorized lab data.

### ⚡ 6. Technician Workbench & Spectral Analysis
* **High-Throughput Batch Entry**: Enter results sample-by-sample or test-by-test with keyboard navigation.
* **Spectral Library**: Upload, visualize, and baseline-correct VIS-NIR and Mid-Infrared (MIR) spectra.
* **Equipment & Instrument Linkage**: Assign instruments (AAS, pH meter, Balance) with automatic calibration check reminders.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                               │
│  React 18 · Vite · TailwindCSS · Lucide Icons · CesiumJS 3D · i18n Engine   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / WebSocket (WS)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            EXPRESS API SERVER                               │
│  Node.js · JWT Auth · Scope Guard RBAC · GloSIS Engine · PDFKit Generator   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Prisma ORM / Better-SQLite3
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           DATABASE & STORAGE                                │
│  SQLite (Zero-Config) · Prisma Schema · Audit Trail Engine · QC Batches     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Automated Test Suite (14 Suites, 58 Tests)

SoilFER-LIMS includes comprehensive contract, scenario, and security test coverage:

```bash
cd server
npm test
```

```
PASS tests/contracts/matrix_validation.test.js (3/3 passed)
PASS tests/contracts/qc_controls.test.js (6/6 passed)
PASS tests/contracts/controlled_units_interpretation.test.js (4/4 passed)
PASS tests/contracts/report_pdf.test.js (5/5 passed)
PASS tests/security/rbac_enforcement.test.js (5/5 passed)
PASS tests/contracts/assignment.test.js (6/6 passed)
PASS tests/contracts/closure.test.js (6/6 passed)
PASS tests/contracts/gates_clean.test.js (1/1 passed)
PASS tests/contracts/status_contract.test.js (3/3 passed)
PASS tests/contracts/submission.test.js (5/5 passed)
PASS tests/scenarios/golden_path.test.js (4/4 passed)
PASS tests/scenarios/pt_ilc.test.js (2/2 passed)
PASS tests/scenarios/qc_batch.test.js (4/4 passed)
PASS tests/scenarios/scientific_validation.test.js (4/4 passed)

Test Suites: 14 passed, 14 total
Tests:       58 passed, 58 total
```

---

## ⚡ Quick Start (Docker Deployment)

### 1. Clone & Configure
```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
cp .env.example .env
```

### 2. Launch with Docker Compose
```bash
# Global Network Deployment:
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d --build

# Or Single Local Lab Deployment:
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

### 3. Log In
Open your browser to **`http://localhost`** (or your server domain/IP).
* **Default Username:** `admin`
* **Default Password:** `password`
*(You will be required to change the administrator password on first login).*

---

## 🔑 Default User Roles Reference

| Username | Default Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `admin` | `password` | `SUPER_ADMIN` / `LAB_MANAGER` | System Administrator / Global Director |
| `mgr_gtm` | `password` | `LAB_MANAGER` | Guatemala Laboratory Manager (`GTM-LAB1`) |
| `intake_gtm` | `password` | `SAMPLE_RECEPTION` | Guatemala Sample Intake & Reception |
| `tech_gtm_1` | `password` | `LAB_TECHNICIAN` | Guatemala Senior Bench Technician |
| `mgr_moz` | `password` | `LAB_MANAGER` | Mozambique Laboratory Manager (`MOZ-LAB1`) |
| `tech_moz_1` | `password` | `LAB_TECHNICIAN` | Mozambique Senior Bench Technician |

---

## 📚 Online Documentation (GitHub Pages)

📖 **Interactive Documentation Site**: [https://yigini.github.io/soilfer-lims/](https://yigini.github.io/soilfer-lims/)

* 📖 **[Administration Guide](docs/ADMIN_GUIDE.md)** — Laboratory configuration, user RBAC, GloSIS procedures, and SIS API keys.
* 🚀 **[Deployment & Production Guide](docs/DEPLOYMENT_GUIDE.md)** — Comprehensive VPS setup, Nginx reverse proxy, SSL/Certbot, and zero-downtime updates.
* 🛠️ **[Installation Quickstart](docs/INSTALL.md)** — Step-by-step local and server installation.

---

## 💾 Backup & Maintenance

### Creating an Immediate Database Backup
```bash
docker exec -w /app/server soilfer-lims node scripts/backup_db.js
# Or copy database directly:
docker cp soilfer-lims:/app/server/prisma/dev.db ./backup-$(date +%Y%m%d).db
```

### Restoring from Backup
```bash
docker cp ./backup.db soilfer-lims:/app/server/prisma/dev.db
docker restart soilfer-lims
```

---

## 🔄 Updating to Latest Release

```bash
cd /opt/soilfer-lims
git pull origin main
docker compose down
docker compose up -d --build
```

---

## 📄 License & Attribution

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Developed in support of the **Global Soil Partnership (GSP)**, **GLOSOLAN**, and **SoilFER Programme** for global soil health, agricultural resilience, and food security.
