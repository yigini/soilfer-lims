# 🧪 SoilFER-LIMS

**Global & Local Laboratory Information Management System for Soil Analysis**  
*Aligned with the FAO Global Soil Partnership (GSP), GLOSOLAN, and GloSIS Soil Ontology Standards.*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue.svg)](Dockerfile)
[![GloSIS Compatible](https://img.shields.io/badge/GloSIS-v1.0%20Compatible-green.svg)](https://github.com/glosis-ld/glosis)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)

---

## 🌟 Overview

**SoilFER-LIMS** is an enterprise-grade, open-source Laboratory Information Management System purpose-built for national soil laboratories, international research networks, and agricultural development initiatives.

It connects the entire soil analytical pipeline:
1. **Field Sample Intake** (KoboToolbox GPS & field photo sync)
2. **Operational Gates** (Drying, Grinding, and Preparation tracking)
3. **Analytical Testing & Bench Workbenches** (Wet chemistry, AAS, ICP, Photometry)
4. **Spectral Analysis** (MIR / VIS-NIR spectral library & validation)
5. **Quality Assurance & Scientific Auditing** (QA/QC balances, automatic texture checks)
6. **Multi-tier Managerial Review & Formal Reporting** (Bilingual PDF certificates)
7. **National & Global Data Exchange** (FAO GloSIS Linked Data & Machine-to-Machine SIS APIs)

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

## ✨ Key Features

### 🔬 1. FAO GloSIS & GLOSOLAN Ontology Standard
* **275 Standardized Analytical Procedures**: Built-in procedure catalog loaded directly from FAO `glosis-ld/glosis` specifications.
* **Canonical Soil Attributes**: Standardized codes for `pH`, `carbonOrganic`, `nitrogenTotal`, `electricalConductivity`, `extractableElements`, `exchangeableBases`, `pSA`, `cationExchangeCapacitySoil`, and more.
* **Atomic Bench Analytes**: Natural bench-level logging (e.g. Ca, Mg, K, Na, Zn, Fe, Sand, Silt, Clay) mapped to parent GloSIS attributes.
* **Machine-to-Machine SIS API**: Export sample analyses in standardized JSON/Linked-Data format with API Key authentication.

### 🛡️ 2. Multi-Lab Multi-Tenancy & RBAC Security
* **Granular Role-Based Access Control**:
  * `SUPER_ADMIN`: Global cross-laboratory visibility, laboratory creation, API key management.
  * `LAB_MANAGER`: Analytical assignment, batch approvals, equipment oversight, laboratory configuration.
  * `LAB_TECHNICIAN`: Personal bench queue ("My Work"), draft autosaving, method-specific validations.
  * `SAMPLE_RECEPTION`: Chain-of-custody intake, label printing, non-conformance logging.
* **Type-Safe Lab Isolation**: Automatic query scoping ensuring staff only access authorized lab data.

### ⚡ 3. Technician Workbench & Scientific Validation
* **High-Throughput Batch Entry**: Enter results sample-by-sample or test-by-test with keyboard navigation.
* **Automated Scientific Validation Rules**:
  * Texture Balance QA Check: $\text{Sand \%} + \text{Silt \%} + \text{Clay \%} = 100\% \pm 0.5\%$.
  * Realistic Soil Physical-Chemical ranges with real-time out-of-spec warnings.
* **Equipment & Instrument Linkage**: Assign instruments (AAS, pH meter, Balance) with automatic calibration check reminders.
* **Draft Autosave**: Real-time optimistic draft saving preventing data loss during bench work.

### 🛰️ 4. 3D Geospatial Field Intelligence
* **CesiumJS 3D Globe**: Visualizes soil sampling points with high-resolution satellite imagery and terrain.
* **Field Provenance**: Displays depth layers (D1/D2), collection dates, land-cover classes, and GPS coordinates.
* **Photo Inspection**: Cardinal direction photos (North, East, South, West) and surveyor signature verification.

### 📊 5. Spectroscopy & Quality Control
* **Spectral Library**: Upload, visualize, and baseline-correct VIS-NIR and Mid-Infrared (MIR) spectra.
* **QC Sample Management**: Blanks, certified reference materials (CRM), and duplicate batch tracking.

### 🌐 6. Internationalization & Custom Branding
* **Multi-lingual Interface**: English (`en`), Spanish (`es`), Latin American Spanish (`es-419`), French (`fr`), and Portuguese (`pt`).
* **In-App Translation Editor**: Lab administrators can customize terminology directly from the UI.
* **Institutional Branding**: Support for Ministry / Laboratory logos and official partner emblems (Japanese ODA, US Department of State, FAO).

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
│  Node.js · JWT Auth · Scope Guard RBAC · GloSIS Engine · Real-time Push     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Prisma ORM
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           DATABASE & STORAGE                                │
│  SQLite (Zero-Config / Better-SQLite3) · Prisma Schema · Audit Trail Engine │
└─────────────────────────────────────────────────────────────────────────────┘
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

## 📚 Documentation & Guides

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
