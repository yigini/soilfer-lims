# Welcome to the SoilFER-LIMS Guide

<div align="center">

<img src="./img/soilfer-logo.png" alt="SoilFER LIMS Logo" width="300" />

# 🧪 SoilFER-LIMS

### Laboratory Information Management System for Soil Analysis

**Open-source software supporting the [FAO SoilFER Programme](https://www.fao.org/soils-portal/soilfer) and [GLOSOLAN](https://www.fao.org/global-soil-partnership/glosolan) guidelines**

---

*An open-source system to help soil laboratories manage their work digitally — from field collection to final reporting.*

</div>

---

## Who Is This Guide For?

This guide is written for **anyone** who needs to set up, manage, or operate SoilFER-LIMS, regardless of technical background:

- 🔬 **Laboratory Managers** digitizing soil testing workflows and managing quality systems aligned with ISO/IEC 17025.
- 🏛️ **Government & Ministry Officials** establishing National Soil Information Systems (SIS).
- 🎓 **University Researchers** managing sample custody and MIR/VIS-NIR spectral datasets.
- 🌍 **International Programme Coordinators** deploying multi-lab networks across participating countries.
- 💻 **IT Specialists & System Administrators** deploying containerized production infrastructure.

---

## What Will You Learn?

| Part | What You'll Learn |
| :--- | :--- |
| **About the Project** | How SoilFER-LIMS supports soil laboratory operations and its core capabilities |
| **Getting Started** | Prerequisites, server hardware sizing, and domain name setup |
| **Installation** | Step-by-step setup with Docker or Node.js |
| **Deployment** | Production setups: fresh servers, shared reverse proxies, and automated SSL |
| **Using LIMS** | Day-to-day operations: sample reception, bench worksheets, QC reviews, and certificates |
| **Maintenance** | Container updates, automated daily backups, and disaster recovery |
| **Reference** | Configuration tables, role permission matrices, and glossary of soil metrology terms |

---

## Quick Start (For Experienced Users)

If you're already familiar with Docker and Linux:

```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d --build
```

Open your browser to `http://localhost` and sign in with:
* **Username:** `admin`
* **Password:** `<generated-initial-password>` (printed once in container logs, or set via `ADMIN_INITIAL_PASSWORD`)
