# 🧪 SoilFER-LIMS

**Laboratory Information Management System for Soil Analysis**

A full-featured, open-source LIMS designed for soil fertility laboratories. Track samples from field collection through analysis to final reporting — with built-in field data sync, spectral analysis, multi-lab support, and interactive 3D mapping.

---

## 🚀 Quick Start

```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

Open **http://localhost** → Login: `admin` / `password`  
You'll be prompted to change the password on first login.

> **📖 Full deployment guide:** See **[docs/INSTALL.md](docs/INSTALL.md)** for step-by-step instructions covering DNS setup, SSL certificates, and deploying alongside existing websites.

---

## 🚀 Two Deployment Modes

| | **Local** | **Global** |
|---|---|---|
| **Purpose** | Single laboratory | Multi-laboratory network |
| **Users** | Lab Manager + Technicians | Super Admin + multiple Lab Managers |
| **Data isolation** | All data in one lab context | Full RBAC isolation per laboratory |
| **Default account** | `admin` (LAB_MANAGER) | `admin` (SUPER_ADMIN) |
| **Best for** | Individual soil labs | National soil programs, research networks |

Set `DEPLOYMENT_MODE=local` or `DEPLOYMENT_MODE=global` in your `.env` file.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Sample Lifecycle** | Track samples from field → reception → analysis → approval → reporting |
| **Field Data Sync** | Automatic sync with KoboToolbox for field sample intake |
| **Spectral Analysis** | Upload, visualize, and manage MIR/NIR spectral data |
| **3D Field Maps** | Interactive CesiumJS globe with satellite imagery and field photos |
| **Multi-Lab Support** | Full lab-scoped data isolation (Global mode) |
| **Role-Based Access** | Super Admin, Lab Manager, Technician, Reception, Project Manager |
| **Data Export** | Excel, CSV, and PDF with customizable report templates |
| **Equipment Module** | Track instruments, calibration schedules, maintenance logs |
| **Inventory Module** | Manage reagents, consumables, lot tracking |
| **QC Batches** | Analytical batch management with QC checks |
| **Audit Trail** | Complete logging of all system actions |
| **Dark Mode** | Full dark/light theme support |
| **Multilingual** | English, French, Spanish, Portuguese |

---

## 🔑 Default Credentials

| Mode | Username | Password | Role |
|------|----------|----------|------|
| Local | `admin` | `password` | LAB_MANAGER |
| Global | `admin` | `password` | SUPER_ADMIN |

> ⚠️ **You must change this on first login.**

---

## 🏗️ Architecture

```
┌───────────────────────────────────┐
│         Browser (Client)          │
│  React · Vite · CesiumJS · i18n  │
├───────────────────────────────────┤
│       Express API Server          │
│  Node.js · JWT · RBAC · WS       │
├───────────────────────────────────┤
│        SQLite Database            │
│  Prisma ORM · Zero-config        │
└───────────────────────────────────┘
```

---

## 📚 Documentation

- **[Deployment Guide](docs/INSTALL.md)** — Step-by-step deployment for fresh servers and existing infrastructure
- **[Admin Guide](docs/ADMIN_GUIDE.md)** — Post-deploy configuration & management

---

## 💾 Backup & Restore

```bash
# Backup
docker cp soilfer-lims:/app/server/prisma/dev.db ./backup-$(date +%Y%m%d).db

# Restore
docker cp ./backup.db soilfer-lims:/app/server/prisma/dev.db && docker restart soilfer-lims
```

---

## 🔄 Updating

```bash
cd /opt/soilfer-lims
git pull origin main
docker compose down && docker compose up -d --build
```

---

## 📄 License

[MIT License](LICENSE)
